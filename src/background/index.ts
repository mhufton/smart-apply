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
  function firstText(...selectors: string[]): string {
    for (const sel of selectors) {
      if (!sel) continue
      const el = document.querySelector(sel) as HTMLElement | null
      const text = el?.innerText?.trim() ?? el?.textContent?.trim() ?? ''
      if (text) return text
    }
    return ''
  }

  const title = firstText(
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h1',
    '.t-24.t-bold.inline',
    'h1',
  )
  const company = firstText(
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
  )
  const jobLocation = firstText(
    '.job-details-jobs-unified-top-card__primary-description-without-tagline .tvm__text',
    '.jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__workplace-type',
  )
  const description = firstText(
    '.jobs-search__job-details--wrapper .jobs-description-content__text',
    '.jobs-search__job-details--wrapper .jobs-description',
    '.jobs-search__job-details--wrapper #job-details',
    '#job-details',
    '.jobs-description-content__text--stretch',
    '.jobs-description-content__text',
    '.jobs-description',
  )

  // Inline form field scraping
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

  return { title, company, location: jobLocation, description, platform: 'linkedin', url: location.href, formFields, scrapedAt: Date.now() }
}

// Self-contained: runs inside the page context via executeScript
function linkedInScrapeProfile() {
  const getText = (selector: string): string =>
    (document.querySelector(selector) as HTMLElement | null)?.textContent?.trim() ?? ''

  const name = getText('h1') || getText('.text-heading-xlarge')
  const headline = getText('.text-body-medium') || getText('[data-generated-suggestion-target]')
  const profileLocation = getText('.text-body-small .inline-block') || ''

  const experiences: Array<{ id: string; company: string; title: string; dates: string; bullets: string[]; tags: string[] }> = []
  const expSection = document.querySelector('#experience')?.closest('section')
    ?? document.querySelector('[id*="experience"]')?.closest('section')
  if (expSection) {
    expSection.querySelectorAll(':scope > div > ul > li').forEach((item, itemIdx) => {
      const spans = Array.from(item.querySelectorAll('[aria-hidden="true"]'))
        .map(s => s.textContent?.trim() ?? '')

      if (spans.length === 0) return

      // Grouped item = company with multiple roles underneath.
      // spans[1] is employment type + total duration e.g. "Full-time · 2 yrs 10 mos"
      const isGrouped = spans.length > 3 && (
        /Full-time|Part-time|Contract|Freelance|Self-employed|Internship/.test(spans[1]) ||
        (/·/.test(spans[1]) && /\d+\s*(yr|mo)/.test(spans[1]))
      )

      if (isGrouped) {
        const company = spans[0]
        // Split the remaining spans into sub-role groups separated by empty strings
        const subGroups: string[][] = [[]]
        for (const s of spans.slice(2)) {
          if (s === '') {
            if (subGroups[subGroups.length - 1].length > 0) subGroups.push([])
          } else {
            subGroups[subGroups.length - 1].push(s)
          }
        }
        subGroups.filter(g => g.length > 0).forEach((g, roleIdx) => {
          const title = g[0] ?? ''
          const dates = g[1] ?? ''
          const bullets = g.slice(2).filter(s => s.startsWith('•')).map(s => s.replace(/^•\s*/, '').trim())
          if (title) experiences.push({ id: `exp-${itemIdx}-${roleIdx}`, company, title, dates, bullets, tags: [] })
        })
      } else {
        // Simple single-role item: [title, company (may include "· type"), dates, location?, bullets...]
        const title = spans[0] ?? ''
        const company = (spans[1] ?? '').split('·')[0].trim()
        const dates = spans[2] ?? ''
        const bullets = spans.slice(3).filter(s => s.startsWith('•')).map(s => s.replace(/^•\s*/, '').trim())
        if (title) experiences.push({ id: `exp-${itemIdx}`, company, title, dates, bullets, tags: [] })
      }
    })
  }

  const education: Array<{ institution: string; degree: string; dates: string }> = []
  const eduSection = document.querySelector('#education')?.closest('section')
    ?? document.querySelector('[id*="education"]')?.closest('section')
  if (eduSection) {
    eduSection.querySelectorAll(':scope > div > ul > li').forEach((item) => {
      const institution = item.querySelector('.t-bold span, [class*="t-bold"] span')?.textContent?.trim() ?? ''
      const degree = item.querySelector('.t-normal span, [class*="t-normal"] span')?.textContent?.trim() ?? ''
      const dates = item.querySelector('.t-black--light span, [class*="date-range"] span')?.textContent?.trim() ?? ''
      if (institution) education.push({ institution, degree, dates })
    })
  }

  const skills: string[] = []
  const skillsSection = document.querySelector('#skills')?.closest('section')
    ?? document.querySelector('[id*="skills"]')?.closest('section')
  if (skillsSection) {
    skillsSection.querySelectorAll('.t-bold span, [class*="t-bold"] span').forEach((el) => {
      const skill = el.textContent?.trim()
      if (skill && !skills.includes(skill)) skills.push(skill)
    })
  }

  const linkedin = window.location.href.includes('linkedin.com/in/')
    ? window.location.href.split('?')[0]
    : ''

  return {
    basics: { name, email: '', phone: '', location: profileLocation, linkedin },
    summary: headline,
    experiences,
    education,
    skills,
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
