import { useState, useEffect } from 'react'
import type { GeneratedDocuments, ScrapedJob, DocHistoryEntry } from '../../types'
import Spinner from '../components/Spinner'
import { renderMarkdown } from '../lib/markdown'
import { loadDocHistory, deleteDocHistoryEntry, appendDocHistory, loadProfile } from '../lib/storage'

interface Props {
  docs: GeneratedDocuments | null
  job: ScrapedJob | null
  generating: boolean
  onDocsChange: (docs: GeneratedDocuments) => void
  onOpenChat: () => void
  onGenerateMissing: (mode: 'cv' | 'cover-letter') => void
}

type DocView = 'cv' | 'cover' | 'history'

export default function DocumentsTab({ docs, job, generating, onDocsChange, onOpenChat, onGenerateMissing }: Props) {
  const [view, setView] = useState<DocView>('cv')
  const [editing, setEditing] = useState(false)
  const [injecting, setInjecting] = useState(false)
  const [history, setHistory] = useState<DocHistoryEntry[]>([])
  const [historyPreview, setHistoryPreview] = useState<{ entry: DocHistoryEntry; field: 'cv' | 'coverLetter' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lastName, setLastName] = useState('')

  useEffect(() => {
    loadDocHistory().then(setHistory)
    loadProfile().then(p => {
      const name = p.basics.name.trim()
      setLastName(name.split(' ').pop() ?? name)
    })
  }, [])

  // Refresh history when switching to it, or after new generation
  useEffect(() => {
    if (view === 'history' || !generating) {
      loadDocHistory().then(setHistory)
    }
  }, [view, generating])

  async function handleSaveToHistory() {
    if (!docs) return
    setSaving(true)
    try {
      const entry: DocHistoryEntry = {
        id: crypto.randomUUID(),
        generatedAt: Date.now(),
        jobTitle: job?.title ?? 'Untitled',
        jobCompany: job?.company ?? '',
        cv: docs.cv,
        coverLetter: docs.coverLetter,
      }
      await appendDocHistory(entry)
      const updated = await loadDocHistory()
      setHistory(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!docs) {
    return (
      <div className="h-full flex items-center justify-center text-center px-8">
        <div>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-1">No documents yet</p>
          <p className="text-slate-400 dark:text-slate-600 text-xs">
            Scrape a job on the Job tab and click Generate
          </p>
        </div>
      </div>
    )
  }

  function handleCvChange(value: string) {
    onDocsChange({ ...docs!, cv: value })
  }

  function handleCoverChange(value: string) {
    onDocsChange({ ...docs!, coverLetter: value })
  }

  async function handleInjectIntoForm() {
    if (!job || !docs) return
    setInjecting(true)
    try {
      const fieldMap: Record<string, string> = {}
      for (const field of job.formFields) {
        const label = field.label.toLowerCase()
        if (field.type === 'textarea' && (label.includes('cover') || label.includes('letter'))) {
          fieldMap[field.selector] = docs.coverLetter
        }
        if (field.type === 'textarea' && label.includes('summary')) {
          fieldMap[field.selector] = docs.cv.split('\n\n')[0] ?? ''
        }
      }
      await chrome.runtime.sendMessage({ type: 'INJECT_FIELDS', payload: fieldMap })
    } finally {
      setInjecting(false)
    }
  }

  const activeDoc = view === 'cv' ? docs.cv : docs.coverLetter
  const handleChange = view === 'cv' ? handleCvChange : handleCoverChange
  const docLabel = view === 'cv' ? 'CV' : 'cover letter'
  const missingMode = view === 'cv' ? 'cv' : 'cover-letter'
  const docTitle = view === 'cv' ? 'CV' : 'Cover Letter'

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab */}
      <div className="flex border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f] shrink-0">
        {([['cv', 'CV / Résumé'], ['cover', 'Cover Letter'], ['history', 'History']] as [DocView, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setView(v); setHistoryPreview(null) }}
            className={[
              'flex-1 py-2 text-xs font-medium transition-colors',
              view === v
                ? 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
            ].join(' ')}
          >
            {label}
            {v === 'history' && history.length > 0 && (
              <span className="ml-1 text-[9px] bg-indigo-500/20 text-indigo-400 rounded-full px-1.5 py-0.5">
                {history.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* History view */}
      {view === 'history' && (
        <div className="flex-1 overflow-y-auto">
          {historyPreview ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f] shrink-0">
                <button onClick={() => setHistoryPreview(null)} className="btn-ghost text-xs px-2">← Back</button>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 truncate">
                  {historyPreview.field === 'cv' ? 'CV' : 'Cover Letter'} · {historyPreview.entry.jobTitle} @ {historyPreview.entry.jobCompany}
                </span>
                <button
                  onClick={() => exportToPdf(historyPreview.entry[historyPreview.field], historyPreview.field === 'cv' ? 'CV' : 'Cover-Letter', lastName, historyPreview.entry.jobCompany)}
                  className="btn-secondary text-xs px-2"
                >PDF</button>
                <button
                  onClick={() => {
                    const next = { ...docs!, [historyPreview.field]: historyPreview.entry[historyPreview.field] }
                    onDocsChange(next)
                    setHistoryPreview(null)
                    setView(historyPreview.field === 'cv' ? 'cv' : 'cover')
                  }}
                  className="btn-primary text-xs px-2"
                >Restore</button>
              </div>
              <div
                className="flex-1 overflow-y-auto p-5 bg-white dark:bg-[#0f1117] prose-cv text-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(historyPreview.entry[historyPreview.field]) }}
              />
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {(['cv', 'coverLetter'] as const).map(field => {
                const entries = history.filter(e => e[field])
                const label = field === 'cv' ? 'CVs' : 'Cover Letters'
                return (
                  <div key={field}>
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{label}</h3>
                    {entries.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-600">No {label.toLowerCase()} saved yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {entries.map(entry => (
                          <div key={entry.id} className="flex items-center gap-2 bg-black/[0.02] dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{entry.jobTitle || 'Untitled'}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-600">{entry.jobCompany} · {formatDate(entry.generatedAt)}</p>
                            </div>
                            <button
                              onClick={() => setHistoryPreview({ entry, field })}
                              className="btn-ghost text-[10px] px-2 py-1"
                            >View</button>
                            <button
                              onClick={() => exportToPdf(entry[field], field === 'cv' ? 'CV' : 'Cover-Letter', lastName, entry.jobCompany)}
                              className="btn-ghost text-[10px] px-2 py-1"
                            >PDF</button>
                            <button
                              onClick={async () => {
                                await deleteDocHistoryEntry(entry.id)
                                setHistory(h => h.filter(e => e.id !== entry.id))
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Editor or empty state */}
      {view !== 'history' && <div className="flex-1 relative overflow-hidden">
        {activeDoc ? (
          editing ? (
            <textarea
              value={activeDoc}
              onChange={e => handleChange(e.target.value)}
              className="w-full h-full bg-slate-50 dark:bg-[#0f1117] text-slate-800 dark:text-slate-200
                         text-xs font-mono p-4 resize-none outline-none border-none leading-relaxed"
              spellCheck
            />
          ) : (
            <div
              className="w-full h-full overflow-y-auto p-5 bg-white dark:bg-[#0f1117]
                         prose-cv text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(activeDoc) }}
            />
          )
        ) : (
          <div className="h-full flex items-center justify-center text-center px-8">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">
                No {docLabel} generated
              </p>
              <p className="text-slate-400 dark:text-slate-600 text-xs mb-4">
                You generated the other document but skipped this one.
              </p>
              <button
                onClick={() => onGenerateMissing(missingMode)}
                disabled={generating}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                {generating && <Spinner className="w-3 h-3" />}
                {generating ? 'Generating...' : `Generate ${docLabel} now`}
              </button>
            </div>
          </div>
        )}

        {/* Generating overlay — shown while streaming */}
        {generating && activeDoc && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-indigo-600/90 text-white text-[10px] rounded-full px-2.5 py-1 shadow-lg">
            <Spinner className="w-2.5 h-2.5" />
            Writing…
          </div>
        )}
      </div>}

      {/* Footer actions — hidden in history view */}
      {view !== 'history' && !historyPreview && (
        <div className="shrink-0 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f] px-4 py-3 flex items-center gap-2">
          <button onClick={onOpenChat} className="btn-secondary flex-1 text-xs">
            Refine in chat
          </button>
          <button
            onClick={handleSaveToHistory}
            disabled={saving || !docs}
            className="btn-ghost text-xs px-3"
            title="Save to history"
          >
            {saved ? '✓ Saved' : saving ? '…' : 'Save'}
          </button>
          <button onClick={handleInjectIntoForm} disabled={injecting} className="btn-primary flex-1 text-xs">
            {injecting ? 'Filling...' : 'Fill form'}
          </button>
          <button
            onClick={() => exportToPdf(activeDoc, docTitle, lastName, job?.company ?? '')}
            disabled={!activeDoc}
            className="btn-secondary text-xs px-3"
          >PDF</button>
          <button
            onClick={() => setEditing(e => !e)}
            disabled={!activeDoc}
            className={editing ? 'btn-primary text-xs px-3' : 'btn-ghost text-xs px-3'}
          >{editing ? 'Preview' : 'Edit'}</button>
          <button onClick={() => copyToClipboard(activeDoc)} className="btn-ghost text-xs px-3">
            Copy
          </button>
        </div>
      )}
    </div>
  )
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(console.error)
}

async function exportToPdf(markdown: string, docType: string, lastName = '', company = '') {
  const slug = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  const title = [slug(lastName), slug(company), slug(docType)].filter(Boolean).join('-') || docType
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentW = pageW - margin * 2
  let y = margin

  function checkPage(needed = 6) {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin }
  }

  function addText(text: string, size: number, style: 'normal' | 'bold', color: [number,number,number], indent = 0) {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, contentW - indent)
    for (const line of lines) {
      checkPage()
      doc.text(line, margin + indent, y)
      y += size * 0.45
    }
  }

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd()
    if (line.startsWith('# ')) {
      y += 2
      addText(line.slice(2), 18, 'bold', [20, 20, 20])
      y += 2
    } else if (line.startsWith('## ')) {
      y += 3
      checkPage(8)
      addText(line.slice(3).toUpperCase(), 8, 'bold', [100, 100, 100])
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, margin + contentW, y)
      y += 3
    } else if (line.startsWith('### ')) {
      y += 1
      addText(line.slice(4), 10, 'bold', [30, 30, 30])
    } else if (/^[•\-\*] /.test(line)) {
      checkPage()
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 50, 50)
      const bullet = line.slice(2).replace(/\*\*(.+?)\*\*/g, '$1')
      const lines = doc.splitTextToSize(bullet, contentW - 6)
      doc.text('•', margin + 1, y)
      doc.text(lines, margin + 5, y)
      y += lines.length * 4.3
    } else if (line.trim() === '' || /^---+$/.test(line.trim())) {
      y += 2
    } else {
      const clean = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
      if (clean.trim()) addText(clean, 9.5, 'normal', [50, 50, 50])
    }
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`)
}
