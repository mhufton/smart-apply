#!/usr/bin/env node
// Smart Apply — local Claude CLI bridge
//
// Exposes an OpenAI-compatible /v1/chat/completions endpoint that fulfils each
// request by invoking your logged-in `claude` CLI (Claude Code) in headless
// mode. This routes the extension's LLM calls through your Claude subscription
// (Opus 4.8 by default) instead of a paid API key.
//
// Run:   npm run bridge          (or: node bridge/server.mjs)
// Then in the extension Settings, pick the "Claude CLI" provider.
//
// Zero dependencies — Node built-ins only.

import http from 'node:http'
import os from 'node:os'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.SMART_APPLY_BRIDGE_PORT || 4141)
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude'
const DEFAULT_MODEL = process.env.SMART_APPLY_MODEL || 'claude-opus-4-8'

// We want plain text generation, never tool use. Deny every action tool so the
// model can only produce text (any tool call would corrupt the streamed output).
const DISALLOWED_TOOLS = [
  'Task', 'AskUserQuestion', 'Bash', 'CronCreate', 'CronDelete', 'CronList',
  'Edit', 'EnterPlanMode', 'EnterWorktree', 'ExitPlanMode', 'ExitWorktree',
  'LSP', 'Monitor', 'NotebookEdit', 'PushNotification', 'Read', 'RemoteTrigger',
  'ScheduleWakeup', 'Skill', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskOutput',
  'TaskStop', 'TaskUpdate', 'ToolSearch', 'WebFetch', 'WebSearch', 'Workflow', 'Write',
]

const SYSTEM_PROMPT =
  'You are the text-generation backend for a job-application assistant. The ' +
  "user's message contains the full task and the exact output format required " +
  '(sometimes strict JSON, sometimes markdown). Produce exactly what is asked — ' +
  'no preamble, no explanation, no commentary, and no role labels. Do not wrap ' +
  'output in markdown code fences unless the instructions explicitly ask for them.'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
}

// Collapse an OpenAI/Anthropic message array into a single prompt for `claude -p`.
// Single-turn calls (fit, parsing, doc generation) pass straight through. For
// multi-turn chat we replay the transcript as context — the live document state
// is re-embedded in the lead message each turn, so flattening is lossless here.
function messagesToPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return ''
  if (messages.length === 1) return String(messages[0]?.content ?? '')
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n')
  const last = messages[messages.length - 1]
  return `Conversation so far:\n\n${history}\n\n---\n\nRespond to the latest message:\n\n${last.content}`
}

function chunk(content) {
  return `data: ${JSON.stringify({
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  })}\n\n`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (d) => {
      raw += d
      if (raw.length > 20_000_000) reject(new Error('body too large'))
    })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, model: DEFAULT_MODEL }))
    return
  }

  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404, { ...CORS, 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found. POST to /v1/chat/completions.' }))
    return
  }

  let body
  try { body = await readBody(req) } catch {
    res.writeHead(400, { ...CORS, 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const model = (body.model && String(body.model).trim()) || DEFAULT_MODEL
  const wantStream = body.stream !== false
  const prompt = messagesToPrompt(body.messages)
  if (!prompt.trim()) {
    res.writeHead(400, { ...CORS, 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'No messages provided' }))
    return
  }

  const args = [
    '-p',
    '--model', model,
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--system-prompt', SYSTEM_PROMPT,
    '--disable-slash-commands',
    '--strict-mcp-config',
    '--disallowed-tools', ...DISALLOWED_TOOLS,
  ]

  // Neutral cwd so no project CLAUDE.md gets auto-loaded into context.
  const child = spawn(CLAUDE_BIN, args, { cwd: os.tmpdir(), env: process.env })

  let produced = false
  let stderr = ''
  let stdoutBuf = ''

  const emit = (text) => {
    if (!text) return
    produced = true
    if (wantStream) res.write(chunk(text))
    else fullText += text
  }
  let fullText = ''

  if (wantStream) {
    res.writeHead(200, {
      ...CORS,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
  }

  const handleLine = (line) => {
    const s = line.trim()
    if (!s) return
    let obj
    try { obj = JSON.parse(s) } catch { return }
    if (
      obj.type === 'stream_event' &&
      obj.event?.type === 'content_block_delta' &&
      obj.event.delta?.type === 'text_delta'
    ) {
      emit(obj.event.delta.text)
    } else if (obj.type === 'result' && obj.is_error) {
      stderr += `\n${obj.result || obj.subtype || 'error'}`
    }
  }

  child.stdout.on('data', (d) => {
    stdoutBuf += d.toString()
    let idx
    while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
      handleLine(stdoutBuf.slice(0, idx))
      stdoutBuf = stdoutBuf.slice(idx + 1)
    }
  })
  child.stderr.on('data', (d) => { stderr += d.toString() })

  child.on('error', (err) => {
    const msg =
      err.code === 'ENOENT'
        ? `Could not run "${CLAUDE_BIN}". Is the Claude CLI installed and on your PATH? (set CLAUDE_BIN to override)`
        : String(err.message || err)
    finish(msg)
  })

  child.on('close', (code) => {
    if (stdoutBuf.trim()) handleLine(stdoutBuf)
    const errMsg = code !== 0 && !produced ? (stderr.trim() || `claude exited with code ${code}`) : ''
    finish(errMsg)
  })

  let finished = false
  function finish(errMsg) {
    if (finished) return
    finished = true
    if (errMsg) console.error(`[bridge] ${errMsg}`)
    if (wantStream) {
      if (!res.headersSent) {
        res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      }
      if (errMsg && !produced) res.write(chunk(`[Claude CLI bridge error] ${errMsg}`))
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      if (errMsg && !produced) {
        res.writeHead(502, { ...CORS, 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: errMsg }))
        return
      }
      res.writeHead(200, { ...CORS, 'content-type': 'application/json' })
      res.end(JSON.stringify({
        object: 'chat.completion',
        model,
        choices: [{ index: 0, message: { role: 'assistant', content: fullText }, finish_reason: 'stop' }],
      }))
    }
  }

  // If the client disconnects, stop the CLI to avoid orphaned subscription usage.
  req.on('close', () => { if (!finished) child.kill('SIGTERM') })

  child.stdin.on('error', () => {}) // ignore EPIPE if claude dies early
  child.stdin.write(prompt)
  child.stdin.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Smart Apply bridge → Claude CLI`)
  console.log(`  listening on  http://localhost:${PORT}/v1/chat/completions`)
  console.log(`  default model ${DEFAULT_MODEL}  (override per-request via the "model" field)`)
  console.log(`  health check  http://localhost:${PORT}/health`)
  console.log(`\nLeave this running, then pick "Claude CLI" in the extension's Settings tab.`)
})
