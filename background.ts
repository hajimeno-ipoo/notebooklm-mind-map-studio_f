// This runs in the background to handle extension events

declare var chrome: any;

// Open the side panel when the extension icon is clicked
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: any) => console.error(error));
}

// Example: Listen for installation
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(() => {
    console.log("NotebookLM Mind Map Studio installed");
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
    if (request.action === "OPEN_STUDIO_TAB") {
      // 1. Save the data to storage so the new tab can pick it up
      chrome.storage.local.set({ mindMapData: request.data }, () => {
        // 2. Open index.html in a new tab
        chrome.tabs.create({ url: 'index.html' });
        // 3. Send response to close the port cleanly
        sendResponse({ success: true });
      });
      // CRITICAL: Return true to indicate that sendResponse will be called asynchronously
      return true;
    }
  });
}