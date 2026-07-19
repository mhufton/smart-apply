import { useState, useEffect } from 'react'
import { getProviderConfig, saveProviderConfig, clearProviderConfig } from '../lib/claude'
import type { ProviderConfig } from '../lib/claude'

type Preset = {
  label: string
  provider: ProviderConfig['provider']
  endpoint: string
  keyPrefix: string
  keyPlaceholder: string
  parseModel: string
  fitModel: string
  writeModel: string
  docsUrl: string
}

const PRESETS: Preset[] = [
  { label: 'Claude CLI',  provider: 'openai-compatible', endpoint: 'http://localhost:4141/v1',                        keyPrefix: '',        keyPlaceholder: 'not needed — leave blank', parseModel: 'claude-haiku-4-5',          fitModel: 'claude-sonnet-4-6',           writeModel: 'claude-opus-4-8',             docsUrl: '' },
  { label: 'Anthropic',   provider: 'anthropic',        endpoint: 'https://api.anthropic.com',                        keyPrefix: 'sk-ant-', keyPlaceholder: 'sk-ant-api03-...', parseModel: 'claude-haiku-4-5-20251001', fitModel: 'claude-sonnet-4-5',           writeModel: 'claude-opus-4-8',             docsUrl: 'https://console.anthropic.com/settings/keys' },
  { label: 'OpenAI',      provider: 'openai-compatible', endpoint: 'https://api.openai.com/v1',                       keyPrefix: 'sk-',     keyPlaceholder: 'sk-...',           parseModel: 'gpt-4o-mini',               fitModel: 'gpt-4o-mini',                 writeModel: 'gpt-4o',                      docsUrl: 'https://platform.openai.com/api-keys' },
  { label: 'Gemini',      provider: 'openai-compatible', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', keyPrefix: 'AI', keyPlaceholder: 'AIza...',        parseModel: 'gemini-2.0-flash',          fitModel: 'gemini-2.0-flash',            writeModel: 'gemini-2.5-pro-preview-03-25', docsUrl: 'https://aistudio.google.com/apikey' },
  { label: 'Groq',        provider: 'openai-compatible', endpoint: 'https://api.groq.com/openai/v1',                  keyPrefix: 'gsk_',    keyPlaceholder: 'gsk_...',          parseModel: 'llama-3.1-8b-instant',      fitModel: 'llama-3.3-70b-versatile',     writeModel: 'llama-3.3-70b-versatile',     docsUrl: 'https://console.groq.com/keys' },
  { label: 'OpenRouter',  provider: 'openai-compatible', endpoint: 'https://openrouter.ai/api/v1',                    keyPrefix: 'sk-or-',  keyPlaceholder: 'sk-or-...',        parseModel: 'anthropic/claude-haiku-3-5', fitModel: 'anthropic/claude-sonnet-4-5', writeModel: 'anthropic/claude-sonnet-4-5', docsUrl: 'https://openrouter.ai/keys' },
  { label: 'Custom',      provider: 'openai-compatible', endpoint: '',                                                 keyPrefix: '',        keyPlaceholder: 'API key',          parseModel: '',                          fitModel: '',                            writeModel: '',                            docsUrl: '' },
]

export const AUTO_ANALYZE_KEY = 'autoAnalyzeFit'

export async function getAutoAnalyze(): Promise<boolean> {
  const result = await chrome.storage.local.get(AUTO_ANALYZE_KEY)
  return result[AUTO_ANALYZE_KEY] === true
}

export default function SettingsTab() {
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const [preset, setPreset] = useState(0)
  const [keyInput, setKeyInput] = useState('')
  const [endpoint, setEndpoint] = useState(PRESETS[0].endpoint)
  const [parseModel, setParseModel] = useState(PRESETS[0].parseModel)
  const [fitModel, setFitModel] = useState(PRESETS[0].fitModel)
  const [writeModel, setWriteModel] = useState(PRESETS[0].writeModel)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [autoAnalyze, setAutoAnalyze] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(AUTO_ANALYZE_KEY).then(r => setAutoAnalyze(r[AUTO_ANALYZE_KEY] === true))
    getProviderConfig().then(cfg => {
      if (!cfg) return
      setConfig(cfg)
      const idx = PRESETS.findIndex(p => p.provider === cfg.provider && (p.provider === 'anthropic' || p.endpoint === cfg.endpoint))
      setPreset(idx >= 0 ? idx : PRESETS.length - 1)
      setEndpoint(cfg.endpoint)
      setParseModel(cfg.parseModel)
      setFitModel(cfg.fitModel)
      setWriteModel(cfg.writeModel)
    })
  }, [])

  function handlePresetChange(idx: number) {
    setPreset(idx)
    setEndpoint(PRESETS[idx].endpoint)
    setParseModel(PRESETS[idx].parseModel)
    setFitModel(PRESETS[idx].fitModel)
    setWriteModel(PRESETS[idx].writeModel)
    setError('')
  }

  async function handleSave() {
    const key = keyInput.trim()
    if (!endpoint.trim()) { setError('Enter the endpoint URL.'); return }
    const trimmedEndpoint = endpoint.trim()
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(trimmedEndpoint)
    // Local endpoints (e.g. the Claude CLI bridge) need no API key.
    if (!key && !isLocal) { setError('Enter your API key.'); return }
    if (!isLocal && !trimmedEndpoint.startsWith('https://')) {
      setError('Endpoint must use HTTPS to protect your API key.')
      return
    }

    setStatus('saving')
    setError('')
    try {
      await saveProviderConfig({
        provider: PRESETS[preset].provider,
        apiKey: key || 'local',
        endpoint: endpoint.trim(),
        parseModel: parseModel.trim() || PRESETS[preset].parseModel,
        fitModel: fitModel.trim() || PRESETS[preset].fitModel,
        writeModel: writeModel.trim() || PRESETS[preset].writeModel,
      })
      setConfig(await getProviderConfig())
      setKeyInput('')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setError('Failed to save.')
    }
  }

  async function handleClear() {
    await clearProviderConfig()
    setConfig(null)
    setKeyInput('')
    setStatus('idle')
  }

  const activeLabel = config
    ? config.provider === 'anthropic'
      ? 'Anthropic'
      : (PRESETS.find(p => p.endpoint === config.endpoint)?.label ?? 'Custom')
    : null

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">

      <Section title="AI Provider">
        {config ? (
          <div className="space-y-3">
            <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{activeLabel}</span>
                <span className="text-[10px] text-emerald-500 font-medium">Active</span>
              </div>
              <div className="text-xs font-mono text-emerald-400">{maskKey(config.apiKey)}</div>
              {config.provider === 'openai-compatible' && (
                <div className="text-[10px] text-slate-400 truncate">{config.parseModel} · {config.fitModel} · {config.writeModel}</div>
              )}
            </div>
            <button onClick={handleClear} className="btn-secondary w-full text-xs text-red-400 border-red-500/20 hover:border-red-500/40">
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Provider grid */}
            <div className="grid grid-cols-3 gap-1">
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => handlePresetChange(i)}
                  className={[
                    'text-xs py-2 rounded-lg border transition-colors',
                    preset === i
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400'
                      : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-indigo-500/30',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Endpoint</label>
              <input
                type="text"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                placeholder="https://api.anthropic.com"
                className="input-base w-full font-mono text-[11px]"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Parse model <span className="normal-case text-slate-500">(scrape &amp; parse)</span></label>
              <input
                type="text"
                value={parseModel}
                onChange={e => setParseModel(e.target.value)}
                placeholder={PRESETS[preset].parseModel || 'e.g. claude-haiku-4-5'}
                className="input-base w-full font-mono text-[11px]"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Fit model <span className="normal-case text-slate-500">(judge fit)</span></label>
              <input
                type="text"
                value={fitModel}
                onChange={e => setFitModel(e.target.value)}
                placeholder={PRESETS[preset].fitModel || 'e.g. claude-sonnet-4-6'}
                className="input-base w-full font-mono text-[11px]"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Write model <span className="normal-case text-slate-500">(CV + cover letter)</span></label>
              <input
                type="text"
                value={writeModel}
                onChange={e => setWriteModel(e.target.value)}
                placeholder={PRESETS[preset].writeModel || 'e.g. claude-opus-4-8'}
                className="input-base w-full font-mono text-[11px]"
                spellCheck={false}
              />
            </div>

            {/* API key */}
            <div>
              <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">API Key</label>
              {PRESETS[preset].docsUrl && (
                <p className="text-[10px] text-slate-500 mb-1">
                  Get one at{' '}
                  <a href={PRESETS[preset].docsUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                    {PRESETS[preset].label}
                  </a>
                </p>
              )}
              <input
                type="password"
                value={keyInput}
                onChange={e => { setKeyInput(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={PRESETS[preset].keyPlaceholder}
                className="input-base w-full font-mono"
                autoComplete="off" spellCheck={false}
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleSave}
              disabled={(!keyInput.trim() && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(endpoint.trim())) || status === 'saving'}
              className="btn-primary w-full"
            >
              {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save'}
            </button>
          </div>
        )}
      </Section>

      <Section title="Models">
        <div className="space-y-2 text-xs">
          {config?.provider === 'openai-compatible' ? (
            <>
              <ModelRow label="Scrape & parse"    model={config.parseModel || '—'} note="Parse" />
              <ModelRow label="Judge fit"         model={config.fitModel   || '—'} note="Fit" />
              <ModelRow label="CV + cover letter" model={config.writeModel || '—'} note="Write" />
            </>
          ) : (
            <>
              <ModelRow label="Scrape & parse"    model="claude-haiku-4-5"  note="Parse" />
              <ModelRow label="Judge fit"         model="claude-sonnet-4-6" note="Fit" />
              <ModelRow label="CV + cover letter" model="claude-opus-4-8"   note="Write" />
            </>
          )}
        </div>
      </Section>

      <Section title="Behaviour">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Auto-analyze fit after scraping</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Runs fit analysis automatically every time you scrape a job page.</p>
          </div>
          <button
            role="switch"
            aria-checked={autoAnalyze}
            onClick={async () => {
              const next = !autoAnalyze
              setAutoAnalyze(next)
              await chrome.storage.local.set({ [AUTO_ANALYZE_KEY]: next })
            }}
            className={[
              'relative shrink-0 w-9 h-5 rounded-full transition-colors',
              autoAnalyze ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-white/20',
            ].join(' ')}
          >
            <span className={[
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
              autoAnalyze ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')} />
          </button>
        </label>
      </Section>

      <Section title="Storage">
        <p className="text-xs text-slate-400 leading-relaxed">
          Your profile, job history, and generated documents are stored in <code className="text-indigo-400">IndexedDB</code> (via Dexie) on this machine only. Your API key is stored separately in <code className="text-indigo-400">chrome.storage.local</code>. Nothing is synced to any server.
        </p>
      </Section>

      {/* GitHub nudge */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-center space-y-1.5">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Finding Smart Apply useful?
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Give us a star on GitHub and tell someone who's job hunting — it genuinely helps.
        </p>
        <a
          href="https://github.com/mhufton/smart-apply"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
        >
          ★ Star on GitHub
        </a>
      </div>

    </div>
  )
}

function ModelRow({ label, model, note }: { label: string; model: string; note: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-200 dark:border-white/5 last:border-0">
      <span className="text-slate-500 dark:text-slate-400 flex-1">{label}</span>
      <span className="font-mono text-indigo-500 dark:text-indigo-300 text-[11px]">{model}</span>
      <span className="text-slate-400 dark:text-slate-600 text-[10px]">{note}</span>
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

function maskKey(key: string): string {
  if (key.length < 12) return '••••••••'
  return key.slice(0, 12) + '••••••••••••' + key.slice(-4)
}
