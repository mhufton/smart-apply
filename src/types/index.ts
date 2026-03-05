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
  selector: string
}

export interface ScrapedJob {
  title: string
  company: string
  location: string
  description: string
  platform: 'greenhouse' | 'lever' | 'workday' | 'linkedin' | 'indeed' | 'unknown'
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

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
