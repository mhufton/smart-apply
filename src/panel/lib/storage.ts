import type { MasterProfile, DocHistoryEntry, ScrapedJob, FitAnalysis } from '../../types'
import { db, type JobRow } from './db'

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: MasterProfile = {
  basics: {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
  },
  summary: '',
  experiences: [],
  skills: [],
  projects: [],
  education: [],
  contextNotes: [],
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function loadProfile(): Promise<MasterProfile> {
  const row = await db.profile.get(1)
  if (!row) return DEFAULT_PROFILE
  const stored = row.data
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    basics: { ...DEFAULT_PROFILE.basics, ...stored.basics },
    experiences:  stored.experiences  ?? [],
    skills:       stored.skills       ?? [],
    projects:     stored.projects     ?? [],
    education:    stored.education    ?? [],
    contextNotes: stored.contextNotes ?? [],
  }
}

export async function saveProfile(profile: MasterProfile): Promise<void> {
  await db.profile.put({ id: 1, data: profile })
}

// ── Document history ──────────────────────────────────────────────────────────

const MAX_HISTORY = 50

export async function loadDocHistory(): Promise<DocHistoryEntry[]> {
  return db.docHistory
    .orderBy('generatedAt')
    .reverse()
    .limit(MAX_HISTORY)
    .toArray()
}

export async function appendDocHistory(entry: DocHistoryEntry): Promise<void> {
  await db.docHistory.put(entry)

  // Prune if over limit (keep newest)
  const count = await db.docHistory.count()
  if (count > MAX_HISTORY) {
    const oldest = await db.docHistory
      .orderBy('generatedAt')
      .limit(count - MAX_HISTORY)
      .primaryKeys()
    await db.docHistory.bulkDelete(oldest as string[])
  }
}

export async function deleteDocHistoryEntry(id: string): Promise<void> {
  await db.docHistory.delete(id)
}

// ── Job cache (keyed by URL) ───────────────────────────────────────────────────

export async function getCachedJob(url: string): Promise<JobRow | undefined> {
  return db.jobs.where('url').equals(url).first()
}

export async function upsertCachedJob(job: ScrapedJob, fitAnalysis?: FitAnalysis): Promise<void> {
  const existing = await db.jobs.where('url').equals(job.url).first()
  if (existing?.id !== undefined) {
    await db.jobs.update(existing.id, { ...job, fitAnalysis })
  } else {
    await db.jobs.add({ ...job, fitAnalysis })
  }
}
