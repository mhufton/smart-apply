import type { ExtMessage, ScrapedJob, FormField } from '../types'

console.log('[Smart Apply] content script loaded')

// ── Job Scraping ──────────────────────────────────────────────────────────────

function detectPlatform(): ScrapedJob['platform'] {
  const host = location.hostname
  if (host.includes('greenhouse.io') || document.querySelector('.greenhouse-job')) return 'greenhouse'
  if (host.includes('lever.co')) return 'lever'
  if (host.includes('workday.com') || document.querySelector('[data-automation-id]')) return 'workday'
  if (host.includes('linkedin.com')) return 'linkedin'
  if (host.includes('indeed.com')) return 'indeed'
  return 'unknown'
}

function scrapeFormFields(): FormField[] {
  const fields: FormField[] = []
  const inputs = document.querySelectorAll<HTMLElement>('input, textarea, select')

  inputs.forEach((el, i) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

    // Skip hidden / honeypot fields
    if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') return

    // Find nearest label text
    let label = ''
    const id = input.id
    if (id) {
      const labelEl = document.querySelector(`label[for="${id}"]`)
      if (labelEl) label = labelEl.textContent?.trim() ?? ''
    }
    if (!label) {
      const wrapper = input.closest('div, li, fieldset')
      if (wrapper) {
        const labelEl = wrapper.querySelector('label, legend, [class*="label"], [class*="title"]')
        if (labelEl) label = labelEl.textContent?.trim() ?? ''
      }
    }
    if (!label) label = input.getAttribute('placeholder') ?? input.getAttribute('aria-label') ?? `Field ${i}`

    const tagName = el.tagName.toLowerCase()
    let type: FormField['type'] = 'unknown'
    if (tagName === 'textarea') type = 'textarea'
    else if (tagName === 'select') type = 'select'
    else {
      const t = (input as HTMLInputElement).type
      if (t === 'text' || t === 'email' || t === 'tel' || t === 'url') type = 'text'
      else if (t === 'file') type = 'file'
      else if (t === 'checkbox') type = 'checkbox'
      else if (t === 'radio') type = 'radio'
    }

    fields.push({
      label,
      type,
      name: input.name,
      id,
      required: (input as HTMLInputElement).required,
      selector: id ? `#${id}` : `[name="${input.name}"]`,
    })
  })

  return fields
}

function scrapeJobDescription(): Pick<ScrapedJob, 'title' | 'company' | 'location' | 'description'> {
  const titleEl = document.querySelector<HTMLElement>(
    'h1, [class*="job-title"], [class*="jobTitle"], [data-automation-id="jobPostingHeader"]'
  )
  const title = titleEl?.textContent?.trim() ?? document.title

  const descEl = document.querySelector<HTMLElement>(
    '[class*="job-description"], [class*="jobDescription"], [class*="description"], #job-description, .description'
  )
  const description = descEl?.innerText?.trim() ?? ''

  const companyEl = document.querySelector<HTMLElement>(
    '[class*="company"], [class*="employer"], [data-automation-id="companyName"]'
  )
  const company = companyEl?.textContent?.trim() ?? ''

  const locationEl = document.querySelector<HTMLElement>(
    '[class*="location"], [data-automation-id="location"]'
  )
  const location = locationEl?.textContent?.trim() ?? ''

  return { title, company, location, description }
}

function scrapeJob(): ScrapedJob {
  return {
    ...scrapeJobDescription(),
    platform: detectPlatform(),
    url: location.href,
    formFields: scrapeFormFields(),
    scrapedAt: Date.now(),
  }
}

// ── Field Injection ───────────────────────────────────────────────────────────

function injectFields(values: Record<string, string>) {
  for (const [selector, value] of Object.entries(values)) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
    if (!el) continue

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set

    nativeInputValueSetter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

// ── Message Listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtMessage, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB') {
    const job = scrapeJob()
    sendResponse(job)
    return false
  }
  if (message.type === 'INJECT_FIELDS') {
    injectFields(message.payload)
    sendResponse({ ok: true })
    return false
  }
  return false
})
