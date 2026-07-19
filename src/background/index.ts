import type { ExtMessage, FormField } from '../types'

// Open side panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  try {
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch (e) {
    console.warn('[Smart Apply] Cannot open side panel:', e)
  }
})

// ── LinkedIn on-demand injection ──────────────────────────────────────────────
// LinkedIn runs ProtechTs bot-detection. We avoid triggering it by NOT running
// a passive content script there — instead we inject functions only when needed.

function isLinkedIn(url: string | undefined): boolean {
  return !!url && url.includes('linkedin.com')
}

// Self-contained: runs inside the page context via executeScript
function linkedInScrapeJob() {
  // Grab the job details panel text — Haiku will extract structure in the panel
  const jobPanel = document.querySelector('.jobs-search__job-details--wrapper')
    ?? document.querySelector('.job-view-layout')
    ?? document.querySelector('main')
    ?? document.body
  const _rawText = (jobPanel as HTMLElement).innerText
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 10000)

  // Essay question detection — inlined because executeScript serialises this function
  const ESSAY_KW = [
    'cover letter','personal statement','why do you want','why are you','why us','why this',
    'tell us','tell me','describe','explain','what motivates','what interests',
    'additional information','additional comments','anything else','background',
    'experience with','how have you','how do you','what would you',
    'please share','please describe','please explain',
  ]
  function isEssay(label: string, type: string, required: boolean): boolean {
    if (type === 'checkbox' || type === 'radio' || type === 'select' || type === 'file') return false
    const lower = label.toLowerCase()
    if (ESSAY_KW.some(kw => lower.includes(kw))) return true
    if (type === 'textarea' && label.length > 60) return true
    if (type === 'textarea' && required && /^(Field \d+)?$/.test(label.trim())) return true
    return false
  }

  // Inline form field scraping (still DOM-based — needed for injection)
  const formFields: FormField[] = []
  document.querySelectorAll('input, textarea, select').forEach((el, i) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    const inputType = (input as HTMLInputElement).type
    if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') return
    let label = ''
    if (input.id) {
      label = document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() ?? ''
    }
    if (!label) {
      const wrapper = input.closest('div, li, fieldset')
      if (wrapper) {
        label = wrapper.querySelector('label, legend, [class*="label"], [class*="title"]')?.textContent?.trim() ?? ''
      }
    }
    if (!label) label = input.getAttribute('placeholder') ?? input.getAttribute('aria-label') ?? `Field ${i}`
    const tag = el.tagName.toLowerCase()
    let type = 'unknown'
    if (tag === 'textarea') type = 'textarea'
    else if (tag === 'select') type = 'select'
    else {
      if (['text', 'email', 'tel', 'url'].includes(inputType)) type = 'text'
      else if (inputType === 'file') type = 'file'
      else if (inputType === 'checkbox') type = 'checkbox'
      else if (inputType === 'radio') type = 'radio'
    }
    const required = (input as HTMLInputElement).required
    formFields.push({
      label, type: type as FormField['type'], name: input.name, id: input.id,
      required, isEssayQuestion: isEssay(label, type, required),
      selector: input.id ? `#${input.id}` : `[name="${input.name}"]`,
    })
  })

  return { title: '', company: '', location: '', description: '', platform: 'linkedin', url: location.href, formFields, scrapedAt: Date.now(), _rawText }
}

// Self-contained: runs inside the page context via executeScript.
// Returns raw text from each section — the panel will call Haiku to parse it.
function linkedInScrapeProfile() {
  const innerText = (el: Element | null) => (el as HTMLElement | null)?.innerText?.trim() ?? ''

  const name = innerText(document.querySelector('h1') ?? document.querySelector('.text-heading-xlarge'))
  const headline = innerText(document.querySelector('.text-body-medium'))
  const location = innerText(document.querySelector('.text-body-small .inline-block'))
  const linkedin = window.location.href.includes('linkedin.com/in/')
    ? window.location.href.split('?')[0] : ''

  const expSection = (document.querySelector('#experience')?.closest('section')
    ?? document.querySelector('[id*="experience"]')?.closest('section')) ?? null
  const eduSection = (document.querySelector('#education')?.closest('section')
    ?? document.querySelector('[id*="education"]')?.closest('section')) ?? null
  const skillsSection = (document.querySelector('#skills')?.closest('section')
    ?? document.querySelector('[id*="skills"]')?.closest('section')) ?? null

  return {
    _raw: true as const,
    name, headline, location, linkedin,
    expText:    innerText(expSection),
    eduText:    innerText(eduSection),
    skillsText: innerText(skillsSection),
  }
}

