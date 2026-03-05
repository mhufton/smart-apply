import Dexie, { type Table } from 'dexie'
import type { MasterProfile, DocHistoryEntry, ScrapedJob, FitAnalysis } from '../../types'

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
  profile!:    Table<ProfileRow,      number>
  docHistory!: Table<DocHistoryEntry, string>
  jobs!:       Table<JobRow,          number>

  constructor() {
    super('SmartApplyDB')

    this.version(1).stores({
      profile:    'id',
      docHistory: 'id, generatedAt, jobTitle, jobCompany',
      jobs:       '++id, scrapedAt, platform, title, company',
    })

    // v2: adds url index on jobs for cache lookup
    this.version(2).stores({
      profile:    'id',
      docHistory: 'id, generatedAt, jobTitle, jobCompany',
      jobs:       '++id, scrapedAt, platform, title, company, url',
    })
  }
}

export const db = new SmartApplyDB()

// ── One-time migration from chrome.storage.local ──────────────────────────────

const MIGRATION_KEY = 'sa_migrated_v1'

export async function runMigrationIfNeeded(): Promise<void> {
  const result = await chrome.storage.local.get(MIGRATION_KEY)
  if (result[MIGRATION_KEY]) return  // already done

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
