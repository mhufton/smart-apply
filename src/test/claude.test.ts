/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest'
import {
  parseMonthYear,
  parseDurationMonths,
  fmtYears,
  parseDocsResponse,
  buildFitPrompt,

  buildFormFillPrompt,
} from '../panel/lib/claude'
import type { ScrapedJob, MasterProfile, FormField } from '../types'

// ── parseMonthYear ────────────────────────────────────────────────────────────

describe('parseMonthYear', () => {
  it('parses a valid month/year string', () => {
    const ts = parseMonthYear('Jan 2022')
    expect(ts).toBe(new Date(2022, 0, 1).getTime())
  })

  it('is case-insensitive', () => {
    expect(parseMonthYear('jan 2022')).toBe(new Date(2022, 0, 1).getTime())
    expect(parseMonthYear('JAN 2022')).toBe(new Date(2022, 0, 1).getTime())
  })

  it('returns null for an invalid month', () => {
    expect(parseMonthYear('Abc 2022')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseMonthYear('')).toBeNull()
  })

  it('returns null for year-only strings', () => {
    expect(parseMonthYear('2022')).toBeNull()
  })

  it('parses December correctly', () => {
    const ts = parseMonthYear('Dec 2023')
    expect(ts).toBe(new Date(2023, 11, 1).getTime())
  })
})

// ── parseDurationMonths ───────────────────────────────────────────────────────

describe('parseDurationMonths', () => {
  it('parses explicit yr/mo duration string', () => {
    expect(parseDurationMonths('2 yrs 10 mos')).toBe(34)
  })

  it('parses years-only duration', () => {
    expect(parseDurationMonths('3 yrs')).toBe(36)
  })

  it('parses months-only duration', () => {
    expect(parseDurationMonths('11 mos')).toBe(11)
  })

  it('parses a fixed date range', () => {
    const months = parseDurationMonths('Jun 2023 – Jan 2025')
    // Jun 2023 to Jan 2025 = 19 months
    expect(months).toBeGreaterThanOrEqual(18)
    expect(months).toBeLessThanOrEqual(20)
  })

  it('parses a date range with Present', () => {
    // Just verify it returns a positive number (since "Present" is dynamic)
    const months = parseDurationMonths('Jan 2023 – Present')
    expect(months).toBeGreaterThan(0)
  })

  it('returns 0 for empty/unparseable string', () => {
    expect(parseDurationMonths('')).toBe(0)
    expect(parseDurationMonths('unknown')).toBe(0)
  })

  it('prefers explicit duration over date range when both exist', () => {
    // String contains "2 yr" → should use that, not compute from the dates
    expect(parseDurationMonths('Jan 2022 – Jan 2024 · 2 yrs')).toBe(24)
  })
})

// ── fmtYears ──────────────────────────────────────────────────────────────────

describe('fmtYears', () => {
  it('formats months only', () => {
    expect(fmtYears(5)).toBe('5 months')
    expect(fmtYears(1)).toBe('1 month')
  })

  it('formats years only', () => {
    expect(fmtYears(12)).toBe('1 year')
    expect(fmtYears(24)).toBe('2 years')
  })

  it('formats years + months', () => {
    expect(fmtYears(14)).toBe('1 yr 2 mo')
    expect(fmtYears(25)).toBe('2 yr 1 mo')
  })

  it('formats zero months', () => {
    expect(fmtYears(0)).toBe('0 months')
  })
})

// ── parseDocsResponse ─────────────────────────────────────────────────────────

