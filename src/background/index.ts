import type { ExtMessage } from '../types'

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

  // Inline form field scraping (still DOM-based — needed for injection)
  const formFields: Array<{ label: string; type: string; name: string; id: string; required: boolean; selector: string }> = []
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
    formFields.push({ label, type, name: input.name, id: input.id, required: (input as HTMLInputElement).required, selector: input.id ? `#${input.id}` : `[name="${input.name}"]` })
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

// Self-contained: runs inside the page context via executeScript, receives values as arg
function linkedInInjectFields(values: Record<string, string>) {
  for (const [selector, value] of Object.entries(values)) {
    const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null
    if (!el) continue
    const nativeSet = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set
    nativeSet?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { ok: true }
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
  if (message.type === 'SCRAPE_JOB' || message.type === 'SCRAPE_PROFILE' || message.type === 'INJECT_FIELDS') {
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
