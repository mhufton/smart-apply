import { useState, useEffect } from 'react'
import { getProviderConfig, saveProviderConfig, clearProviderConfig } from '../lib/claude'
import type { ProviderConfig } from '../lib/claude'

const PRESETS: { label: string; endpoint: string; keyPrefix: string; smallModel: string; largeModel: string; docsUrl: string }[] = [
  { label: 'OpenAI',     endpoint: 'https://api.openai.com/v1',      keyPrefix: 'sk-',    smallModel: 'gpt-4o-mini',                largeModel: 'gpt-4o',                         docsUrl: 'https://platform.openai.com/api-keys' },
  { label: 'Groq',       endpoint: 'https://api.groq.com/openai/v1', keyPrefix: 'gsk_',   smallModel: 'llama-3.1-8b-instant',       largeModel: 'llama-3.3-70b-versatile',        docsUrl: 'https://console.groq.com/keys' },
  { label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1',   keyPrefix: 'sk-or-', smallModel: 'anthropic/claude-haiku-3-5', largeModel: 'anthropic/claude-sonnet-4-5',    docsUrl: 'https://openrouter.ai/keys' },
  { label: 'Custom',     endpoint: '',                                keyPrefix: '',       smallModel: '',                           largeModel: '',                                docsUrl: '' },
]

export default function SettingsTab() {
  const [config, setConfig] = useState<ProviderConfig | null>(null)
  const [provider, setProvider] = useState<'anthropic' | 'openai-compatible'>('anthropic')
  const [preset, setPreset] = useState(0)
  const [keyInput, setKeyInput] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [smallModel, setSmallModel] = useState('')
  const [largeModel, setLargeModel] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    getProviderConfig().then(cfg => {
      if (!cfg) return
      setConfig(cfg)
      setProvider(cfg.provider)
      if (cfg.provider === 'openai-compatible') {
        setEndpoint(cfg.endpoint)
        setSmallModel(cfg.smallModel)
        setLargeModel(cfg.largeModel)
        const idx = PRESETS.findIndex(p => p.endpoint === cfg.endpoint)
        setPreset(idx >= 0 ? idx : 3)
      }
    })
  }, [])

  function handlePresetChange(idx: number) {
    setPreset(idx)
    setEndpoint(PRESETS[idx].endpoint)
    setSmallModel(PRESETS[idx].smallModel)
    setLargeModel(PRESETS[idx].largeModel)
  }

  async function handleSave() {
    const key = keyInput.trim()
    if (!key) { setError('Enter your API key.'); return }

    if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
      setError('Anthropic keys start with sk-ant-')
      return
    }
    if (provider === 'openai-compatible' && !endpoint.trim()) {
      setError('Enter the API endpoint URL.')
      return
    }

    setStatus('saving')
    setError('')
    try {
      await saveProviderConfig({
        provider,
        apiKey: key,
        endpoint: provider === 'openai-compatible' ? endpoint.trim() : '',
        smallModel: provider === 'openai-compatible' ? (smallModel.trim() || PRESETS[preset].smallModel) : '',
        largeModel: provider === 'openai-compatible' ? (largeModel.trim() || PRESETS[preset].largeModel) : '',
      })
      const cfg = await getProviderConfig()
      setConfig(cfg)
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

  const activePreset = config?.provider === 'openai-compatible'
    ? PRESETS.find(p => p.endpoint === config.endpoint)
    : null

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">

      <Section title="API Provider">
        {config ? (
          <div className="space-y-3">
            <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {config.provider === 'anthropic' ? 'Anthropic (Claude)' : (activePreset?.label ?? 'Custom')}
                </span>
                <span className="text-[10px] text-emerald-500 font-medium">Active</span>
              </div>
              <div className="text-xs font-mono text-emerald-400">{maskKey(config.apiKey)}</div>
              {config.provider === 'openai-compatible' && (
                <div className="text-[10px] text-slate-400 truncate">{config.endpoint} · {config.smallModel} / {config.largeModel}</div>
              )}
            </div>
            <button onClick={handleClear} className="btn-secondary w-full text-xs text-red-400 border-red-500/20 hover:border-red-500/40">
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Provider toggle */}
            <div className="flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden text-xs font-medium">
              {(['anthropic', 'openai-compatible'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => { setProvider(p); setError('') }}
                  className={[
                    'flex-1 py-2 transition-colors',
                    provider === p
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                  ].join(' ')}
                >
                  {p === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible'}
                </button>
              ))}
            </div>

            {provider === 'anthropic' ? (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Get a key at{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                    console.anthropic.com
                  </a>. Stored locally — never sent anywhere except Anthropic.
                </p>
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => { setKeyInput(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="sk-ant-api03-..."
                  className="input-base w-full font-mono"
                  autoComplete="off" spellCheck={false}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Preset selector */}
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Provider preset</label>
                  <div className="grid grid-cols-4 gap-1">
                    {PRESETS.map((p, i) => (
                      <button
                        key={p.label}
                        onClick={() => handlePresetChange(i)}
                        className={[
                          'text-xs py-1.5 rounded-lg border transition-colors',
                          preset === i
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-indigo-500/30',
                        ].join(' ')}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Endpoint URL</label>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={e => setEndpoint(e.target.value)}
                    placeholder="https://api.openai.com/v1"
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
                    placeholder={PRESETS[preset].keyPrefix ? `${PRESETS[preset].keyPrefix}...` : 'API key'}
                    className="input-base w-full font-mono"
                    autoComplete="off" spellCheck={false}
                  />
                </div>
              </div>
            )}

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
              <ModelRow label="Fit analysis, resume parsing, scraping" model="claude-haiku-4-5"  note="Small" />
              <ModelRow label="CV + cover letter generation"           model="claude-sonnet-4-5" note="Large" />
              <ModelRow label="Chat refinement"                        model="claude-haiku-4-5"  note="Small" />
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
