import { useState, useEffect, useRef } from 'react'
import type { ApplicationEntry, ApplicationStatus } from '../../types'
import {
  loadApplications,
  updateApplicationStatus,
  updateApplicationNotes,
  deleteApplication,
  migrateDocHistoryToApplications,
} from '../lib/db'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '../lib/markdown'

function safeHtml(md: string) {
  return DOMPurify.sanitize(renderMarkdown(md))
}

const STATUS_ORDER: ApplicationStatus[] = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn']

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  applied:      'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  interviewing: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  offer:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected:     'bg-slate-500/15 text-slate-400 border-slate-500/30',
  withdrawn:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  archived:     'bg-slate-500/10 text-slate-500 border-slate-500/20',
}

export default function TrackerTab() {
  const [applications, setApplications] = useState<ApplicationEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [preview, setPreview] = useState<{ entry: ApplicationEntry; field: 'cvSnapshot' | 'coverLetterSnapshot' } | null>(null)

  useEffect(() => {
    migrateDocHistoryToApplications().catch(console.error)
    loadApplications().then(setApplications)
  }, [])

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    await updateApplicationStatus(id, status)
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status, updatedAt: Date.now() } : a))
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this application? This cannot be undone.')) return
    await deleteApplication(id)
    setApplications(prev => prev.filter(a => a.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const visible = applications.filter(a => showArchived || a.status !== 'archived')
  const interviewingCount = applications.filter(a => a.status === 'interviewing').length

  if (preview) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f] shrink-0">
          <button onClick={() => setPreview(null)} className="btn-ghost text-xs px-2">← Back</button>
          <span className="text-xs text-slate-500 flex-1 truncate">
            {preview.field === 'cvSnapshot' ? 'CV' : 'Cover Letter'} · {preview.entry.jobTitle} @ {preview.entry.jobCompany}
          </span>
        </div>
        <div
          className="flex-1 overflow-y-auto p-5 bg-white dark:bg-[#0f1117] prose-cv text-sm"
          dangerouslySetInnerHTML={{ __html: safeHtml(preview.entry[preview.field]) }}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f]">
        <p className="text-xs text-slate-500">
          {applications.filter(a => a.status !== 'archived').length} application{applications.length !== 1 ? 's' : ''}
          {interviewingCount > 0 && <span className="text-amber-500"> · {interviewingCount} interviewing</span>}
        </p>
        <button
          onClick={() => setShowArchived(v => !v)}
          className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-2">
            <p className="text-slate-500 dark:text-slate-400 text-sm">No applications yet</p>
            <p className="text-slate-400 dark:text-slate-600 text-xs">Generate a CV on the Job tab to start tracking.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {visible.map(app => (
              <ApplicationRow
                key={app.id}
                app={app}
                expanded={expandedId === app.id}
                onToggle={() => setExpandedId(prev => prev === app.id ? null : app.id)}
                onStatusChange={status => handleStatusChange(app.id, status)}
                onNotesChange={async notes => {
                  await updateApplicationNotes(app.id, notes)
                  setApplications(prev => prev.map(a => a.id === app.id ? { ...a, notes } : a))
                }}
                onPreview={(field) => setPreview({ entry: app, field })}
                onDelete={() => handleDelete(app.id)}
                onArchive={() => handleStatusChange(app.id, 'archived')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Application Row ───────────────────────────────────────────────────────────

function ApplicationRow({
  app,
  expanded,
  onToggle,
  onStatusChange,
  onNotesChange,
  onPreview,
  onDelete,
  onArchive,
}: {
  app: ApplicationEntry
  expanded: boolean
  onToggle: () => void
  onStatusChange: (s: ApplicationStatus) => void
  onNotesChange: (notes: string) => Promise<void>
  onPreview: (field: 'cvSnapshot' | 'coverLetterSnapshot') => void
  onDelete: () => void
  onArchive: () => void
}) {
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNotesBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onNotesChange(e.target.value)
  }

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const val = e.target.value
    saveTimer.current = setTimeout(() => onNotesChange(val), 800)
  }

  return (
    <div className="bg-white dark:bg-transparent">
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[app.status]}`}>
          {app.status}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{app.jobTitle || 'Untitled'}</p>
          <p className="text-[10px] text-slate-400">{app.jobCompany}{app.jobLocation ? ` · ${app.jobLocation}` : ''}</p>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">{formatDate(app.createdAt)}</span>
        <span className={`text-slate-400 text-xs transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}>›</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">

          {/* Documents */}
          <div className="pt-3 flex gap-2">
            <button
              onClick={() => onPreview('cvSnapshot')}
              disabled={!app.cvSnapshot}
              className="btn-secondary text-xs flex-1 disabled:opacity-40"
            >
              View CV
            </button>
            <button
              onClick={() => onPreview('coverLetterSnapshot')}
              disabled={!app.coverLetterSnapshot}
              className="btn-secondary text-xs flex-1 disabled:opacity-40"
            >
              View Cover Letter
            </button>
          </div>

          {/* Status pills */}
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={[
                    'text-[10px] px-2 py-1 rounded-full border transition-colors capitalize',
                    app.status === s
                      ? STATUS_STYLE[s]
                      : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-300 dark:hover:border-white/20',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Notes</p>
            <textarea
              ref={notesRef}
              defaultValue={app.notes}
              onChange={handleNotesChange}
              onBlur={handleNotesBlur}
              placeholder="Add notes…"
              className="input-base w-full h-20 resize-none text-xs"
            />
          </div>

          {/* Fit score + job link */}
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{app.fitScore !== undefined ? `Fit score when applied: ${app.fitScore}` : ''}</span>
            {app.jobUrl && !app.jobUrl.startsWith('legacy:') && (
              <a
                href={app.jobUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View job posting →
              </a>
            )}
          </div>

          {/* Danger zone */}
          <div className="flex items-center justify-end gap-3 pt-1">
            {app.status !== 'archived' && (
              <button onClick={onArchive} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Archive
              </button>
            )}
            <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
