importScripts("assets/js/pattern_matcher.js");

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "setBadge") {
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: message.text });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#79ceffff" });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get("origins", (result) => {
    const arr = result["origins"] || [];
    let origin = "";
    try {
      origin = new URL(tab.url).origin;
    } catch (e) {
      origin = tab.url || "";
    }

    const matchingPatterns = findMatchingPatterns(arr, tab.url);
    const targetPattern = matchingPatterns.length > 0 ? matchingPatterns[0] : null;

    chrome.tabs.query({}, (tabs) => {
      if (targetPattern) {
        const expectedPart = chrome.runtime.id + `/dashboard.html?origin=${encodeURIComponent(targetPattern)}`;
        const existingTab = tabs.find(t => t.url && t.url.includes(expectedPart));
        if (existingTab) {
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true });
        } else {
          const url = chrome.runtime.getURL("dashboard.html") + `?origin=${encodeURIComponent(targetPattern)}`;
          chrome.tabs.create({ url });
        }
      } else {
        const expectedAddPart = chrome.runtime.id + `/dashboard.html?origin_add=${encodeURIComponent(origin)}`;
        const existingTab = tabs.find(t => t.url && t.url.includes(expectedAddPart));
        if (existingTab) {
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true });
        } else {
          const url = chrome.runtime.getURL("dashboard.html") + `?origin_add=${encodeURIComponent(origin)}`;
          chrome.tabs.create({ url });
        }
      }
    });
  });
});
