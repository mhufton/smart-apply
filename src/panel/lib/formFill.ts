import type { FormField } from '../../types'
import { loadProfile } from './storage'
import { callParse, buildFormFillPrompt } from './claude'

export interface FillOutcome {
  message: string
  filled: number
  total: number
}

/**
 * One-hit form fill: re-scrape the current page's fields, map them to
 * profile data (+ optional cover letter) via the parse model, inject.
 */
export async function fillFormOnPage(opts: {
  coverLetter?: string
  fallbackFields?: FormField[]
} = {}): Promise<FillOutcome> {
  // Fresh scrape — the application form may only exist (or have re-rendered)
  // after navigating away from the page the job was scraped on.
  const fresh = await chrome.runtime.sendMessage({ type: 'SCRAPE_FIELDS' })
  const fields: FormField[] = Array.isArray(fresh) && fresh.length > 0
    ? fresh
    : (opts.fallbackFields ?? [])

  const profile = await loadProfile()
  const prompt = buildFormFillPrompt(fields, profile, opts.coverLetter ?? '')
  if (!prompt) return { message: 'No fillable fields found on this page', filled: 0, total: 0 }

  let raw = ''
  await callParse([{ role: 'user', content: prompt }], chunk => { raw += chunk })

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')
  const fieldMap: Record<string, string> = JSON.parse(jsonMatch[0])

  const result = await chrome.runtime.sendMessage({ type: 'INJECT_FIELDS', payload: fieldMap })
  const total = Object.keys(fieldMap).length

  if (result && typeof result.filled === 'number') {
    const missed = result.missed?.length ?? 0
    return {
      message: `Filled ${result.filled}/${total} field${total !== 1 ? 's' : ''}${missed ? ` — ${missed} not found` : ''}`,
      filled: result.filled,
      total,
    }
  }
  return { message: result?.error ?? 'Form filled', filled: total, total }
}
