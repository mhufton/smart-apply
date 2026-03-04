import type { ExtMessage } from '../types'

// Toggle panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' } satisfies ExtMessage)
  } catch {
    // Content script not running — tab was open before extension installed.
    // Inject it programmatically then retry.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/index.tsx'],
      })
      await new Promise(r => setTimeout(r, 150))
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' } satisfies ExtMessage)
    } catch (e) {
      // chrome:// pages, new tab, etc. — can't inject here
      console.warn('[Smart Apply] Cannot inject on this page:', e)
    }
  }
})

// Relay messages between content script and panel iframe
chrome.runtime.onMessage.addListener((message: ExtMessage, _sender, sendResponse) => {
  if (message.type === 'GET_PANEL_STATE') {
    // Panel can query its own open state if needed
    sendResponse({ type: 'PANEL_STATE', payload: { open: true } })
  }
  return true
})
