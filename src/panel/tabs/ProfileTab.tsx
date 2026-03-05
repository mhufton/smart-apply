import { useState, useEffect } from 'react'
import type { MasterProfile, Experience, Education, Project, ContextNote } from '../../types'
import { loadProfile, saveProfile } from '../lib/storage'
import { callHaiku, buildResumeParsePrompt, buildLinkedInParsePrompt, buildProjectExtractPrompt } from '../lib/claude'
import Spinner from '../components/Spinner'

export default function ProfileTab() {
  const [profile, setProfile] = useState<MasterProfile | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [scraping, setScraping] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [projectBlurb, setProjectBlurb] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProfile().then(setProfile)
  }, [])

  if (!profile) return null

  const hasProfile = !!(profile.basics.name || profile.experiences?.length)
  const [showImport, setShowImport] = useState(!hasProfile)

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
      if (result?.error) { setError(result.error); return }
      if (!result || !profile) return

      // Background now returns raw text — parse it with Haiku
      const prompt = buildLinkedInParsePrompt(result)
      let raw = ''
      await callHaiku([{ role: 'user', content: prompt }], chunk => { raw += chunk })
      const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]) as Partial<MasterProfile>
        // Prefer scraped basics (name, location, linkedin url) over Haiku's output
        parsed.basics = {
          email: '', phone: '',
          ...parsed.basics,
          name: result.name || parsed.basics?.name || '',
          location: result.location || parsed.basics?.location || '',
          linkedin: result.linkedin || parsed.basics?.linkedin || '',
        }
        const merged = mergeProfile(profile, parsed)
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
      setError(e instanceof Error ? e.message : 'Failed to parse resume.')
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

  async function handleExtractProject() {
    if (!projectBlurb.trim() || !profile) return
    setExtracting(true)
    try {
      const prompt = buildProjectExtractPrompt(projectBlurb)
      let raw = ''
      await callHaiku([{ role: 'user', content: prompt }], (chunk) => { raw += chunk })
      const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]) as Partial<Project>
        const project: Project = {
          id: `proj-${Date.now()}`,
          name: parsed.name ?? 'Untitled project',
          description: parsed.description ?? '',
          tags: parsed.tags ?? [],
        }
        update({ projects: [...(profile.projects ?? []), project] })
        setProjectBlurb('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to extract project.')
    } finally {
      setExtracting(false)
    }
  }

  function addProject() {
    update({
      projects: [
        ...(profile!.projects ?? []),
        { id: `proj-${Date.now()}`, name: '', description: '', tags: [] },
      ],
    })
  }

  function updateProject(id: string, patch: Partial<Project>) {
    update({ projects: (profile!.projects ?? []).map(p => p.id === id ? { ...p, ...patch } : p) })
  }

  function removeProject(id: string) {
    update({ projects: (profile!.projects ?? []).filter(p => p.id !== id) })
  }

  function addContextNote() {
    update({
      contextNotes: [
        ...(profile!.contextNotes ?? []),
        { id: `note-${Date.now()}`, label: '', content: '' },
      ],
    })
  }

  function updateContextNote(id: string, patch: Partial<ContextNote>) {
    update({ contextNotes: (profile!.contextNotes ?? []).map(n => n.id === id ? { ...n, ...patch } : n) })
  }

  function removeContextNote(id: string) {
    update({ contextNotes: (profile!.contextNotes ?? []).filter(n => n.id !== id) })
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
        {showImport ? (
          <Section title="Import">
            <div className="space-y-3">
              <button
                onClick={handleScrapeLinkedIn}
                disabled={scraping}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {scraping && <Spinner className="w-3 h-3" />}
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
                  className="btn-secondary w-full mt-2 flex items-center justify-center gap-2"
                >
                  {parsing && <Spinner className="w-3 h-3" />}
                  {parsing ? 'Parsing...' : 'Parse resume'}
                </button>
              </div>

              {hasProfile && (
                <button onClick={() => setShowImport(false)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 w-full text-center transition-colors">
                  Hide import
                </button>
              )}
            </div>
          </Section>
        ) : (
          <button
            onClick={() => setShowImport(true)}
            className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-center py-1"
          >
            + Re-import from LinkedIn or resume
          </button>
        )}

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
              <div key={exp.id} className="bg-slate-100 dark:bg-white/5 rounded-lg p-3 space-y-2">
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
              <div key={i} className="bg-slate-100 dark:bg-white/5 rounded-lg p-3 space-y-2">
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

        {/* Projects */}
        <Section title="Projects & Side Work">
          <div className="space-y-3">
            {/* Quick-extract from blurb */}
            <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-lg p-3 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Describe something you built in plain English — Claude will extract it as a structured project.
              </p>
              <textarea
                value={projectBlurb}
                onChange={e => setProjectBlurb(e.target.value)}
                placeholder="e.g. I built an AI summary app that lives in the iOS/Android share sheet, using Google Cloud and a self-hosted Vertex AI backend running Gemini..."
                className="input-base h-20 resize-none w-full"
              />
              <button
                onClick={handleExtractProject}
                disabled={extracting || !projectBlurb.trim()}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {extracting && <Spinner className="w-3 h-3" />}
                {extracting ? 'Extracting...' : 'Add as project'}
              </button>
            </div>

            {/* Project list */}
            {(profile.projects ?? []).map(proj => (
              <div key={proj.id} className="bg-slate-100 dark:bg-white/5 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={proj.name}
                    onChange={e => updateProject(proj.id, { name: e.target.value })}
                    placeholder="Project name"
                    className="input-base flex-1"
                  />
                  <button
                    onClick={() => removeProject(proj.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={proj.description}
                  onChange={e => updateProject(proj.id, { description: e.target.value })}
                  placeholder="What you built, how, and why it matters..."
                  className="input-base h-16 resize-none w-full text-xs"
                />
                <input
                  type="text"
                  value={(proj.tags ?? []).join(', ')}
                  onChange={e => updateProject(proj.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="Tags: React, Python, AWS..."
                  className="input-base w-full text-xs"
                />
              </div>
            ))}
            <button onClick={addProject} className="btn-secondary w-full text-xs">
              + Add project manually
            </button>
          </div>
        </Section>

        {/* Context Notes */}
        <Section title="Context Notes">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 leading-relaxed">
            Freeform notes fed directly into CV and cover letter generation. Use these for things that don't fit neatly elsewhere — gaps, career pivots, things you want to emphasise or avoid.
          </p>
          <div className="space-y-3">
            {(profile.contextNotes ?? []).map(note => (
              <div key={note.id} className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={note.label}
                    onChange={e => updateContextNote(note.id, { label: e.target.value })}
                    placeholder="Label, e.g. 'Career pivot' or 'Don't mention'"
                    className="input-base flex-1 text-xs"
                  />
                  <button
                    onClick={() => removeContextNote(note.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={note.content}
                  onChange={e => updateContextNote(note.id, { content: e.target.value })}
                  placeholder="Write anything useful for Claude to know..."
                  className="input-base h-16 resize-none w-full text-xs"
                />
              </div>
            ))}
            <button onClick={addContextNote} className="btn-secondary w-full text-xs">
              + Add note
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
    <div className="bg-black/[0.02] dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}
