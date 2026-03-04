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
  return result.masterProfile ?? DEFAULT_PROFILE
}

export async function saveProfile(profile: MasterProfile): Promise<void> {
  await chrome.storage.local.set({ masterProfile: profile })
}
