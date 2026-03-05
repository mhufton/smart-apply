import { useState, useEffect } from 'react'
import type { MasterProfile, Experience, Education } from '../../types'
import { loadProfile, saveProfile } from '../lib/storage'
import { callHaiku, buildResumeParsePrompt } from '../lib/claude'

export default function ProfileTab() {
  const [profile, setProfile] = useState<MasterProfile | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [scraping, setScraping] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadProfile().then(setProfile)
  }, [])

  if (!profile) return null

  function update(patch: Partial<MasterProfile>) {
    setProfile(prev => prev ? { ...prev, ...patch } : prev)
    setSaved(false)
  }

  function updateBasics(patch: Partial<MasterProfile['basics']>) {
    setProfile(prev => prev ? { ...prev, basics: { ...prev.basics, ...patch } } : prev)
    setSaved(false)
  }

  function mergeProfile(existing: MasterProfile, incoming: Partial<MasterProfile>): MasterProfile {
    return {
      basics: {
        name: incoming.basics?.name || existing.basics.name,
        email: incoming.basics?.email || existing.basics.email,
        phone: incoming.basics?.phone || existing.basics.phone,
        location: incoming.basics?.location || existing.basics.location,
        linkedin: incoming.basics?.linkedin || existing.basics.linkedin,
        website: incoming.basics?.website || existing.basics.website,
      },
      summary: incoming.summary || existing.summary,
      experiences: incoming.experiences?.length ? incoming.experiences : existing.experiences,
      skills: incoming.skills?.length
        ? [...new Set([...existing.skills, ...incoming.skills])]
        : existing.skills,
      projects: incoming.projects?.length ? incoming.projects : existing.projects,
      education: incoming.education?.length ? incoming.education : existing.education,
      contextNotes: existing.contextNotes,
    }
  }

  async function handleScrapeLinkedIn() {
    setScraping(true)
    try {
      const result = await chrome.runtime.sendMessage({ type: 'SCRAPE_PROFILE' })
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result && profile) {
        const merged = mergeProfile(profile, result as Partial<MasterProfile>)
        setProfile(merged)
        setSaved(false)
        setError('')
      }
    } catch (e) {
      setError('LinkedIn scrape failed. Make sure you are on a LinkedIn profile page and refresh it.')
      console.error('[Smart Apply] LinkedIn scrape failed:', e)
    } finally {
      setScraping(false)
    }
  }

  async function handleParseResume() {
    if (!resumeText.trim() || !profile) return
    setParsing(true)
    try {
      const prompt = buildResumeParsePrompt(resumeText)
      let raw = ''
      await callHaiku([{ role: 'user', content: prompt }], (chunk) => { raw += chunk })
      const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]) as Partial<MasterProfile>
        const merged = mergeProfile(profile, parsed)
        setProfile(merged)
        setSaved(false)
        setResumeText('')
      }
    } catch (e) {
      setError('Failed to parse resume. Check that your LLM endpoint is running.')
      console.error('[Smart Apply] Resume parse failed:', e)
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      await saveProfile(profile)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  function addExperience() {
    update({
      experiences: [
        ...(profile!.experiences ?? []),
        { id: `exp-${Date.now()}`, company: '', title: '', dates: '', bullets: [''], tags: [] },
      ],
    })
  }

  function updateExperience(id: string, patch: Partial<Experience>) {
    update({
      experiences: (profile!.experiences ?? []).map(e => e.id === id ? { ...e, ...patch } : e),
    })
  }

  function removeExperience(id: string) {
    update({ experiences: (profile!.experiences ?? []).filter(e => e.id !== id) })
  }

  function addSkill() {
    const skill = newSkill.trim()
    if (!skill || (profile!.skills ?? []).includes(skill)) return
    update({ skills: [...(profile!.skills ?? []), skill] })
    setNewSkill('')
  }

  function removeSkill(skill: string) {
    update({ skills: (profile!.skills ?? []).filter(s => s !== skill) })
  }

  function addEducation() {
    update({
      education: [...(profile!.education ?? []), { institution: '', degree: '', dates: '' }],
    })
  }

  function updateEducation(index: number, patch: Partial<Education>) {
    update({
      education: (profile!.education ?? []).map((e, i) => i === index ? { ...e, ...patch } : e),
    })
  }

  function removeEducation(index: number) {
    update({ education: (profile!.education ?? []).filter((_, i) => i !== index) })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Import Actions */}
        <Section title="Import">
          <div className="space-y-3">
            <button
              onClick={handleScrapeLinkedIn}
              disabled={scraping}
              className="btn-secondary w-full"
            >
              {scraping ? 'Scraping...' : 'Scrape LinkedIn page'}
            </button>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mt-2">{error}</p>
            )}

            <div>
              <p className="text-xs text-slate-400 mb-1">Paste resume text</p>
              <textarea
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                placeholder="Paste your resume text here..."
                className="input-base h-24 resize-none w-full"
              />
              <button
                onClick={handleParseResume}
                disabled={parsing || !resumeText.trim()}
                className="btn-secondary w-full mt-2"
              >
                {parsing ? 'Parsing...' : 'Parse resume'}
              </button>
            </div>
          </div>
        </Section>

        {/* Basics */}
        <Section title="Basics">
          <div className="space-y-2">
            {(['name', 'email', 'phone', 'location', 'linkedin', 'website'] as const).map(field => (
              <div key={field}>
                <label className="text-xs text-slate-500 capitalize">{field}</label>
                <input
                  type="text"
                  value={profile.basics[field] ?? ''}
                  onChange={e => updateBasics({ [field]: e.target.value })}
                  className="input-base w-full"
                  placeholder={field}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Summary */}
        <Section title="Summary">
          <textarea
            value={profile.summary}
            onChange={e => update({ summary: e.target.value })}
            placeholder="Professional summary..."
            className="input-base h-24 resize-none w-full"
          />
        </Section>

        {/* Experience */}
        <Section title="Experience">
          <div className="space-y-3">
            {(profile.experiences ?? []).map(exp => (
              <div key={exp.id} className="bg-white/5 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exp.title}
                    onChange={e => updateExperience(exp.id, { title: e.target.value })}
                    placeholder="Title"
                    className="input-base flex-1"
                  />
                  <button
                    onClick={() => removeExperience(exp.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exp.company}
                    onChange={e => updateExperience(exp.id, { company: e.target.value })}
                    placeholder="Company"
                    className="input-base flex-1"
                  />
                  <input
                    type="text"
                    value={exp.dates}
                    onChange={e => updateExperience(exp.id, { dates: e.target.value })}
                    placeholder="Dates"
                    className="input-base w-32"
                  />
                </div>
                <textarea
                  value={(exp.bullets ?? []).join('\n')}
                  onChange={e => updateExperience(exp.id, { bullets: e.target.value.split('\n') })}
                  placeholder="Bullet points (one per line)"
                  className="input-base h-16 resize-none w-full text-xs"
                />
              </div>
            ))}
            <button onClick={addExperience} className="btn-secondary w-full text-xs">
              + Add experience
            </button>
          </div>
        </Section>

        {/* Skills */}
        <Section title="Skills">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(profile.skills ?? []).map(skill => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
              >
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="hover:text-red-400 ml-0.5"
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSkill()}
              placeholder="Add skill..."
              className="input-base flex-1"
            />
            <button onClick={addSkill} className="btn-secondary text-xs px-3">
              Add
            </button>
          </div>
        </Section>

        {/* Education */}
        <Section title="Education">
          <div className="space-y-3">
            {(profile.education ?? []).map((edu, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={edu.institution}
                    onChange={e => updateEducation(i, { institution: e.target.value })}
                    placeholder="Institution"
                    className="input-base flex-1"
                  />
                  <button
                    onClick={() => removeEducation(i)}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={e => updateEducation(i, { degree: e.target.value })}
                    placeholder="Degree"
                    className="input-base flex-1"
                  />
                  <input
                    type="text"
                    value={edu.dates}
                    onChange={e => updateEducation(i, { dates: e.target.value })}
                    placeholder="Dates"
                    className="input-base w-32"
                  />
                </div>
              </div>
            ))}
            <button onClick={addEducation} className="btn-secondary w-full text-xs">
              + Add education
            </button>
          </div>
        </Section>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save profile'}
        </button>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}
