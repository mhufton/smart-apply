import type { MasterProfile, ScrapedJob } from '../../types'

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

export function buildFitPrompt(job: ScrapedJob, profile: MasterProfile): string {
  return `You are evaluating a job candidate's fit for a role. Be honest and analytical.

## Candidate Profile
Name: ${profile.basics.name}
Summary: ${profile.summary}

Experience:
${(profile.experiences ?? []).map(e =>
  `- ${e.title} at ${e.company} (${e.dates})\n  Tags: ${(e.tags ?? []).join(', ')}\n  ${(e.bullets ?? []).slice(0, 2).join(' | ')}`
).join('\n')}

Skills: ${(profile.skills ?? []).join(', ')}

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

export function buildResumeParsePrompt(resumeText: string): string {
  return `Parse the following resume text into a structured JSON object. Return ONLY valid JSON matching this exact shape (no markdown fencing, no explanation):

{
  "basics": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "website": "string"
  },
  "summary": "string",
  "experiences": [
    {
      "id": "exp-1",
      "company": "string",
      "title": "string",
      "dates": "string",
      "bullets": ["string"],
      "tags": ["string"]
    }
  ],
  "skills": ["string"],
  "projects": [
    {
      "id": "proj-1",
      "name": "string",
      "description": "string",
      "tags": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "dates": "string"
    }
  ]
}

Use empty strings for missing fields. Generate sequential IDs like "exp-1", "exp-2" for experiences and "proj-1", "proj-2" for projects. Extract skills as individual tags. Infer tags for experiences from bullet points.

Resume text:
${resumeText}`
}

export function buildDocsPrompt(
  job: ScrapedJob,
  profile: MasterProfile,
  context: string
): string {
  return `You are a professional CV writer. Create a tailored CV and cover letter.

## Candidate Profile
${JSON.stringify(profile, null, 2)}

## Job
Title: ${job.title}
Company: ${job.company}
Description:
${job.description.slice(0, 3000)}

## Tailoring Instructions
${context || 'No specific instructions. Use your judgement to highlight the most relevant experience.'}

## Output format
Produce two sections separated exactly as shown:

## CV
[Full tailored CV in clean markdown. Use ## for sections, bullet points for experience. Keep to 2 pages worth.]

## Cover Letter
[3-4 paragraph cover letter. Professional but not stiff. Don't start with "I am writing to apply for".]

Do not include any other text outside these two sections.`
}
