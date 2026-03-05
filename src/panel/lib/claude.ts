import type { MasterProfile, ScrapedJob, GeneratedDocuments } from '../../types'

// ── API key ───────────────────────────────────────────────────────────────────

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get('anthropicApiKey')
  return result.anthropicApiKey ?? null
}

export async function saveApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ anthropicApiKey: key })
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove('anthropicApiKey')
}

// ── Core streaming call ───────────────────────────────────────────────────────

export type ApiMessage = { role: 'user' | 'assistant'; content: string }

async function streamAnthropic(
  model: string,
  messages: ApiMessage[],
  onChunk: (text: string) => void,
  maxTokens = 4096
): Promise<void> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('No Anthropic API key set. Add one in the Settings tab.')

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

      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          onChunk(json.delta.text)
        }
      } catch {
        // malformed SSE line — skip
      }
    }
  }
}

// ── Model callers ─────────────────────────────────────────────────────────────

// Haiku — fast, cheap. Used for fit analysis, resume parsing, scraping tasks.
export async function callHaiku(
  messages: ApiMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  return streamAnthropic('claude-haiku-4-5-20251001', messages, onChunk, 4096)
}

// Sonnet — smarter. Used for CV + cover letter generation and chat.
export async function callSonnet(
  messages: ApiMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  return streamAnthropic('claude-sonnet-4-5', messages, onChunk, 8192)
}

// Legacy alias — points to Haiku.
export const callClaude = callHaiku

// ── Prompts ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

function parseMonthYear(str: string): number | null {
  const m = str.trim().toLowerCase().match(/^(\w{3})\s+(\d{4})$/)
  if (!m) return null
  const mo = MONTH_NAMES.indexOf(m[1])
  if (mo === -1) return null
  return new Date(parseInt(m[2]), mo, 1).getTime()
}

function parseDurationMonths(dates: string): number {
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

function fmtYears(months: number): string {
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
[Tailored CV in clean markdown. Use ## for section headings, bullet points for experience. Hard limit: 1–2 pages. Max 3 bullets per role. Omit roles older than 10 years unless exceptional. No filler, no objectives section, no "References available on request".]

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
[Tailored CV in clean markdown. Use ## for section headings, bullet points for experience. Hard limit: 1–2 pages. Max 3 bullets per role. Omit roles older than 10 years unless exceptional. No filler, no objectives section, no "References available on request".]

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

  const profileBlock = `Name: ${profile.basics.name}
Location: ${profile.basics.location || 'not specified'}
LinkedIn: ${profile.basics.linkedin || 'not specified'}
Summary: ${profile.summary || 'not provided'}

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

export function buildJobParsePrompt(rawText: string, url: string): string {
  return `You are parsing a job posting page. Extract the job details from the raw page text below.

URL: ${url}

Return ONLY valid JSON — no markdown fencing, no explanation:
{
  "title": "exact job title",
  "company": "company name",
  "location": "location or 'Remote'",
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

export function parseDocsResponse(raw: string, mode: DocMode = 'both'): GeneratedDocuments {
  const cvMatch = raw.match(/## CV\s*([\s\S]+?)(?=## Cover Letter|$)/)
  const clMatch = raw.match(/## Cover Letter\s*([\s\S]+?)$/)
  return {
    cv: mode === 'cover-letter' ? '' : (cvMatch?.[1]?.trim() ?? (mode === 'cv' ? raw : '')),
    coverLetter: clMatch?.[1]?.trim() ?? '',
    generatedAt: Date.now(),
  }
}