describe('parseDocsResponse', () => {
  const CV_CONTENT = '## Experience\n- Senior Engineer at Acme'
  const CL_CONTENT = 'Dear Hiring Manager,\n\nI am excited...'
  const FULL_RESPONSE = `## CV\n${CV_CONTENT}\n\n## Cover Letter\n${CL_CONTENT}`

  it('parses both sections from a full response', () => {
    const result = parseDocsResponse(FULL_RESPONSE)
    expect(result.cv).toContain('Experience')
    expect(result.coverLetter).toContain('Dear Hiring Manager')
  })

  it('sets generatedAt to a recent timestamp', () => {
    const before = Date.now()
    const result = parseDocsResponse(FULL_RESPONSE)
    expect(result.generatedAt).toBeGreaterThanOrEqual(before)
    expect(result.generatedAt).toBeLessThanOrEqual(Date.now())
  })

  it('mode=cv returns cv content and empty coverLetter', () => {
    const result = parseDocsResponse(`## CV\n${CV_CONTENT}`, 'cv')
    expect(result.cv).toContain('Experience')
    expect(result.coverLetter).toBe('')
  })

  it('mode=cover-letter returns coverLetter and empty cv', () => {
    const result = parseDocsResponse(`## Cover Letter\n${CL_CONTENT}`, 'cover-letter')
    expect(result.cv).toBe('')
    expect(result.coverLetter).toContain('Dear Hiring Manager')
  })

  it('handles missing cover letter section gracefully', () => {
    const result = parseDocsResponse(`## CV\n${CV_CONTENT}`)
    expect(result.cv).toBeTruthy()
    expect(result.coverLetter).toBe('')
  })

  it('handles missing CV section gracefully', () => {
    const result = parseDocsResponse(`## Cover Letter\n${CL_CONTENT}`)
    expect(result.cv).toBe('')
    expect(result.coverLetter).toBeTruthy()
  })
})

// ── buildFitPrompt ────────────────────────────────────────────────────────────

const mockJob: ScrapedJob = {
  title: 'Senior Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  description: 'We need a senior engineer with React and TypeScript experience.',
  platform: 'greenhouse',
  url: 'https://example.com/jobs/123',
  formFields: [],
  scrapedAt: Date.now(),
}

const mockProfile: MasterProfile = {
  basics: { name: 'Jane Smith', email: 'jane@example.com', phone: '+1 555 0000', location: 'NYC', linkedin: 'linkedin.com/in/jane' },
  summary: 'Senior frontend engineer with 8 years of React experience.',
  experiences: [
    {
      id: 'exp-1',
      company: 'Acme Corp',
      title: 'Senior Engineer',
      dates: 'Jan 2022 – Present · 2 yrs 11 mos',
      bullets: ['Led frontend migration to React', 'Reduced bundle size by 40%'],
      tags: ['React', 'TypeScript'],
    },
  ],
  skills: ['React', 'TypeScript', 'Node.js'],
  projects: [],
  education: [{ institution: 'MIT', degree: 'B.Sc. Computer Science', dates: '2015' }],
  contextNotes: [],
}

describe('buildFitPrompt', () => {
  it('includes the job title and company', () => {
    const prompt = buildFitPrompt(mockJob, mockProfile)
    expect(prompt).toContain('Senior Engineer')
    expect(prompt).toContain('Acme Corp')
  })

  it('includes the candidate name', () => {
    const prompt = buildFitPrompt(mockJob, mockProfile)
    expect(prompt).toContain('Jane Smith')
  })

  it('includes key skills', () => {
    const prompt = buildFitPrompt(mockJob, mockProfile)
    expect(prompt).toContain('React')
  })

  it('requests JSON output', () => {
    const prompt = buildFitPrompt(mockJob, mockProfile)
    expect(prompt).toContain('"score"')
    expect(prompt).toContain('"signals"')
  })
})

// ── buildFormFillPrompt ───────────────────────────────────────────────────────

describe('buildFormFillPrompt', () => {
  const fields: FormField[] = [
    { label: 'Full Name', type: 'text', name: 'full_name', id: 'full_name', required: true, selector: '#full_name' },
    { label: 'Email', type: 'text', name: 'email', id: 'email', required: true, selector: '#email' },
    { label: 'Upload CV', type: 'file', name: 'cv_upload', id: 'cv_upload', required: false, selector: '#cv_upload' },
  ]

  it('excludes file fields from the prompt', () => {
    const prompt = buildFormFillPrompt(fields, mockProfile, 'Cover letter text')
    expect(prompt).not.toContain('cv_upload')
  })

  it('includes fillable fields', () => {
    const prompt = buildFormFillPrompt(fields, mockProfile, 'Cover letter text')
    expect(prompt).toContain('#full_name')
    expect(prompt).toContain('#email')
  })

  it('includes the candidate name and email', () => {
    const prompt = buildFormFillPrompt(fields, mockProfile, 'Cover letter text')
    expect(prompt).toContain('Jane Smith')
    expect(prompt).toContain('jane@example.com')
  })

  it('returns empty string when all fields are non-fillable', () => {
    const onlyFile: FormField[] = [
      { label: 'Resume', type: 'file', name: 'resume', id: 'resume', required: false, selector: '#resume' },
    ]
    expect(buildFormFillPrompt(onlyFile, mockProfile, '')).toBe('')
  })
})
