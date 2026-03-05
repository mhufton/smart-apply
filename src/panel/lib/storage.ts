import type { MasterProfile } from '../../types'

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

export async function loadProfile(): Promise<MasterProfile> {
  const result = await chrome.storage.local.get('masterProfile')
  const stored = result.masterProfile
  if (!stored) return DEFAULT_PROFILE
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    basics: { ...DEFAULT_PROFILE.basics, ...stored.basics },
    experiences: stored.experiences ?? [],
    skills: stored.skills ?? [],
    projects: stored.projects ?? [],
    education: stored.education ?? [],
    contextNotes: stored.contextNotes ?? [],
  }
}

export async function saveProfile(profile: MasterProfile): Promise<void> {
  await chrome.storage.local.set({ masterProfile: profile })
}
