import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, GeneratedDocuments, ScrapedJob } from '../../types'
import { callHaiku } from '../lib/claude'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'

interface Props {
  messages: ChatMessage[]
  docs: GeneratedDocuments | null
  job: ScrapedJob | null
  onMessagesChange: (msgs: ChatMessage[]) => void
  onDocsUpdated: (docs: GeneratedDocuments) => void
}

export default function ChatTab({ messages, docs, job, onMessagesChange, onDocsUpdated }: Props) {
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    const newMessages = [...messages, userMsg, assistantMsg]
    onMessagesChange(newMessages)
    setStreaming(true)

    try {
      // Build the system context
      const systemParts: string[] = [
        'You are a job application writing assistant. Be concise and direct.',
      ]

      if (job) {
        systemParts.push(`\n## Current Job\nTitle: ${job.title}\nCompany: ${job.company}\nDescription:\n${job.description.slice(0, 2000)}`)
      }

      if (docs) {
        systemParts.push(`\n## Current CV\n${docs.cv}`)
        systemParts.push(`\n## Current Cover Letter\n${docs.coverLetter}`)
      }

      systemParts.push(
        '\nWhen the user asks you to update the CV or cover letter, output the FULL updated document wrapped exactly like this:',
        '```cv\n[full updated CV]\n```',
        '```cover-letter\n[full updated cover letter]\n```',
        'Only include the blocks you are changing.',
      )

      const apiMessages = [
        { role: 'user' as const, content: systemParts.join('\n') + '\n\nHello, ready to help.' },
        { role: 'assistant' as const, content: 'Ready. What would you like to change?' },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: text },
      ]

      let fullResponse = ''
      await callHaiku(apiMessages, (chunk) => {
        fullResponse += chunk
        onMessagesChange(
          newMessages.map(m =>
            m.id === assistantMsg.id ? { ...m, content: fullResponse } : m
          )
        )
      })

      // Extract document updates from response
      if (docs) {
        const updatedDocs = { ...docs }
        const cvMatch = fullResponse.match(/```cv\s*([\s\S]+?)\s*```/)
        const clMatch = fullResponse.match(/```cover-letter\s*([\s\S]+?)\s*```/)
        if (cvMatch) updatedDocs.cv = cvMatch[1]
        if (clMatch) updatedDocs.coverLetter = clMatch[1]
        if (cvMatch || clMatch) onDocsUpdated(updatedDocs)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      // Remove the empty assistant bubble on error
      onMessagesChange(newMessages.filter(m => m.id !== assistantMsg.id))
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleClear() {
    onMessagesChange([])
  }

  return (
    <div className="h-full flex flex-col">
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-1">Chat with Claude about your application</p>
            <p className="text-slate-400 dark:text-slate-600 text-xs leading-relaxed">
              Try: "Remove the MongoDB bullet", "Make the opening punchier",
              "Add more about the team I led"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={[
                'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 rounded-bl-sm',
              ].join(' ')}
            >
              <MessageContent content={msg.content} />
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#16181f] p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Claude what to change... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="input-base flex-1 resize-none text-xs leading-relaxed"
            disabled={streaming}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"
            >
              {streaming ? <Spinner className="w-3 h-3" /> : 'Send'}
            </button>
            <button
              onClick={handleClear}
              className="btn-ghost text-xs px-3 py-1.5"
              title="Clear chat"
            >
              Clear
            </button>
          </div>
        </div>
        {docs && (
          <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1.5">
            CV and cover letter are in context. Changes will update the Documents tab.
          </p>
        )}
      </div>
    </div>
  )
}

// Render code blocks nicely
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const body = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
          return (
            <pre key={i} className="mt-1 bg-black/10 dark:bg-black/30 rounded p-2 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
              {body}
            </pre>
          )
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>
      })}
    </>
  )
}
