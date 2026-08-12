async function enableActionSidePanel() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error("Failed to configure the side panel:", error);
  }
}

chrome.runtime.onInstalled.addListener(enableActionSidePanel);
chrome.runtime.onStartup.addListener(enableActionSidePanel);
enableActionSidePanel();
