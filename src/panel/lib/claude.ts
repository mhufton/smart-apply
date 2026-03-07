import type { MasterProfile, ScrapedJob, GeneratedDocuments } from '../../types'

// ── Provider config ───────────────────────────────────────────────────────────

export type Provider = 'anthropic' | 'openai-compatible'

export interface ProviderConfig {
  provider: Provider
  apiKey: string
  endpoint: string    // base URL — only used for openai-compatible
  smallModel: string  // fast/cheap model (parsing, fit analysis, chat)
  largeModel: string  // quality model (CV + cover letter generation)
}

const CONFIG_KEY = 'providerConfig'
const LEGACY_KEY = 'anthropicApiKey'

export async function getProviderConfig(): Promise<ProviderConfig | null> {
  const result = await chrome.storage.local.get([CONFIG_KEY, LEGACY_KEY])
  if (result[CONFIG_KEY]) return result[CONFIG_KEY] as ProviderConfig
  // Backward compat: migrate old anthropicApiKey
  if (result[LEGACY_KEY]) {
    return { provider: 'anthropic', apiKey: result[LEGACY_KEY], endpoint: '', smallModel: '', largeModel: '' }
  }
  return null
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  await chrome.storage.local.set({ [CONFIG_KEY]: config })
}

export async function clearProviderConfig(): Promise<void> {
  await chrome.storage.local.remove([CONFIG_KEY, LEGACY_KEY])
}

// Legacy helpers kept for backward compat
export async function getApiKey(): Promise<string | null> {
  const config = await getProviderConfig()
  return config?.apiKey ?? null
}
export async function saveApiKey(key: string): Promise<void> {
  await saveProviderConfig({ provider: 'anthropic', apiKey: key, endpoint: '', smallModel: '', largeModel: '' })
}
export async function clearApiKey(): Promise<void> {
  await clearProviderConfig()
}

// ── Core streaming calls ──────────────────────────────────────────────────────

export type ApiMessage = { role: 'user' | 'assistant'; content: string }

async function streamAnthropic(
  model: string,
  messages: ApiMessage[],
  apiKey: string,
  onChunk: (text: string) => void,
  maxTokens: number
): Promise<void> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${body}`)
  }

  await readSSE(response, (json) => {
    if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
      onChunk(json.delta.text)
    }
  })
}

async function streamOpenAICompat(
  model: string,
  messages: ApiMessage[],
  apiKey: string,
  endpoint: string,
  onChunk: (text: string) => void,
  maxTokens: number
): Promise<void> {
  const base = endpoint.replace(/\/$/, '')
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(base)
  if (!isLocal && !base.startsWith('https://')) {
    throw new Error('Endpoint must use HTTPS. Update it in the Settings tab.')
  }
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: maxTokens }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API error ${response.status}: ${body}`)
  }

  await readSSE(response, (json) => {
    const content = json.choices?.[0]?.delta?.content
    if (typeof content === 'string') onChunk(content)
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readSSE(response: Response, onEvent: (json: any) => void): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      try { onEvent(JSON.parse(data)) } catch { /* malformed SSE — skip */ }
    }
  }
}

const ANTHROPIC_SMALL_DEFAULT = 'claude-haiku-4-5-20251001'
const ANTHROPIC_LARGE_DEFAULT = 'claude-sonnet-4-5'

async function stream(
  tier: 'small' | 'large',
  messages: ApiMessage[],
  onChunk: (text: string) => void,
  maxTokens: number
): Promise<void> {
  const config = await getProviderConfig()
  if (!config) throw new Error('No API key set. Add one in the Settings tab.')

  const model = tier === 'small'
    ? (config.smallModel || config.largeModel)
    : (config.largeModel || config.smallModel)

  if (config.provider === 'openai-compatible') {
    if (!config.endpoint) throw new Error('No endpoint set. Configure it in the Settings tab.')
    if (!model) throw new Error('No model set. Configure it in the Settings tab.')
    return streamOpenAICompat(model, messages, config.apiKey, config.endpoint, onChunk, maxTokens)
  }

  const anthropicModel = model || (tier === 'small' ? ANTHROPIC_SMALL_DEFAULT : ANTHROPIC_LARGE_DEFAULT)
  return streamAnthropic(anthropicModel, messages, config.apiKey, onChunk, maxTokens)
}

