import type { ExtMessage, ScrapedJob, FormField } from '../types'

const PANEL_ID = 'smart-apply-panel-root'
const PANEL_WIDTH = 'min(33vw, 680px)'
const EASE = '0.3s cubic-bezier(0.4, 0, 0.2, 1)'

console.log('[Smart Apply] content script loaded')

// ── Panel DOM ─────────────────────────────────────────────────────────────────

function createPanel(): HTMLDivElement {
  const container = document.createElement('div')
  container.id = PANEL_ID

  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: PANEL_WIDTH,
    height: '100vh',
    zIndex: '2147483647',   // max z-index
    transform: 'translateX(100%)',
    transition: `transform ${EASE}`,
    boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
    border: 'none',
    overflow: 'hidden',
  })

  const iframe = document.createElement('iframe')
  iframe.src = chrome.runtime.getURL('panel.html')
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  })

  container.appendChild(iframe)
  return container
}

let panelEl: HTMLDivElement | null = null
let isOpen = false

function getOrCreatePanel(): HTMLDivElement {
  if (!panelEl) {
    panelEl = createPanel()
    document.body.appendChild(panelEl)
  }
  return panelEl
}

function openPanel() {
  const panel = getOrCreatePanel()
  panel.style.transform = 'translateX(0)'
  isOpen = true
  // Push page content left so it doesn't hide under the panel
  document.body.style.transition = `margin-right ${EASE}`
  document.body.style.marginRight = PANEL_WIDTH
}

function closePanel() {
  if (!panelEl) return
  panelEl.style.transform = 'translateX(100%)'
  isOpen = false
  document.body.style.marginRight = '0'
}

function togglePanel() {
  console.log('[Smart Apply] togglePanel, isOpen=', isOpen)
  isOpen ? closePanel() : openPanel()
}

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
  // Generic heuristics — platform-specific logic can be added later
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

chrome.runtime.onMessage.addListener((message: ExtMessage) => {
  if (message.type === 'TOGGLE_PANEL') {
    togglePanel()
    return
  }
  if (message.type === 'INJECT_FIELDS') {
    injectFields(message.payload)
    return
  }
})

// The panel iframe posts messages to the parent (content script) for scraping
// because the iframe itself cannot access the host page DOM.
window.addEventListener('message', (event) => {
  if (event.source !== panelEl?.querySelector('iframe')?.contentWindow) return

  if (event.data?.type === 'SA_SCRAPE_REQUEST') {
    const job = scrapeJob()
    event.source?.postMessage({ type: 'SA_SCRAPE_RESULT', payload: job }, '*' as any)
  }

  if (event.data?.type === 'SA_INJECT_REQUEST') {
    injectFields(event.data.payload)
  }

  if (event.data?.type === 'SA_CLOSE_PANEL') {
    closePanel()
  }
})
