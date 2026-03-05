import { useState, useEffect } from 'react'
import { getApiKey, saveApiKey, clearApiKey } from '../lib/claude'

export default function SettingsTab() {
  const [saved, setSaved] = useState<string | null>(null)  // masked key if set
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    getApiKey().then(key => {
      if (key) setSaved(maskKey(key))
    })
  }, [])

  async function handleSave() {
    const key = input.trim()
    if (!key.startsWith('sk-ant-')) {
      setError('Key should start with sk-ant-')
      return
    }
    setStatus('saving')
    setError('')
    try {
      await saveApiKey(key)
      setSaved(maskKey(key))
      setInput('')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setError('Failed to save key.')
    }
  }

  async function handleClear() {
    await clearApiKey()
    setSaved(null)
    setInput('')
    setStatus('idle')
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">

      <Section title="Anthropic API Key">
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Your key is stored locally in <code className="text-indigo-400">chrome.storage.local</code> — never sent anywhere except Anthropic's API.
          Get one at{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            console.anthropic.com
          </a>.
        </p>

        {saved ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5">
              <span className="text-xs font-mono text-emerald-400 flex-1">{saved}</span>
              <span className="text-[10px] text-emerald-500 font-medium">Active</span>
            </div>
            <button onClick={handleClear} className="btn-secondary w-full text-xs text-red-400 border-red-500/20 hover:border-red-500/40">
              Remove key
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="sk-ant-api03-..."
              className="input-base w-full font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleSave}
              disabled={!input.trim() || status === 'saving'}
              className="btn-primary w-full"
            >
              {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved!' : 'Save API key'}
            </button>
          </div>
        )}
      </Section>

      <Section title="Models">
        <div className="space-y-2 text-xs">
          <ModelRow
            label="Fit analysis, resume parsing"
            model="claude-haiku-4-5"
            note="Fast + cheap"
          />
          <ModelRow
            label="CV + cover letter generation"
            model="claude-sonnet-4-5"
            note="Higher quality"
          />
          <ModelRow
            label="Chat refinement"
            model="claude-haiku-4-5"
            note="Fast + cheap"
          />
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