// ── Model callers ─────────────────────────────────────────────────────────────

// Small — fast, cheap. Used for fit analysis, resume parsing, scraping, chat.
export async function callSmall(
  messages: ApiMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  return stream('small', messages, onChunk, 4096)
}

// Large — higher quality. Used for CV + cover letter generation.
export async function callLarge(
  messages: ApiMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  return stream('large', messages, onChunk, 8192)
}

// Legacy aliases
export const callHaiku = callSmall
export const callSonnet = callLarge
export const callClaude = callSmall

// ── Prompts ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

export function parseMonthYear(str: string): number | null {
  const m = str.trim().toLowerCase().match(/^(\w{3})\s+(\d{4})$/)
  if (!m) return null
  const mo = MONTH_NAMES.indexOf(m[1])
  if (mo === -1) return null
  return new Date(parseInt(m[2]), mo, 1).getTime()
}

export function parseDurationMonths(dates: string): number {
  // Prefer explicit duration string: "2 yrs 10 mos", "11 mos", etc.
  const yrMatch = dates.match(/(\d+)\s*yr/)
  const moMatch = dates.match(/(\d+)\s*mo/)
  if (yrMatch || moMatch) {
    return (yrMatch ? parseInt(yrMatch[1]) * 12 : 0) + (moMatch ? parseInt(moMatch[1]) : 0)
  }
  // Fall back to calculating from date range: "Jan 2025 – Present", "Jun 2023 – Jan 2025"
  const parts = dates.split(/\s*[–—-]\s*/)
  if (parts.length >= 2) {
    const start = parseMonthYear(parts[0])
    const end = /present/i.test(parts[1]) ? Date.now() : parseMonthYear(parts[1])
    if (start && end) return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44)))
  }
  return 0
}

export function fmtYears(months: number): string {
  const yrs = Math.floor(months / 12)
  const mos = months % 12
  if (yrs === 0) return `${mos} month${mos !== 1 ? 's' : ''}`
  if (mos === 0) return `${yrs} year${yrs !== 1 ? 's' : ''}`
  return `${yrs} yr ${mos} mo`
}

