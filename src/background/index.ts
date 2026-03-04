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

// Relay messages between side panel and content script
chrome.runtime.onMessage.addListener((message: ExtMessage, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (!tabId) {
        sendResponse({ error: 'No active tab' })
        return
      }
      chrome.tabs.sendMessage(tabId, message, (response) => {
        sendResponse(response)
      })
    })
    return true // keep sendResponse channel open for async
  }

  if (message.type === 'INJECT_FIELDS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (!tabId) {
        sendResponse({ error: 'No active tab' })
        return
      }
      chrome.tabs.sendMessage(tabId, message, (response) => {
        sendResponse(response)
      })
    })
    return true
  }

  return false
})
