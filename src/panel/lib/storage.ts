import type { MasterProfile, DocHistoryEntry } from '../../types'
import { db } from './db'

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
