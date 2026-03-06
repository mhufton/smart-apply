// ── Profile ──────────────────────────────────────────────────────────────────

export interface Experience {
  id: string
  company: string
  title: string
  dates: string
  bullets: string[]
  tags: string[]
}

export interface Project {
  id: string
  name: string
  description: string
  tags: string[]
}

export interface Education {
  institution: string
  degree: string
  dates: string
}

export interface ContextNote {
  id: string
  label: string
  content: string
}

export interface MasterProfile {
  basics: {
    name: string
    email: string
    phone: string
    location: string
    linkedin: string
    website?: string
    customFields?: { label: string; value: string }[]
  }
  summary: string
  experiences: Experience[]
  skills: string[]
  projects: Project[]
  education: Education[]
  contextNotes: ContextNote[]
}

// ── Job Scrape ────────────────────────────────────────────────────────────────

export interface FormField {
  label: string
  type: 'text' | 'textarea' | 'select' | 'file' | 'checkbox' | 'radio' | 'unknown'
  name: string
  id: string
  required: boolean
  isEssayQuestion: boolean
  selector: string
}

export interface ScrapedJob {
  title: string
  company: string
  location: string
  salary?: string
  description: string
  platform: 'greenhouse' | 'lever' | 'workday' | 'linkedin' | 'indeed' | 'amazon' | 'ziprecruiter' | 'unknown'
  url: string
  formFields: FormField[]
  scrapedAt: number
}

// ── Fit Analysis ──────────────────────────────────────────────────────────────

export interface FitSignal {
  area: string          // e.g. "Machine Learning", "Leadership", "React"
  match: 'strong' | 'partial' | 'missing'
  note: string
}

export interface FitAnalysis {
  score: number         // 0–100
  headline: string      // one-line summary, e.g. "Strong technical fit, gap in fintech domain"
  signals: FitSignal[]
  greenFlags: string[]
  redFlags: string[]
  suggestedAngles: string[]   // "lean into X", "don't mention Y"
  analyzedAt: number
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface GeneratedDocuments {
  cv: string            // markdown
  coverLetter: string   // markdown
  generatedAt: number
}

// ── Messaging ─────────────────────────────────────────────────────────────────

export type ExtMessage =
  | { type: 'SCRAPE_JOB' }
  | { type: 'SCRAPE_PROFILE' }
  | { type: 'INJECT_FIELDS'; payload: Record<string, string> }

// ── Document History ──────────────────────────────────────────────────────────

export interface DocHistoryEntry {
  id: string
  generatedAt: number
  jobTitle: string
  jobCompany: string
  cv: string           // empty string if not generated
  coverLetter: string  // empty string if not generated
}

// ── Application Tracker ───────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'archived'

export interface InterviewStage {
  id: string
  label: string
  scheduledAt?: number
  completedAt?: number
  notes?: string
}

export interface ApplicationContact {
  id: string
  name: string
  role?: string
  email?: string
  linkedin?: string
  notes?: string
}

export interface ApplicationEntry {
  // Identity
  id: string
  createdAt: number
  updatedAt: number

  // Job
  jobTitle: string
  jobCompany: string
  jobLocation?: string
  jobUrl: string                      // dedup key
  jobPlatform: ScrapedJob['platform']
  fitScore?: number                   // snapshot at time of generation

  // Status
  status: ApplicationStatus

  // Document snapshots
  cvSnapshot: string
  coverLetterSnapshot: string

  // Notes
  notes: string

  // Future-proofing (no UI yet)
  appliedAt?: number
  interviews: InterviewStage[]
  contacts: ApplicationContact[]
  salaryExpected?: string
  salaryOffered?: string
  offerDeadline?: number
  rejectedAt?: number
  tags: string[]
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
