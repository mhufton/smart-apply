/**
 * Lightweight markdown → HTML renderer for CV/cover letter format.
 * Handles headings, bold, italic, bullet lists, horizontal rules, and paragraphs.
 */
export function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false

  function closeList() {
    if (inList) { out.push('</ul>'); inList = false }
  }

  function inline(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^### /.test(line)) {
      closeList()
      out.push(`<h3>${inline(line.slice(4))}</h3>`)
    } else if (/^## /.test(line)) {
      closeList()
      out.push(`<h2>${inline(line.slice(3))}</h2>`)
    } else if (/^# /.test(line)) {
      closeList()
      out.push(`<h1>${inline(line.slice(2))}</h1>`)
    } else if (/^---+$/.test(line.trim())) {
      closeList()
      out.push('<hr>')
    } else if (/^[•\-\*] /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.slice(2))}</li>`)
    } else if (line.trim() === '') {
      closeList()
      out.push('<br>')
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }

  closeList()
  return out.join('\n')
}

export function markdownToFullPage(md: string, title = 'Document'): string {
  const body = renderMarkdown(md)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Georgia', serif;
      max-width: 740px;
      margin: 32px auto;
      line-height: 1.5;
      color: #111;
      font-size: 12px;
      padding: 0 20px;
    }
    h1 { font-size: 20px; margin: 0 0 3px; letter-spacing: -0.3px; }
    h2 {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #555;
      border-bottom: 1px solid #ddd;
      padding-bottom: 2px;
      margin: 14px 0 6px;
    }
    h3 { font-size: 12px; margin: 8px 0 2px; }
    p { margin: 3px 0; }
    ul { margin: 2px 0 6px 16px; padding: 0; }
    li { margin: 1px 0; }
    hr { border: none; border-top: 1px solid #eee; margin: 10px 0; }
    code { font-family: monospace; font-size: 10px; background: #f5f5f5; padding: 1px 3px; border-radius: 2px; }
    strong { font-weight: 600; }
    br { display: block; content: ''; margin: 4px 0; }
    @media print {
      body { margin: 24px auto; }
      h2 { color: #333; }
      .print-tip { display: none; }
    }
    .print-tip {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: #fffbea;
      border-top: 1px solid #e5d76b;
      padding: 8px 16px;
      font-size: 11px;
      color: #555;
      text-align: center;
      font-family: system-ui, sans-serif;
    }
  </style>
</head>
<body>
${body}
<div class="print-tip">
  Tip: in the print dialog, uncheck <strong>Headers and footers</strong> to hide the URL from the printed page.
</div>
<script>
  function triggerPrint() { window.print() }
  if (document.readyState === 'complete') {
    setTimeout(triggerPrint, 100)
  } else {
    window.addEventListener('load', () => setTimeout(triggerPrint, 100))
  }
</script>
</body>
</html>`
}
