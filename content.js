

chrome.storage.local.get("origins", (result) => {
    const arr = result["origins"] || [];
    if (arr.includes(origin)) {
      chrome.storage.local.get("sensitivities", (result) => {
        const arr = result["sensitivities"] || {};
        const defaults = {
          childList: false,
          subtree: false,
          attributes: false,
          attributeOldValue: false,
          characterData: false,
          characterDataOldValue: false
        };

        const s = (result.sensitivities && result.sensitivities[origin]) || {};
        const config = {
          ...defaults,
          ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Boolean(v)]))
        };
        if(Object.values(config).every(val => val === false)) return
        async function createWorker(path) {
          const response = await fetch(chrome.runtime.getURL(path));
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          return new Worker(url);
        }
  
        createWorker("worker.js").then(worker => {
          const observer = new MutationObserver((mutations) => {
            worker.postMessage(document.body.innerHTML);
          });
          worker.onmessage = function(e){
            chrome.storage.local.get("links", (result) => {
              let arr = result["links"][origin] || [];
              arr.push(location.href)
              arr = [...new Set(arr.concat(e.data))]
              result["links"][origin] = arr
              chrome.runtime.sendMessage({ type: "setBadge", text: arr.length.toString() });
              chrome.storage.local.set({ ["links"]: result["links"] }, () => {
              });
            })
          }
  
          observer.observe(document.body, config);
        });
      })
    }else {
      chrome.runtime.sendMessage({ type: "setBadge", text: "off" });
    }
  }
)


