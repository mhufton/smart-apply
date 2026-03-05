import { useState, useEffect } from 'react'
import { getProviderConfig, saveProviderConfig, clearProviderConfig } from '../lib/claude'
import type { ProviderConfig } from '../lib/claude'

type Preset = {
  label: string
  provider: ProviderConfig['provider']
  endpoint: string
  keyPrefix: string
  keyPlaceholder: string
  smallModel: string
  largeModel: string
  docsUrl: string
}

const PRESETS: Preset[] = [
  { label: 'Anthropic',   provider: 'anthropic',        endpoint: 'https://api.anthropic.com',                        keyPrefix: 'sk-ant-', keyPlaceholder: 'sk-ant-api03-...', smallModel: 'claude-haiku-4-5-20251001', largeModel: 'claude-sonnet-4-5',           docsUrl: 'https://console.anthropic.com/settings/keys' },
  { label: 'OpenAI',      provider: 'openai-compatible', endpoint: 'https://api.openai.com/v1',                       keyPrefix: 'sk-',     keyPlaceholder: 'sk-...',           smallModel: 'gpt-4o-mini',               largeModel: 'gpt-4o',                      docsUrl: 'https://platform.openai.com/api-keys' },
  { label: 'Gemini',      provider: 'openai-compatible', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', keyPrefix: 'AI', keyPlaceholder: 'AIza...',        smallModel: 'gemini-2.0-flash',          largeModel: 'gemini-2.5-pro-preview-03-25', docsUrl: 'https://aistudio.google.com/apikey' },
  { label: 'Groq',        provider: 'openai-compatible', endpoint: 'https://api.groq.com/openai/v1',                  keyPrefix: 'gsk_',    keyPlaceholder: 'gsk_...',          smallModel: 'llama-3.1-8b-instant',      largeModel: 'llama-3.3-70b-versatile',     docsUrl: 'https://console.groq.com/keys' },
  { label: 'OpenRouter',  provider: 'openai-compatible', endpoint: 'https://openrouter.ai/api/v1',                    keyPrefix: 'sk-or-',  keyPlaceholder: 'sk-or-...',        smallModel: 'anthropic/claude-haiku-3-5', largeModel: 'anthropic/claude-sonnet-4-5', docsUrl: 'https://openrouter.ai/keys' },
  { label: 'Custom',      provider: 'openai-compatible', endpoint: '',                                                 keyPrefix: '',        keyPlaceholder: 'API key',          smallModel: '',                          largeModel: '',                            docsUrl: '' },
]

export default function SettingsTab() {
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const [preset, setPreset] = useState(0)
  const [keyInput, setKeyInput] = useState('')
  const [endpoint, setEndpoint] = useState(PRESETS[0].endpoint)
  const [smallModel, setSmallModel] = useState(PRESETS[0].smallModel)
  const [largeModel, setLargeModel] = useState(PRESETS[0].largeModel)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    getProviderConfig().then(cfg => {
      if (!cfg) return
      setConfig(cfg)
      const idx = PRESETS.findIndex(p => p.provider === cfg.provider && (p.provider === 'anthropic' || p.endpoint === cfg.endpoint))
      setPreset(idx >= 0 ? idx : PRESETS.length - 1)
      setEndpoint(cfg.endpoint)
      setSmallModel(cfg.smallModel)
      setLargeModel(cfg.largeModel)
    })
  }, [])

  function handlePresetChange(idx: number) {
    setPreset(idx)
    setEndpoint(PRESETS[idx].endpoint)
    setSmallModel(PRESETS[idx].smallModel)
    setLargeModel(PRESETS[idx].largeModel)
    setError('')
  }

  async function handleSave() {
    const key = keyInput.trim()
    if (!key) { setError('Enter your API key.'); return }
    if (!endpoint.trim()) { setError('Enter the endpoint URL.'); return }

    setStatus('saving')
    setError('')
    try {
      await saveProviderConfig({
        provider: PRESETS[preset].provider,
        apiKey: key,
        endpoint: endpoint.trim(),
        smallModel: smallModel.trim() || PRESETS[preset].smallModel,
        largeModel: largeModel.trim() || PRESETS[preset].largeModel,
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
                <div className="text-[10px] text-slate-400 truncate">{config.smallModel} · {config.largeModel}</div>
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
              <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Small model <span className="normal-case text-slate-500">(parsing, fit, chat)</span></label>
              <input
                type="text"
                value={smallModel}
                onChange={e => setSmallModel(e.target.value)}
                placeholder={PRESETS[preset].smallModel || 'e.g. gpt-4o-mini'}
                className="input-base w-full font-mono text-[11px]"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Large model <span className="normal-case text-slate-500">(CV + cover letter)</span></label>
              <input
                type="text"
                value={largeModel}
                onChange={e => setLargeModel(e.target.value)}
                placeholder={PRESETS[preset].largeModel || 'e.g. gpt-4o'}
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
              disabled={!keyInput.trim() || status === 'saving'}
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
              <ModelRow label="Fit analysis, parsing, chat" model={config.smallModel || '—'} note="Small" />
              <ModelRow label="CV + cover letter"           model={config.largeModel  || '—'} note="Large" />
            </>
          ) : (
            <>
              <ModelRow label="Fit analysis, parsing, chat" model="claude-haiku-4-5"  note="Small" />
              <ModelRow label="CV + cover letter"           model="claude-sonnet-4-5" note="Large" />
            </>
          )}
        </div>
      </Section>

      <Section title="Storage">
        <p className="text-xs text-slate-400 leading-relaxed">
          Your profile, job history, and generated documents are stored in <code className="text-indigo-400">IndexedDB</code> (via Dexie) on this machine only. Your API key is stored separately in <code className="text-indigo-400">chrome.storage.local</code>. Nothing is synced to any server.
        </p>
      </Section>

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