export function buildFitPrompt(job: ScrapedJob, profile: MasterProfile): string {
  const exps = profile.experiences ?? []

  // Group roles by company to show total tenure per employer
  const byCompany = new Map<string, typeof exps>()
  for (const e of exps) {
    const key = e.company.trim().toLowerCase()
    if (!byCompany.has(key)) byCompany.set(key, [])
    byCompany.get(key)!.push(e)
  }

  // Total YoE: sum unique company tenures (avoids double-counting overlapping roles)
  const totalMonths = Array.from(byCompany.values()).reduce((sum, roles) => {
    // Use the longest single-role duration OR sum if roles are clearly sequential
    const companyTotal = roles.reduce((s, r) => s + parseDurationMonths(r.dates), 0)
    return sum + companyTotal
  }, 0)
  const totalYoE = totalMonths > 0 ? `~${fmtYears(totalMonths)}` : 'unknown'

  // Current company = employer with a "Present" role
  const currentRoles = exps.filter(e => /present/i.test(e.dates))
  const currentCompany = currentRoles[0]?.company ?? ''
  const currentCompanyMonths = currentCompany
    ? (byCompany.get(currentCompany.trim().toLowerCase()) ?? [])
        .reduce((s, r) => s + parseDurationMonths(r.dates), 0)
    : 0
  const currentRoleTitle = currentRoles[0]?.title ?? ''
  const currentTenure = currentCompany
    ? `${currentRoleTitle} at ${currentCompany} — ${fmtYears(currentCompanyMonths)} total at this company across ${(byCompany.get(currentCompany.trim().toLowerCase()) ?? []).length} role(s)`
    : 'unknown'

  return `You are evaluating a job candidate's fit for a role. Be honest and analytical.

## Candidate Profile
Name: ${profile.basics.name}
${(profile.basics.customFields ?? []).filter(f => f.label && f.value).map(f => `${f.label}: ${f.value}`).join('\n')}
Summary: ${profile.summary}
Total professional experience: ${totalYoE}
Current role: ${currentTenure}

Experience (each role listed individually — note multiple roles at same company indicate internal progression, not job-hopping):
${exps.map(e =>
  `- ${e.title} at ${e.company} (${e.dates}${parseDurationMonths(e.dates) ? ` · ${fmtYears(parseDurationMonths(e.dates))}` : ''})\n  ${(e.bullets ?? []).slice(0, 2).join(' | ')}`
).join('\n')}

Skills: ${(profile.skills ?? []).join(', ')}

${(profile.projects ?? []).length > 0 ? `Projects:\n${(profile.projects ?? []).map(p =>
  `- ${p.name}: ${p.description} [${(p.tags ?? []).join(', ')}]`
).join('\n')}` : ''}

${(profile.contextNotes ?? []).length > 0 ? `Additional context:\n${(profile.contextNotes ?? []).map(n =>
  `${n.label ? n.label + ': ' : ''}${n.content}`
).join('\n')}` : ''}

## Job
Title: ${job.title}
Company: ${job.company}
Description:
${job.description.slice(0, 3000)}

## Task
Analyze this candidate's fit for this role. Return a JSON object with this exact shape:

\`\`\`json
{
  "score": 0-100,
  "headline": "one sentence summary",
  "signals": [
    { "area": "string", "match": "strong|partial|missing", "note": "string" }
  ],
  "greenFlags": ["string"],
  "redFlags": ["string"],
  "suggestedAngles": ["short angle phrase to lean into, e.g. 'Emphasize distributed systems'"],
  "analyzedAt": ${Date.now()}
}
\`\`\`

Be concise. Max 5 signals, 3 green flags, 3 red flags, 4 suggested angles.`
}

const PROFILE_JSON_SHAPE = `{
  "basics": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": "" },
  "summary": "professional summary",
  "experiences": [
    {
      "id": "exp-1",
      "company": "Company name",
      "title": "Job title",
      "dates": "Mon YYYY – Mon YYYY · X yr Y mo  (include the duration if visible)",
      "bullets": ["achievement or responsibility"],
      "tags": ["inferred skill/tech tags"]
    }
  ],
  "skills": ["individual skill"],
  "projects": [
    { "id": "proj-1", "name": "", "description": "", "tags": [] }
  ],
  "education": [
    { "institution": "", "degree": "", "dates": "" }
  ]
}`

export function buildLinkedInParsePrompt(raw: {
  name: string; headline: string; location: string; linkedin: string
  expText: string; eduText: string; skillsText: string
}): string {
  return `You are parsing a LinkedIn profile page. Extract structured data from the raw text below.

Name: ${raw.name}
Headline: ${raw.headline}
Location: ${raw.location}
LinkedIn URL: ${raw.linkedin}

--- EXPERIENCE SECTION (raw text) ---
${raw.expText || '(empty)'}

--- EDUCATION SECTION (raw text) ---
${raw.eduText || '(empty)'}

--- SKILLS SECTION (raw text) ---
${raw.skillsText || '(empty)'}

Return ONLY valid JSON matching this exact shape — no markdown fencing, no explanation:
${PROFILE_JSON_SHAPE}

Rules:
- Use sequential IDs: exp-1, exp-2 … and proj-1, proj-2 …
- For dates, preserve the duration string if visible (e.g. "Jan 2022 – Present · 2 yrs 11 mos")
- Extract each distinct role as a separate experience entry, even if they are at the same company
- skills[] should be a flat list of individual skill names
- Use empty arrays [] for sections with no data`
}

