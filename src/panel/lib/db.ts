import Dexie, { type Table } from 'dexie'
import type { MasterProfile, DocHistoryEntry, ScrapedJob, FitAnalysis, ApplicationEntry } from '../../types'

// ── Row types ─────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: 1  // singleton — always stored with id=1
  data: MasterProfile
}

export interface JobRow extends ScrapedJob {
  id?: number          // auto-incremented
  fitAnalysis?: FitAnalysis
}

// DocHistoryEntry already has a string id — stored as-is

// ── Database ──────────────────────────────────────────────────────────────────

class SmartApplyDB extends Dexie {
  profile!:      Table<ProfileRow,       number>
  docHistory!:   Table<DocHistoryEntry,  string>
  jobs!:         Table<JobRow,           number>
  applications!: Table<ApplicationEntry, string>

  constructor() {
    super('SmartApplyDB')

    this.version(1).stores({
      profile:    'id',
      docHistory: 'id, generatedAt, jobTitle, jobCompany',
      jobs:       '++id, scrapedAt, platform, title, company',
    })

    this.version(2).stores({
      profile:    'id',
      docHistory: 'id, generatedAt, jobTitle, jobCompany',
      jobs:       '++id, scrapedAt, platform, title, company, url',
    })

    this.version(3).stores({
      profile:      'id',
      docHistory:   'id, generatedAt, jobTitle, jobCompany',
      jobs:         '++id, scrapedAt, platform, title, company, url',
      applications: 'id, createdAt, updatedAt, jobUrl, jobCompany, status',
    })
  }
}

export const db = new SmartApplyDB()

// ── Application helpers ───────────────────────────────────────────────────────

export async function upsertApplication(
  job: ScrapedJob,
  cvSnapshot: string,
  coverLetterSnapshot: string,
  fitScore?: number
): Promise<void> {
  if (!cvSnapshot) return  // only track when a CV was generated

  const now = Date.now()
  const existing = job.url
    ? await db.applications.where('jobUrl').equals(job.url).first()
    : undefined

  if (existing) {
    await db.applications.update(existing.id, {
      cvSnapshot,
      coverLetterSnapshot,
      updatedAt: now,
      ...(fitScore !== undefined && { fitScore }),
    })
  } else {
    const entry: ApplicationEntry = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      jobTitle: job.title,
      jobCompany: job.company,
      jobLocation: job.location,
      jobUrl: job.url,
      jobPlatform: job.platform,
      fitScore,
      status: 'applied',
      cvSnapshot,
      coverLetterSnapshot,
      notes: '',
      interviews: [],
      contacts: [],
      tags: [],
    }
    await db.applications.add(entry)
  }
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationEntry['status']
): Promise<void> {
  await db.applications.update(id, { status, updatedAt: Date.now() })
}

export async function updateApplicationNotes(id: string, notes: string): Promise<void> {
  await db.applications.update(id, { notes, updatedAt: Date.now() })
}

export async function deleteApplication(id: string): Promise<void> {
  await db.applications.delete(id)
}

export async function loadApplications(): Promise<ApplicationEntry[]> {
  return db.applications.orderBy('createdAt').reverse().toArray()
}

// ── One-time migration from chrome.storage.local ──────────────────────────────

const MIGRATION_KEY = 'sa_migrated_v1'
const HISTORY_MIGRATION_KEY = 'sa_migrated_history_v1'

export async function runMigrationIfNeeded(): Promise<void> {
  const result = await chrome.storage.local.get(MIGRATION_KEY)
  if (result[MIGRATION_KEY]) return

  console.log('[Smart Apply] Migrating chrome.storage.local → Dexie')

  const stored = await chrome.storage.local.get(['masterProfile', 'docHistory'])

  if (stored.masterProfile) {
    await db.profile.put({ id: 1, data: stored.masterProfile })
  }

  if (Array.isArray(stored.docHistory) && stored.docHistory.length > 0) {
    await db.docHistory.bulkPut(stored.docHistory)
  }

  await chrome.storage.local.set({ [MIGRATION_KEY]: true })
  console.log('[Smart Apply] Migration complete')
}

// Migrate old docHistory entries into the applications table (one-time)
export async function migrateDocHistoryToApplications(): Promise<void> {
  const result = await chrome.storage.local.get(HISTORY_MIGRATION_KEY)
  if (result[HISTORY_MIGRATION_KEY]) return

  const history = await db.docHistory.toArray()
  if (history.length === 0) {
    await chrome.storage.local.set({ [HISTORY_MIGRATION_KEY]: true })
    return
  }
  const entries: ApplicationEntry[] = history.map(h => {
    const entry: ApplicationEntry = {
      id: crypto.randomUUID(),
      createdAt: h.generatedAt,
      updatedAt: h.generatedAt,
      jobTitle: h.jobTitle,
      jobCompany: h.jobCompany,
      jobUrl: `legacy:${h.id}`,
      jobPlatform: 'unknown',
      status: 'applied',
      cvSnapshot: h.cv,
      coverLetterSnapshot: h.coverLetter,
      notes: '',
      interviews: [],
      contacts: [],
      tags: [],
    }
    return entry
  })

  await db.applications.bulkAdd(entries)
  await chrome.storage.local.set({ [HISTORY_MIGRATION_KEY]: true })
  console.log('[Smart Apply] Migrated', entries.length, 'doc history entries to applications')
}
