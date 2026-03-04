import { useState } from 'react'
import type { GeneratedDocuments, ScrapedJob } from '../../types'

interface Props {
  docs: GeneratedDocuments | null
  job: ScrapedJob | null
  onDocsChange: (docs: GeneratedDocuments) => void
  onOpenChat: () => void
}

type DocView = 'cv' | 'cover'

export default function DocumentsTab({ docs, job, onDocsChange, onOpenChat }: Props) {
  const [view, setView] = useState<DocView>('cv')
  const [injecting, setInjecting] = useState(false)

  if (!docs) {
    return (
      <div className="h-full flex items-center justify-center text-center px-8">
        <div>
          <p className="text-slate-500 text-sm mb-1">No documents yet</p>
          <p className="text-slate-600 text-xs">
            Scrape a job on the Job tab and click "Generate CV + Cover Letter"
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
      // Build field map: find cover letter / resume fields and inject
      const fieldMap: Record<string, string> = {}
      for (const field of job.formFields) {
        const label = field.label.toLowerCase()
        if (field.type === 'textarea' && (label.includes('cover') || label.includes('letter'))) {
          fieldMap[field.selector] = docs.coverLetter
        }
        if (field.type === 'textarea' && label.includes('summary')) {
          // Extract first paragraph as summary
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

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab */}
      <div className="flex border-b border-white/5 bg-[#16181f] shrink-0">
        {(['cv', 'cover'] as DocView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={[
              'flex-1 py-2 text-xs font-medium transition-colors',
              view === v
                ? 'text-slate-200 bg-white/5'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {v === 'cv' ? 'CV / Résumé' : 'Cover Letter'}
          </button>
        ))}
      </div>

      {/* Editor */}
      <textarea
        value={activeDoc}
        onChange={e => handleChange(e.target.value)}
        className="flex-1 w-full bg-[#0f1117] text-slate-200 text-xs font-mono p-4
                   resize-none outline-none border-none leading-relaxed"
        placeholder={`Your ${view === 'cv' ? 'CV' : 'cover letter'} will appear here...`}
        spellCheck
      />

      {/* Footer actions */}
      <div className="shrink-0 border-t border-white/5 bg-[#16181f] px-4 py-3 flex items-center gap-2">
        <button
          onClick={onOpenChat}
          className="btn-secondary flex-1 text-xs"
        >
          Refine with chat
        </button>
        <button
          onClick={handleInjectIntoForm}
          disabled={injecting}
          className="btn-primary flex-1 text-xs"
        >
          {injecting ? 'Injecting...' : 'Fill form fields'}
        </button>
        <button
          onClick={() => copyToClipboard(activeDoc)}
          className="btn-ghost text-xs px-3"
          title="Copy to clipboard"
        >
          Copy
        </button>
      </div>
    </div>
  )
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(console.error)
}