export function buildResumeParsePrompt(resumeText: string): string {
  return `You are parsing a resume/CV. Extract structured data from the text below.

Return ONLY valid JSON matching this exact shape — no markdown fencing, no explanation:
${PROFILE_JSON_SHAPE}

Rules:
- Use sequential IDs: exp-1, exp-2 … and proj-1, proj-2 …
- For dates, include duration if you can infer it (e.g. "Jan 2020 – Mar 2022 · 2 yrs 2 mos")
- skills[] should be a flat list of individual skill names
- Use empty arrays [] for sections with no data

Resume text:
${resumeText}`
}

export type DocMode = 'both' | 'cv' | 'cover-letter'

export function buildDocsPrompt(
  job: ScrapedJob,
  profile: MasterProfile,
  context: string,
  mode: DocMode = 'both'
): string {
  const outputFormat =
    mode === 'cv'
      ? `## Output format
Produce only a CV:

## CV
[Tailored CV in clean markdown. Use ## for section headings, bullet points for experience. Hard limit: 1–2 pages. Max 3 bullets per role. Omit roles older than 10 years unless exceptional. No filler, no objectives section, no "References available on request".

Do not use blank lines between bullet points, between roles, or between sections — no extra line breaks anywhere in the CV. Each section heading (##) should immediately follow the previous section's last line with no blank line separator.

Bullet writing rules:
• Use strong ownership verbs (designed, built, architected, led, owned — never "worked on", "contributed to", "part of").
• Include scale and numbers where they exist in the source material.
• Each bullet should convey: what was built, the technical approach or architecture used, and the resulting impact.
• Signal systems thinking — architecture, tradeoffs, scalability — not just task completion.
• Avoid generic phrasing like "responsible for", "helped build", or "utilized".
• Prioritize the most technically impressive or high-impact work in each role.

Bullet structure:
[Action verb] + [system or feature built] + [technical approach / architecture] + [scale or impact].

Example structure (do not copy content):
• Designed multi-tenant billing API using event-driven architecture and PostgreSQL schemas, supporting millions of transactions annually.
• Architected company-wide search infrastructure with Algolia, building indexing pipelines and developer SDKs used across multiple product teams.

After generating the CV, review each bullet and strengthen it by:
• replacing weak verbs with stronger ownership verbs
• adding scale or impact where possible
• removing redundant technologies already listed in skills]

Do not include a cover letter or any other text.`
      : mode === 'cover-letter'
      ? `## Output format
Produce only a cover letter:

## Cover Letter
[3 paragraphs max. Professional but not stiff. Don't start with "I am writing to apply for". No more than 350 words.]

Do not include a CV or any other text.`
      : `## Output format
Produce two sections separated exactly as shown:

## CV
[Tailored CV in clean markdown. Use ## for section headings, bullet points for experience. Hard limit: 1–2 pages. Max 3 bullets per role. Omit roles older than 10 years unless exceptional. No filler, no objectives section, no "References available on request".

Do not use blank lines between bullet points, between roles, or between sections — no extra line breaks anywhere in the CV. Each section heading (##) should immediately follow the previous section's last line with no blank line separator.

Bullet writing rules:
• Use strong ownership verbs (designed, built, architected, led, owned — never "worked on", "contributed to", "part of").
• Include scale and numbers where they exist in the source material.
• Each bullet should convey: what was built, the technical approach or architecture used, and the resulting impact.
• Signal systems thinking — architecture, tradeoffs, scalability — not just task completion.
• Avoid generic phrasing like "responsible for", "helped build", or "utilized".
• Prioritize the most technically impressive or high-impact work in each role.

Bullet structure:
[Action verb] + [system or feature built] + [technical approach / architecture] + [scale or impact].

Example structure (do not copy content):
• Designed multi-tenant billing API using event-driven architecture and PostgreSQL schemas, supporting millions of transactions annually.
• Architected company-wide search infrastructure with Algolia, building indexing pipelines and developer SDKs used across multiple product teams.

After generating the CV, review each bullet and strengthen it by:
• replacing weak verbs with stronger ownership verbs
• adding scale or impact where possible
• removing redundant technologies already listed in skills]

## Cover Letter
[3 paragraphs max. Professional but not stiff. Don't start with "I am writing to apply for". No more than 350 words.]

Do not include any other text outside these two sections.`

  // Serialize profile cleanly — strip internal IDs/tags, group roles by company
  const byCompany = new Map<string, typeof profile.experiences>()
  for (const e of profile.experiences ?? []) {
    const key = e.company.trim()
    if (!byCompany.has(key)) byCompany.set(key, [])
    byCompany.get(key)!.push(e)
  }

  const experienceBlock = Array.from(byCompany.entries()).map(([company, roles]) => {
    const tenureMonths = roles.reduce((s, r) => s + parseDurationMonths(r.dates), 0)
    const header = `**${company}** (${fmtYears(tenureMonths)} total)`
    const roleLines = roles.map(r =>
      `  • ${r.title} | ${r.dates}\n${(r.bullets ?? []).map(b => `    - ${b}`).join('\n')}`
    ).join('\n')
    return `${header}\n${roleLines}`
  }).join('\n\n')

  const customBasics = (profile.basics.customFields ?? [])
    .filter(f => f.label && f.value)
    .map(f => `${f.label}: ${f.value}`)
    .join('\n')

  const profileBlock = `Name: ${profile.basics.name}
Location: ${profile.basics.location || 'not specified'}
LinkedIn: ${profile.basics.linkedin || 'not specified'}
${customBasics ? customBasics + '\n' : ''}Summary: ${profile.summary || 'not provided'}

Experience:
${experienceBlock}

Skills: ${(profile.skills ?? []).join(', ') || 'not listed'}

${(profile.projects ?? []).length > 0 ? `Projects & Side Work:\n${(profile.projects ?? []).map(p =>
  `  • ${p.name}: ${p.description}${p.tags?.length ? ` [${p.tags.join(', ')}]` : ''}`
).join('\n')}` : ''}

${(profile.education ?? []).length > 0 ? `Education:\n${(profile.education ?? []).map(e =>
  `  • ${e.degree} — ${e.institution} (${e.dates})`
).join('\n')}` : ''}

${(profile.contextNotes ?? []).length > 0 ? `Additional context:\n${(profile.contextNotes ?? []).map(n =>
  `  ${n.label ? n.label + ': ' : ''}${n.content}`
).join('\n')}` : ''}`

  return `You are a professional CV writer producing tailored job application documents.

Important: where multiple roles appear at the same company, treat them as internal progression — not job-hopping. Reflect the full company tenure and growth trajectory in the CV.

## Candidate Profile
${profileBlock}

## Target Role
Title: ${job.title}
Company: ${job.company}
Description:
${job.description.slice(0, 5000)}

## Tailoring Instructions
${context || 'No specific instructions — use your judgement to highlight the most relevant experience and skills for this role.'}

${outputFormat}`
}

