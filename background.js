chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "setBadge") {
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: message.text });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#79ceffff" });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get("origins", (result) => {
    const arr = result["origins"] || [];
      const origin = new URL(tab.url).origin;
      chrome.tabs.query({}, (tabs) => {
        const existingTab = tabs.find(tab => tab.url && (tab.url.includes(chrome.runtime.id + `/dashboard.html?origin=${encodeURIComponent(origin)}`) || tab.url.includes(chrome.runtime.id + `/dashboard.html?origin_add=${encodeURIComponent(origin)}`) ));
        if(existingTab){
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true });
        }else{
          if (arr.includes(origin)) {
            const url = chrome.runtime.getURL("dashboard.html") + `?origin=${encodeURIComponent(origin)}`;
            chrome.tabs.create({ url });
          }else{
            const url = chrome.runtime.getURL("dashboard.html") + `?origin_add=${encodeURIComponent(origin)}`;
            chrome.tabs.create({ url });
          }
        }
      })
  });
});


