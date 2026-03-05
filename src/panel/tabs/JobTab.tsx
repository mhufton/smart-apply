import { useState } from 'react'
import type { ScrapedJob, FitAnalysis, GeneratedDocuments } from '../../types'
import { callHaiku, callSonnet, buildFitPrompt, buildDocsPrompt } from '../lib/claude'
import { loadProfile } from '../lib/storage'
import ErrorBanner from '../components/ErrorBanner'

interface Props {
  job: ScrapedJob | null
  fit: FitAnalysis | null
  onJobScraped: (job: ScrapedJob) => void
  onFitAnalyzed: (fit: FitAnalysis) => void
  onGenerateDocs: (docs: GeneratedDocuments) => void
}

export default function JobTab({ job, fit, onJobScraped, onFitAnalyzed, onGenerateDocs }: Props) {
  const [scraping, setScraping] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeAngles, setActiveAngles] = useState<string[]>([])
  const [customContext, setCustomContext] = useState('')
  const [error, setError] = useState('')

  async function handleScrape() {
    setScraping(true)
    try {
      const result = await scrapeCurrentPage()
      if ('error' in result) {
        console.warn('[Smart Apply] Scrape failed:', result.error)
        return
      }
      onJobScraped(result)
    } finally {
      setScraping(false)
    }
  }

  async function handleAnalyzeFit() {
    if (!job) return
    setAnalyzing(true)
    setError('')
    try {
      const profile = await loadProfile()
      const prompt = buildFitPrompt(job, profile)
      let raw = ''
      await callHaiku([{ role: 'user', content: prompt }], (chunk) => { raw += chunk })
      const fit = parseFitResponse(raw)
      onFitAnalyzed(fit)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fit analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleGenerateDocs() {
    if (!job) return
    setGenerating(true)
    setError('')
    try {
      const profile = await loadProfile()
      const context = [
        ...activeAngles.map(a => `- ${a}`),
        customContext ? `Additional context: ${customContext}` : '',
      ].filter(Boolean).join('\n')

      const prompt = buildDocsPrompt(job, profile, context)
      let raw = ''
      await callSonnet([{ role: 'user', content: prompt }], (chunk) => { raw += chunk })
      const docs = parseDocsResponse(raw)
      onGenerateDocs(docs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  function toggleAngle(angle: string) {
    setActiveAngles(prev =>
      prev.includes(angle) ? prev.filter(a => a !== angle) : [...prev, angle]
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <div className="p-4 space-y-4">

        {/* Scrape */}
        <Section title="Job Details">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="btn-primary w-full"
          >
            {scraping ? 'Scraping...' : 'Scrape this page'}
          </button>

          {job && (
            <div className="mt-3 space-y-2">
              <Field label="Title" value={job.title} />
              <Field label="Company" value={job.company} />
              <Field label="Location" value={job.location} />
              <Field label="Platform" value={job.platform} />
              <Field label="Form fields detected" value={String((job.formFields ?? []).length)} />
              {job.description && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <div className="text-xs text-slate-300 bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {job.description}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Fit Analysis */}
        {job && (
          <Section title="Fit Analysis">
            <button
              onClick={handleAnalyzeFit}
              disabled={analyzing}
              className="btn-secondary w-full"
            >
              {analyzing ? 'Analyzing...' : fit ? 'Re-analyze fit' : 'Analyze my fit'}
            </button>

            {fit && <FitDetail fit={fit} activeAngles={activeAngles} onToggleAngle={toggleAngle} />}
          </Section>
        )}

        {/* Generate Documents */}
        {job && (
          <Section title="Generate Documents">
            <div className="space-y-2 mb-3">
              <p className="text-xs text-slate-400">Custom context / angles</p>
              <textarea
                value={customContext}
                onChange={e => setCustomContext(e.target.value)}
                placeholder="e.g. lean into AI experience, this is a fintech role, keep it to 2 pages..."
                className="input-base h-20 resize-none w-full"
              />
            </div>
            <button
              onClick={handleGenerateDocs}
              disabled={generating}
              className="btn-primary w-full"
            >
              {generating ? 'Generating...' : 'Generate CV + Cover Letter'}
            </button>
          </Section>
        )}

        {/* Form Fields */}
        {job && (job.formFields ?? []).length > 0 && (
          <Section title={`Form Fields (${(job.formFields ?? []).length})`}>
            <div className="space-y-1">
              {(job.formFields ?? []).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${fieldTypeColor(f.type)}`}>
                    {f.type}
                  </span>
                  <span className="text-slate-300 truncate flex-1">{f.label || f.name || f.id}</span>
                  {f.required && <span className="text-red-400 text-[10px]">required</span>}
                </div>
              ))}
            </div>
          </Section>
        )}

      </div>
    </div>
  )
}

// ── Fit Detail ────────────────────────────────────────────────────────────────

function FitDetail({
  fit,
  activeAngles,
  onToggleAngle,
}: {
  fit: FitAnalysis
  activeAngles: string[]
  onToggleAngle: (a: string) => void
}) {
  const scoreColor =
    fit.score >= 75 ? 'text-emerald-400'
    : fit.score >= 50 ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="mt-3 space-y-3">
      {/* Score */}
      <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
        <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{fit.score}</span>
        <div>
          <p className="text-xs font-medium text-slate-200">{fit.headline}</p>
        </div>
      </div>

      {/* Signals */}
      {fit.signals.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Signal breakdown</p>
          <div className="space-y-1">
            {fit.signals.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${signalColor(s.match)}`} />
                <div>
                  <span className="font-medium text-slate-300">{s.area}</span>
                  {s.note && <span className="text-slate-500"> — {s.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested angles — toggleable, feed into doc generation */}
      {fit.suggestedAngles.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">
            Suggested angles <span className="text-slate-600">(toggle to include in docs)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fit.suggestedAngles.map((a) => (
              <button
                key={a}
                onClick={() => onToggleAngle(a)}
                className={[
                  'text-xs px-2 py-1 rounded-full border transition-colors',
                  activeAngles.includes(a)
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                    : 'border-white/10 text-slate-400 hover:border-white/20',
                ].join(' ')}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      <div className="grid grid-cols-2 gap-2">
        {fit.greenFlags.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Green flags</p>
            <ul className="space-y-0.5">
              {fit.greenFlags.map((f, i) => (
                <li key={i} className="text-xs text-emerald-400 leading-relaxed">+ {f}</li>
              ))}
            </ul>
          </div>
        )}
        {fit.redFlags.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Gaps / risks</p>
            <ul className="space-y-0.5">
              {fit.redFlags.map((f, i) => (
                <li key={i} className="text-xs text-red-400 leading-relaxed">− {f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  )
}

function signalColor(match: 'strong' | 'partial' | 'missing') {
  if (match === 'strong') return 'bg-emerald-400'
  if (match === 'partial') return 'bg-yellow-400'
  return 'bg-slate-600'
}

function fieldTypeColor(type: string) {
  const map: Record<string, string> = {
    textarea: 'bg-purple-500/20 text-purple-300',
    file: 'bg-blue-500/20 text-blue-300',
    select: 'bg-orange-500/20 text-orange-300',
    text: 'bg-slate-500/20 text-slate-300',
  }
  return map[type] ?? 'bg-slate-500/20 text-slate-400'
}

// ── Content script bridge ─────────────────────────────────────────────────────

function scrapeCurrentPage(): Promise<ScrapedJob> {
  return chrome.runtime.sendMessage({ type: 'SCRAPE_JOB' })
}

// ── Response parsers ──────────────────────────────────────────────────────────

function parseFitResponse(raw: string): FitAnalysis {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/)
    if (jsonMatch) return JSON.parse(jsonMatch[1])
  } catch {}
  // Fallback: return a bare-minimum object so UI doesn't crash
  return {
    score: 50,
    headline: 'Analysis unavailable — see raw output in Chat tab',
    signals: [],
    greenFlags: [],
    redFlags: [],
    suggestedAngles: [],
    analyzedAt: Date.now(),
  }
}

function parseDocsResponse(raw: string): GeneratedDocuments {
  const cvMatch = raw.match(/## CV\s*([\s\S]+?)(?=## Cover Letter|$)/)
  const clMatch = raw.match(/## Cover Letter\s*([\s\S]+?)$/)
  return {
    cv: cvMatch?.[1]?.trim() ?? raw,
    coverLetter: clMatch?.[1]?.trim() ?? '',
    generatedAt: Date.now(),
  }
}