export function buildSignalExtractionPrompt(job: ScrapedJob, profile: MasterProfile): string {
  const exps = (profile.experiences ?? []).map(e =>
    `- ${e.title} at ${e.company} (${e.dates}): ${(e.bullets ?? []).slice(0, 2).join(' | ')}`
  ).join('\n')

  const projects = (profile.projects ?? []).map(p =>
    `- ${p.name}: ${p.description}`
  ).join('\n')

  return `You are a senior technical recruiter preparing a CV writer for a specific job application.

Analyze the job description and candidate background, then output a structured signal brief to guide CV generation.

## Job
Title: ${job.title}
Company: ${job.company}
Description:
${job.description.slice(0, 3000)}

## Candidate
Summary: ${profile.summary}
Experience:
${exps}
${projects ? `\nProjects:\n${projects}` : ''}

## Task
Return ONLY valid JSON with this exact shape — no markdown, no explanation:
{
  "seniority": "inferred seniority level this role expects",
  "companyType": "startup | scaleup | enterprise | agency",
  "coreStack": ["top 5 tech from the JD the candidate has"],
  "architectureSignals": ["key architecture / system design themes the JD emphasizes"],
  "emphasize": ["3-5 specific experiences or projects from the candidate to foreground — be specific"],
  "deprioritize": ["1-3 things to downplay or omit — e.g. junior work, irrelevant tech"],
  "toneAndStyle": "one sentence describing tone — e.g. pragmatic startup engineer, scaled platform builder"
}`
}

