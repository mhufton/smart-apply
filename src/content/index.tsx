import type { ExtMessage, ScrapedJob, FormField, MasterProfile } from '../types'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Try selectors in order, return first non-empty text match */
function firstText(...selectors: string[]): string {
  for (const sel of selectors) {
    if (!sel) continue
    const el = document.querySelector<HTMLElement>(sel)
    const text = el?.innerText?.trim() ?? el?.textContent?.trim() ?? ''
    if (text) return text
  }
  return ''
}

// ── Platform-specific scrapers ────────────────────────────────────────────────

function scrapeLinkedInJob() {
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
  const location = firstText(
    '.job-details-jobs-unified-top-card__primary-description-without-tagline .tvm__text',
    '.jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__workplace-type',
  )
  const description = firstText(
    // Job details panel (search results view)
    '.jobs-search__job-details--wrapper .jobs-description-content__text',
    '.jobs-search__job-details--wrapper .jobs-description',
    '.jobs-search__job-details--wrapper #job-details',
    // Standalone job page
    '#job-details',
    '.jobs-description-content__text--stretch',
    '.jobs-description-content__text',
    '.jobs-description',
  )
  return { title, company, location, description }
}

function scrapeGreenhouseJob() {
  const title = firstText('h1.app-title', '.job-post h1', 'h1')
  const company = firstText('[class*="company-name"]', '[class*="company"]')
  const location = firstText('.location', '[class*="location"]')
  const description = firstText(
    '#content .job__description',
    '#content',
    '.job-post__description',
    '[class*="description"]',
  )
  return { title, company, location, description }
}

function scrapeLeverJob() {
  const title = firstText('.posting-headline h2', 'h2', 'h1')
  const company = document.querySelector<HTMLImageElement>('.main-header-logo img')?.alt ?? ''
  const location = firstText('.sort-by-time.posting-category', '[class*="location"]', '.posting-category')
  const description = firstText(
    '.section.page-full-width',
    '[class*="posting-description"]',
    '.content',
  )
  return { title, company, location, description }
}

function scrapeWorkdayJob() {
  const title = firstText(
    '[data-automation-id="jobPostingHeader"]',
    'h2[class*="heading"]',
    'h1',
  )
  const company = firstText('[data-automation-id="company"]', '[class*="company"]')
  const location = firstText('[data-automation-id="locations"]', '[class*="location"]')
  const description = firstText(
    '[data-automation-id="jobPostingDescription"]',
    '[class*="jobDescription"]',
    '[class*="description"]',
  )
  return { title, company, location, description }
}

function scrapeIndeedJob() {
  const title = firstText(
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1',
  )
  const company = firstText(
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"]',
    '.jobsearch-CompanyInfoContainer a',
  )
  const location = firstText(
    '[data-testid="job-location"]',
    '.jobsearch-JobInfoHeader-subtitle [class*="location"]',
  )
  const description = firstText(
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[class*="jobDescription"]',
  )
  return { title, company, location, description }
}

/** Generic fallback — finds the largest content block that looks like a job description */
function scrapeGenericJob() {
  const title = firstText(
    'h1[class*="job"]', 'h1[class*="title"]', 'h1[class*="position"]',
    '[class*="job-title"]', '[class*="jobTitle"]', '[class*="position-title"]',
    'h1',
  )
  const company = firstText(
    '[class*="company-name"]', '[class*="companyName"]', '[class*="employer"]',
    '[itemprop="hiringOrganization"]',
  )
  const location = firstText(
    '[class*="job-location"]', '[class*="jobLocation"]',
    '[itemprop="jobLocation"]', '[class*="location"]',
  )

  // Pick the longest block that looks like a description
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      '#job-description, #jobDescription, [class*="job-description"], [class*="jobDescription"], ' +
      '[class*="job-details"], [class*="jobDetails"], [class*="description"], ' +
      '[itemprop="description"], article, main'
    )
  )
  const description = candidates
    .map(el => el.innerText?.trim() ?? '')
    .filter(t => t.length > 200)
    .sort((a, b) => b.length - a.length)[0] ?? ''

  return { title, company, location, description }
}

