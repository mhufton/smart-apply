import { useState, useRef } from 'react'
import type { ScrapedJob, FitAnalysis, GeneratedDocuments, ChatMessage } from '../types'
import { callSonnet, buildDocsPrompt, parseDocsResponse } from './lib/claude'
import { loadProfile, appendDocHistory } from './lib/storage'
import JobTab from './tabs/JobTab'
import ProfileTab from './tabs/ProfileTab'
import DocumentsTab from './tabs/DocumentsTab'
import ChatTab from './tabs/ChatTab'
import SettingsTab from './tabs/SettingsTab'

type Tab = 'job' | 'profile' | 'documents' | 'chat' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'job',       label: 'Job'      },
  { id: 'profile',   label: 'Profile'  },
  { id: 'documents', label: 'Docs'     },
  { id: 'chat',      label: 'Chat'     },
  { id: 'settings',  label: 'Settings' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('job')
  const [job, setJob] = useState<ScrapedJob | null>(null)
  const [fit, setFit] = useState<FitAnalysis | null>(null)
  const [docs, setDocs] = useState<GeneratedDocuments | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [generating, setGenerating] = useState(false)
  const docsRef = useRef<GeneratedDocuments | null>(null)

  // Keep ref in sync so handleGenerateDone can read the final value
  function handleDocsChange(d: GeneratedDocuments) {
    docsRef.current = d
    setDocs(d)
  }

  // Called when JobTab starts generating — immediately show Docs tab
  function handleGenerateStart() {
    setGenerating(true)
    setActiveTab('documents')
  }

  function handleGenerateDone() {
    setGenerating(false)
    const d = docsRef.current
    if (d && job) {
      appendDocHistory({
        id: crypto.randomUUID(),
        generatedAt: Date.now(),
        jobTitle: job.title,
        jobCompany: job.company,
        cv: d.cv,
        coverLetter: d.coverLetter,
      }).catch(console.error)
    }
  }

  // Generate a single missing doc from the Documents tab
  async function handleGenerateMissing(mode: 'cv' | 'cover-letter') {
    if (!job) return
    setGenerating(true)
    try {
      const profile = await loadProfile()
      const prompt = buildDocsPrompt(job, profile, '', mode)
      let raw = ''
      await callSonnet([{ role: 'user', content: prompt }], (chunk) => {
        raw += chunk
        const partial = parseDocsResponse(raw, mode)
        setDocs(prev => {
          const next = prev ? {
            ...prev,
            cv: mode === 'cv' ? partial.cv : prev.cv,
            coverLetter: mode === 'cover-letter' ? partial.coverLetter : prev.coverLetter,
          } : partial
          docsRef.current = next
          return next
        })
      })
      handleGenerateDone()
    } catch (e) {
      console.error('[Smart Apply] Failed to generate missing doc:', e)
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#0f1117] text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-indigo-500 dark:text-indigo-400">Smart Apply</span>
          {job && (
            <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
              {job.title} · {job.company}
            </span>
          )}
        </div>
      </header>

      {/* Fit score banner — shown once analysis is available */}
      {fit && (
        <FitBanner fit={fit} onNavigateToJob={() => setActiveTab('job')} />
      )}

      {/* Tab bar */}
      <nav className="flex border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f] shrink-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              'flex-1 py-2.5 text-xs font-medium tracking-wide transition-colors',
              activeTab === id
                ? 'text-indigo-500 dark:text-indigo-400 border-b-2 border-indigo-500 dark:border-indigo-400 -mb-px'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'profile' && (
          <ProfileTab />
        )}
        {activeTab === 'job' && (
          <JobTab
            job={job}
            fit={fit}
            onJobScraped={setJob}
            onFitAnalyzed={setFit}
            onGenerateDocs={handleDocsChange}
            onGenerateStart={handleGenerateStart}
            onGenerateDone={handleGenerateDone}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab
            docs={docs}
            job={job}
            generating={generating}
            onDocsChange={setDocs}
            onOpenChat={() => setActiveTab('chat')}
            onGenerateMissing={handleGenerateMissing}
          />
        )}
        {activeTab === 'chat' && (
          <ChatTab
            messages={chatMessages}
            docs={docs}
            job={job}
            onMessagesChange={setChatMessages}
            onDocsUpdated={setDocs}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab />
        )}
      </main>
    </div>
  )
}

// ── Fit Banner ────────────────────────────────────────────────────────────────

function FitBanner({ fit, onNavigateToJob }: { fit: FitAnalysis; onNavigateToJob: () => void }) {
  const color =
    fit.score >= 75 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
    : fit.score >= 50 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400'
    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'

  const label =
    fit.score >= 75 ? 'Strong fit'
    : fit.score >= 50 ? 'Partial fit'
    : 'Weak fit'

  return (
    <button
      onClick={onNavigateToJob}
      className={`w-full flex items-center gap-3 px-4 py-2 border-b text-left transition-opacity hover:opacity-80 ${color}`}
    >
      <span className="text-xl font-bold tabular-nums leading-none">{fit.score}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-xs opacity-70 truncate">{fit.headline}</p>
      </div>
      <span className="text-xs opacity-50 shrink-0">details →</span>
    </button>
  )
}