// Self-contained: runs inside the page context via executeScript.
// Fresh field scrape for the fill-form flow (options included, tag fallback for selector).
function linkedInScrapeFields() {
  const fields: FormField[] = []
  document.querySelectorAll('input, textarea, select').forEach((el, i) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    const inputType = (input as HTMLInputElement).type
    if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') return
    let label = ''
    if (input.id) {
      label = document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() ?? ''
    }
    if (!label) {
      const wrapper = input.closest('div, li, fieldset')
      if (wrapper) {
        label = wrapper.querySelector('label, legend, [class*="label"], [class*="title"]')?.textContent?.trim() ?? ''
      }
    }
    if (!label) label = input.getAttribute('placeholder') ?? input.getAttribute('aria-label') ?? `Field ${i}`
    const tag = el.tagName.toLowerCase()
    let type = 'unknown'
    if (tag === 'textarea') type = 'textarea'
    else if (tag === 'select') type = 'select'
    else {
      if (['text', 'email', 'tel', 'url'].includes(inputType)) type = 'text'
      else if (inputType === 'file') type = 'file'
      else if (inputType === 'checkbox') type = 'checkbox'
      else if (inputType === 'radio') type = 'radio'
    }
    let selector: string
    if (input.id) selector = `#${CSS.escape(input.id)}`
    else if (input.name) selector = `[name="${input.name.replace(/"/g, '\\"')}"]`
    else {
      input.setAttribute('data-sa-field', String(i))
      selector = `[data-sa-field="${i}"]`
    }
    const options = tag === 'select'
      ? Array.from((input as HTMLSelectElement).options).map(o => o.text.trim()).filter(Boolean).slice(0, 30)
      : undefined
    fields.push({
      label, type: type as FormField['type'], name: input.name, id: input.id,
      required: (input as HTMLInputElement).required, isEssayQuestion: false,
      selector, options,
    })
  })
  return fields
}

// Self-contained: runs inside the page context via executeScript, receives values as arg
function linkedInInjectFields(values: Record<string, string>) {
  let filled = 0
  const missed: string[] = []
  const fireEvents = (el: HTMLElement) => {
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }
  for (const [selector, value] of Object.entries(values)) {
    try {
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) { missed.push(selector); continue }
      if (el instanceof HTMLSelectElement) {
        const target = String(value).trim().toLowerCase()
        const opt = Array.from(el.options).find(o =>
          o.value.trim().toLowerCase() === target || o.text.trim().toLowerCase() === target
        ) ?? Array.from(el.options).find(o =>
          o.text.trim().toLowerCase().includes(target) || target.includes(o.text.trim().toLowerCase())
        )
        if (!opt) { missed.push(selector); continue }
        el.value = opt.value
        fireEvents(el)
        filled++
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
        fireEvents(el)
        filled++
      } else if (el.isContentEditable) {
        el.textContent = value
        fireEvents(el)
        filled++
      } else {
        missed.push(selector)
      }
    } catch {
      missed.push(selector)
    }
  }
  return { filled, missed }
}

async function handleLinkedIn(
  tabId: number,
  message: ExtMessage,
  sendResponse: (response: unknown) => void
) {
  try {
    let results
    if (message.type === 'SCRAPE_JOB') {
      results = await chrome.scripting.executeScript({ target: { tabId }, func: linkedInScrapeJob })
    } else if (message.type === 'SCRAPE_PROFILE') {
      results = await chrome.scripting.executeScript({ target: { tabId }, func: linkedInScrapeProfile })
    } else if (message.type === 'SCRAPE_FIELDS') {
      results = await chrome.scripting.executeScript({ target: { tabId }, func: linkedInScrapeFields })
    } else if (message.type === 'INJECT_FIELDS') {
      results = await chrome.scripting.executeScript({ target: { tabId }, func: linkedInInjectFields, args: [message.payload] })
    }
    sendResponse(results?.[0]?.result ?? { error: 'No result from page' })
  } catch (e) {
    console.warn('[Smart Apply] executeScript failed:', e)
    sendResponse({ error: 'Could not inject into LinkedIn page. Try refreshing.' })
  }
}

// ── Helper: relay to always-on content script (non-LinkedIn) ──────────────────

function relayToContentScript(
  message: ExtMessage,
  sendResponse: (response: unknown) => void
) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id
    if (!tabId) {
      sendResponse({ error: 'No active tab' })
      return
    }
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Smart Apply] Content script not reachable:', chrome.runtime.lastError.message)
        sendResponse({ error: 'Content script not available. Please refresh the page and try again.' })
        return
      }
      sendResponse(response)
    })
  })
}

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtMessage, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB' || message.type === 'SCRAPE_PROFILE' || message.type === 'SCRAPE_FIELDS' || message.type === 'INJECT_FIELDS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.id) {
        sendResponse({ error: 'No active tab' })
        return
      }
      if (isLinkedIn(tab.url)) {
        handleLinkedIn(tab.id, message, sendResponse)
      } else {
        relayToContentScript(message, sendResponse)
      }
    })
    return true // keep channel open for async
  }

  return false
})