// ── Job scrape entry ──────────────────────────────────────────────────────────

function scrapeJobDescription(): Pick<ScrapedJob, 'title' | 'company' | 'location' | 'description'> {
  const platform = detectPlatform()
  switch (platform) {
    case 'linkedin':   return scrapeLinkedInJob()
    case 'greenhouse': return scrapeGreenhouseJob()
    case 'lever':      return scrapeLeverJob()
    case 'workday':    return scrapeWorkdayJob()
    case 'indeed':     return scrapeIndeedJob()
    default:           return scrapeGenericJob()
  }
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

// ── LinkedIn Profile Scraping ─────────────────────────────────────────────────

function scrapeLinkedInProfile(): Partial<MasterProfile> {
  const getText = (selector: string): string =>
    document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? ''

  const name = getText('h1') || getText('.text-heading-xlarge')
  const headline = getText('.text-body-medium') || getText('[data-generated-suggestion-target]')
  const profileLocation = getText('.text-body-small .inline-block') || ''

  // Scrape experience section
  const experiences: MasterProfile['experiences'] = []
  const expSection = document.querySelector('#experience')?.closest('section')
    ?? document.querySelector('[id*="experience"]')?.closest('section')
  if (expSection) {
    const items = expSection.querySelectorAll(':scope > div > ul > li')
    items.forEach((item, i) => {
      const titleEl = item.querySelector('.t-bold span, [class*="t-bold"] span')
      const companyEl = item.querySelector('.t-normal span, [class*="t-normal"] span')
      const datesEl = item.querySelector('.t-black--light span, [class*="date-range"] span')
      const descEl = item.querySelector('.inline-show-more-text span, [class*="description"] span')

      const title = titleEl?.textContent?.trim() ?? ''
      const company = companyEl?.textContent?.trim() ?? ''
      const dates = datesEl?.textContent?.trim() ?? ''
      const desc = descEl?.textContent?.trim() ?? ''

      if (title || company) {
        experiences.push({
          id: `exp-${i + 1}`,
          company,
          title,
          dates,
          bullets: desc ? desc.split('\n').map(b => b.trim()).filter(Boolean) : [],
          tags: [],
        })
      }
    })
  }

  // Scrape education section
  const education: MasterProfile['education'] = []
  const eduSection = document.querySelector('#education')?.closest('section')
    ?? document.querySelector('[id*="education"]')?.closest('section')
  if (eduSection) {
    const items = eduSection.querySelectorAll(':scope > div > ul > li')
    items.forEach((item) => {
      const institution = item.querySelector('.t-bold span, [class*="t-bold"] span')?.textContent?.trim() ?? ''
      const degree = item.querySelector('.t-normal span, [class*="t-normal"] span')?.textContent?.trim() ?? ''
      const dates = item.querySelector('.t-black--light span, [class*="date-range"] span')?.textContent?.trim() ?? ''
      if (institution) {
        education.push({ institution, degree, dates })
      }
    })
  }

  // Scrape skills section
  const skills: string[] = []
  const skillsSection = document.querySelector('#skills')?.closest('section')
    ?? document.querySelector('[id*="skills"]')?.closest('section')
  if (skillsSection) {
    skillsSection.querySelectorAll('.t-bold span, [class*="t-bold"] span').forEach((el) => {
      const skill = el.textContent?.trim()
      if (skill && !skills.includes(skill)) skills.push(skill)
    })
  }

  // Extract LinkedIn URL
  const linkedin = window.location.href.includes('linkedin.com/in/')
    ? window.location.href.split('?')[0]
    : ''

  return {
    basics: {
      name,
      email: '',
      phone: '',
      location: profileLocation,
      linkedin,
    },
    summary: headline,
    experiences,
    education,
    skills,
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
  if (message.type === 'SCRAPE_PROFILE') {
    const profile = scrapeLinkedInProfile()
    sendResponse(profile)
    return false
  }
  if (message.type === 'INJECT_FIELDS') {
    injectFields(message.payload)
    sendResponse({ ok: true })
    return false
  }
  return false
})
