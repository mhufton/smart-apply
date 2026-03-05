import { useState } from 'react'
import type { ScrapedJob, FitAnalysis, GeneratedDocuments } from '../../types'
import { callHaiku, callSonnet, buildFitPrompt, buildDocsPrompt, buildJobParsePrompt, parseDocsResponse, type DocMode } from '../lib/claude'
import { loadProfile } from '../lib/storage'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'

interface Props {
  job: ScrapedJob | null
  fit: FitAnalysis | null
  onJobScraped: (job: ScrapedJob) => void
  onFitAnalyzed: (fit: FitAnalysis) => void
  onGenerateDocs: (docs: GeneratedDocuments) => void
  onGenerateStart: () => void
  onGenerateDone: () => void
}

const SCRAPE_TIP_KEY = 'sa_scrape_tip_dismissed'

export default function JobTab({ job, fit, onJobScraped, onFitAnalyzed, onGenerateDocs, onGenerateStart, onGenerateDone }: Props) {
  const [scraping, setScraping] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeAngles, setActiveAngles] = useState<string[]>([])
  const [customContext, setCustomContext] = useState('')
  const [docMode, setDocMode] = useState<DocMode>('both')
  const [error, setError] = useState('')
  const [showTip, setShowTip] = useState(() => localStorage.getItem(SCRAPE_TIP_KEY) !== 'true')

  function dismissTip() {
    localStorage.setItem(SCRAPE_TIP_KEY, 'true')
    setShowTip(false)
  }

  async function handleScrape() {
    setScraping(true)
    setError('')
    try {
      const result = await scrapeCurrentPage()
      if ('error' in result) {
        setError(result.error as string)
        return
      }

      const { _rawText, ...job } = result as ScrapedJob & { _rawText?: string }

      // Always parse with Haiku — raw text beats brittle selectors on every platform
      if (_rawText) {
        const prompt = buildJobParsePrompt(_rawText, job.url)
        let raw = ''
        await callHaiku([{ role: 'user', content: prompt }], chunk => { raw += chunk })
        try {
          const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1])
            job.title       = parsed.title       || job.title
            job.company     = parsed.company     || job.company
            job.location    = parsed.location    || job.location
            job.salary      = parsed.salary      || job.salary
            job.description = parsed.description || job.description
          }
        } catch { /* keep whatever fields exist */ }
      }

      onJobScraped(job)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scrape failed.')
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
    onGenerateStart()
    try {
      const profile = await loadProfile()
      const context = [
        ...activeAngles.map(a => `- ${a}`),
        customContext ? `Additional context: ${customContext}` : '',
      ].filter(Boolean).join('\n')

      const prompt = buildDocsPrompt(job, profile, context, docMode)
      let raw = ''
      await callSonnet([{ role: 'user', content: prompt }], (chunk) => {
        raw += chunk
        onGenerateDocs(parseDocsResponse(raw, docMode))
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document generation failed.')
    } finally {
      setGenerating(false)
      onGenerateDone()
    }
  }

  function toggleAngle(angle: string) {
    setActiveAngles(prev =>
      prev.includes(angle) ? prev.filter(a => a !== angle) : [...prev, angle]
    )
  }

  return (
    <div className="h-full flex flex-col">
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Scrape */}
        <Section title="Job Details">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {scraping && <Spinner className="w-3 h-3" />}
            {scraping ? 'Scraping...' : 'Scrape this page'}
          </button>

          {job && (
            <div className="mt-3 space-y-2">
              <Field label="Title" value={job.title} />
              <Field label="Company" value={job.company} />
              <Field label="Location" value={job.location} />
              <Field label="Salary" value={job.salary ?? ''} />
              <Field label="Platform" value={job.platform} />
              <Field label="Form fields detected" value={String((job.formFields ?? []).length)} />
              {job.description && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
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
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {analyzing && <Spinner className="w-3 h-3" />}
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
                className="input-base h-20 resize-y w-full"
              />
            </div>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 mb-3 text-xs">
              {(['cv', 'cover-letter', 'both'] as DocMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDocMode(mode)}
                  className={[
                    'flex-1 py-1.5 transition-colors',
                    docMode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5',
                  ].join(' ')}
                >
                  {mode === 'cv' ? 'CV' : mode === 'cover-letter' ? 'Cover Letter' : 'Both'}
                </button>
              ))}
            </div>
            <button
              onClick={handleGenerateDocs}
              disabled={generating}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {generating && <Spinner className="w-3 h-3" />}
              {generating ? 'Generating...' : `Generate ${docMode === 'cv' ? 'CV' : docMode === 'cover-letter' ? 'Cover Letter' : 'CV + Cover Letter'}`}
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
                  <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{f.label || f.name || f.id}</span>
                  {f.required && <span className="text-red-600 dark:text-red-400 text-[10px]">required</span>}
                </div>
              ))}
            </div>
          </Section>
        )}

      </div>
      </div>

      {/* Scrape tip banner — pinned to bottom */}
      {showTip && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-t border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
          <span className="flex-1">Having trouble scraping? Try refreshing the page first.</span>
          <button onClick={dismissTip} className="shrink-0 text-amber-600 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-300 transition-colors text-sm leading-none">✕</button>
        </div>
      )}
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
    fit.score >= 75 ? 'text-emerald-600 dark:text-emerald-400'
    : fit.score >= 50 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <div className="mt-3 space-y-3">
      {/* Score */}
      <div className="flex items-center gap-3 bg-slate-100 dark:bg-white/5 rounded-lg p-3">
        <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{fit.score}</span>
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug">{fit.headline}</p>
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
                  <span className="font-medium text-slate-700 dark:text-slate-300">{s.area}</span>
                  {s.note && <span className="text-slate-500 dark:text-slate-500"> — {s.note}</span>}
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
            Suggested angles <span className="text-slate-400">(toggle to include in docs)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fit.suggestedAngles.map((a) => (
              <button
                key={a}
                onClick={() => onToggleAngle(a)}
                className={[
                  'text-xs px-2 py-1 rounded-full border transition-colors',
                  activeAngles.includes(a)
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-white/20',
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
                <li key={i} className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">+ {f}</li>
              ))}
            </ul>
          </div>
        )}
        {fit.redFlags.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Gaps / risks</p>
            <ul className="space-y-0.5">
              {fit.redFlags.map((f, i) => (
                <li key={i} className="text-xs text-red-700 dark:text-red-400 leading-relaxed">− {f}</li>
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
    <div className="bg-black/[0.02] dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 p-4">
      <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-slate-600 dark:text-slate-300">{value}</span>
    </div>
  )
}

function signalColor(match: 'strong' | 'partial' | 'missing') {
  if (match === 'strong') return 'bg-emerald-500'
  if (match === 'partial') return 'bg-yellow-500'
  return 'bg-slate-400'
}

function fieldTypeColor(type: string) {
  const map: Record<string, string> = {
    textarea: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',
    file:     'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
    select:   'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',
    radio:    'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
    text:     'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300',
  }
  return map[type] ?? 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400'
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