export function buildJobParsePrompt(rawText: string, url: string): string {
  return `You are parsing a job posting page. Extract the job details from the raw page text below.

URL: ${url}

Return ONLY valid JSON — no markdown fencing, no explanation:
{
  "title": "exact job title",
  "company": "company name",
  "location": "location or 'Remote'",
  "salary": "salary or compensation range if mentioned, otherwise empty string",
  "description": "full job description text, preserving requirements and responsibilities"
}

Use empty strings for anything you cannot find. Keep description complete — do not summarise it.

Page text:
${rawText}`
}

export function buildProjectExtractPrompt(description: string): string {
  return `Extract a structured project entry from this description. Return ONLY valid JSON, no markdown fencing:

{
  "name": "short project name",
  "description": "2-4 sentence description highlighting what was built, tech used, and impact",
  "tags": ["tech1", "tech2", "tech3"]
}

Be specific about technologies. Infer a good project name if not stated. Keep description concise but technically detailed.

Description:
${description}`
}

export function buildFormFillPrompt(
  fields: import('../../types').FormField[],
  profile: MasterProfile,
  coverLetter: string
): string {
  const fillable = fields.filter(f => f.type !== 'file' && f.type !== 'radio' && f.type !== 'checkbox')
  if (!fillable.length) return ''

  const fieldList = fillable.map(f =>
    `- selector: "${f.selector}" | label: "${f.label}" | type: ${f.type}${f.required ? ' | required' : ''}${f.isEssayQuestion ? ' | essay' : ''}`
  ).join('\n')

  const basics = profile.basics
  const contextAnswers = (profile.contextNotes ?? [])
    .map(n => `${n.label ? n.label + ': ' : ''}${n.content}`)
    .join('\n')
  const customBasicsLines = (basics.customFields ?? [])
    .filter(f => f.label && f.value)
    .map(f => `${f.label}: ${f.value}`)
    .join('\n')

  return `You are filling in a job application form. Map the form fields below to the candidate's data.

## Candidate data
Name: ${basics.name}
Email: ${basics.email}
Phone: ${basics.phone}
Location: ${basics.location}
LinkedIn: ${basics.linkedin}
${basics.website ? `Website: ${basics.website}\n` : ''}${customBasicsLines ? customBasicsLines + '\n' : ''}${contextAnswers ? `\nAdditional info (use for questions about notice period, right to work, salary, etc.):\n${contextAnswers}` : ''}

## Cover letter (use for any cover letter or personal statement field)
${coverLetter.slice(0, 1500)}

## Form fields to fill
${fieldList}

## Instructions
Return ONLY a valid JSON object mapping each selector to the value to fill in.
Only include fields you can confidently fill — omit fields where you have no relevant data.
For select fields, return the most appropriate option value as a plain string.
For fields marked as essay, write a thoughtful answer in full sentences using the cover letter and candidate data as context. For cover letter fields, use the full cover letter text verbatim.
Do not include file upload fields.

Example output:
{"#full_name": "Jane Smith", "#email": "jane@example.com", "[name=phone]": "+44 7700 000000"}`
}

export function parseDocsResponse(raw: string, mode: DocMode = 'both'): GeneratedDocuments {
  const cvMatch = raw.match(/## CV\s*([\s\S]+?)(?=## Cover Letter|$)/)
  const clMatch = raw.match(/## Cover Letter\s*([\s\S]+?)$/)
  return {
    cv: mode === 'cover-letter' ? '' : (cvMatch?.[1]?.trim() ?? (mode === 'cv' ? raw : '')),
    coverLetter: clMatch?.[1]?.trim() ?? '',
    generatedAt: Date.now(),
  }
}
