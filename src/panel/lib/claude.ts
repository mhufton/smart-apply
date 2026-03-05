import type { MasterProfile, ScrapedJob } from '../../types'

// ── Config ────────────────────────────────────────────────────────────────────

interface ClaudeConfig {
  endpoint: string    // local Ollama or Anthropic API
  model: string
  apiKey?: string
}

async function getConfig(): Promise<ClaudeConfig> {
  const result = await chrome.storage.local.get('claudeConfig')
  return result.claudeConfig ?? {
    endpoint: 'http://localhost:11434/v1/chat/completions',  // Ollama OpenAI-compat endpoint
    model: 'llama3.2',
  }
}

// ── Core streaming call ───────────────────────────────────────────────────────

export type ApiMessage = { role: 'user' | 'assistant'; content: string }

export async function callClaude(
  messages: ApiMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  const config = await getConfig()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
    headers['anthropic-version'] = '2023-06-01'
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
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
      const data = line.slice(6)
      if (data === '[DONE]') return

      try {
        const json = JSON.parse(data)
        // OpenAI-compat format (Ollama + Anthropic via proxy)
        const delta = json.choices?.[0]?.delta?.content
        // Native Anthropic streaming format
        const anthropicDelta = json.type === 'content_block_delta' ? json.delta?.text : null
        const text = delta ?? anthropicDelta
        if (text) onChunk(text)
      } catch {
        // Malformed SSE line — skip
      }
    }
  }
}

// ── Prompts ───────────────────────────────────────────────────────────────────

export function buildFitPrompt(job: ScrapedJob, profile: MasterProfile): string {
  return `You are evaluating a job candidate's fit for a role. Be honest and analytical.

## Candidate Profile
Name: ${profile.basics.name}
Summary: ${profile.summary}

Experience:
${(profile.experiences ?? []).map(e =>
  `- ${e.title} at ${e.company} (${e.dates})\n  Tags: ${(e.tags ?? []).join(', ')}\n  ${(e.bullets ?? []).slice(0,2).join(' | ')}`
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
