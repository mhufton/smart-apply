import type { ExtMessage } from '../types'

// Open side panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  try {
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch (e) {
    console.warn('[Smart Apply] Cannot open side panel:', e)
  }
})

// Helper: send message to content script with error handling
function relayToContentScript(
  message: ExtMessage,
  sendResponse: (response: unknown) => void
) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id
    if (!tabId) {
      sendResponse({ error: 'No active tab' })
      return
    }
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Smart Apply] Content script not reachable:', chrome.runtime.lastError.message)
        sendResponse({ error: 'Content script not available. Please refresh the page and try again.' })
        return
      }
      sendResponse(response)
    })
  })
}

// Relay messages between side panel and content script
chrome.runtime.onMessage.addListener((message: ExtMessage, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB' || message.type === 'SCRAPE_PROFILE' || message.type === 'INJECT_FIELDS') {
    relayToContentScript(message, sendResponse)
    return true // keep sendResponse channel open for async
  }

  return false
})
