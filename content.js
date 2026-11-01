// Attributes anywhere in the document that can hold a link.
const LINK_ATTRIBUTES = [
  "href",
  "src",
  "srcset",
  "action",
  "formaction",
  "data-url",
  "data-href",
  "data-src",
  "poster",
  "cite",
  "background",
  "profile",
  "manifest",
  "longdesc",
  "data"
];
const LINK_SELECTOR = LINK_ATTRIBUTES.map(attr => `[${attr}]`).join(",");

function readElementLinks(element, out) {
  for (const attr of LINK_ATTRIBUTES) {
    if (!element.hasAttribute(attr)) continue;
    const value = element.getAttribute(attr);
    if (!value) continue;

    if (attr === "srcset") {
      // "url1 1x, url2 2x" -> url1, url2
      for (const candidate of value.split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) out.add(url);
      }
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) out.add(trimmed);
  }
}

// Reads every link inside an element/document, including open shadow roots.
function readRootLinks(root, out) {
  if (!root) return;
  const scope = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
  if (!scope || scope.nodeType !== Node.ELEMENT_NODE) return;

  readElementLinks(scope, out);
  for (const element of scope.querySelectorAll(LINK_SELECTOR)) {
    readElementLinks(element, out);
  }

  if (scope.shadowRoot) readRootLinks(scope.shadowRoot, out);
  for (const element of scope.querySelectorAll("*")) {
    if (element.shadowRoot) readRootLinks(element.shadowRoot, out);
  }
}

// Same-origin iframes are part of the page, so read them too.
function readFrameLinks(doc, out) {
  let frames;
  try {
    frames = doc.querySelectorAll("iframe, frame");
  } catch (e) {
    return;
  }

  for (const frame of frames) {
    let childDoc = null;
    try {
      childDoc = frame.contentDocument;
    } catch (e) {
      childDoc = null; // cross-origin frame
    }
    if (childDoc && childDoc.documentElement) {
      readRootLinks(childDoc.documentElement, out);
      readFrameLinks(childDoc, out);
    }
  }
}

function readNodeLinks(node, out) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

  readElementLinks(node, out);
  for (const element of node.querySelectorAll(LINK_SELECTOR)) {
    readElementLinks(element, out);
  }

  if (node.shadowRoot) readRootLinks(node.shadowRoot, out);
  for (const element of node.querySelectorAll("*")) {
    if (element.shadowRoot) readRootLinks(element.shadowRoot, out);
  }
}

// Start watching as early as possible (document_start). Nodes that appear while
// the page is parsing and are removed again before the settings/worker are ready
// are kept as references here, so their links can still be read afterwards.
// The saved sensitivity config only controls observation after settings load.
const earlyNodes = [];
const earlyObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) earlyNodes.push(node);
    }
  }
});
earlyObserver.observe(document, { childList: true, subtree: true });

function drainEarlyNodes() {
  const nodes = earlyNodes.slice();
  earlyNodes.length = 0;
  // Records that have not been delivered yet still hold their added nodes.
  for (const record of earlyObserver.takeRecords()) {
    for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) nodes.push(node);
    }
  }
  earlyObserver.disconnect();
  return nodes;
}

function readWholeDocument(out) {
  readRootLinks(document.documentElement, out);
  readFrameLinks(document, out);
}

chrome.storage.local.get("origins", (result) => {
  const arr = result["origins"] || [];
  const matchingPatterns = typeof findMatchingPatterns === "function"
    ? findMatchingPatterns(arr, location.href)
    : (arr.includes(origin) ? [origin] : []);

  if (matchingPatterns.length === 0) {
    drainEarlyNodes();
    chrome.runtime.sendMessage({ type: "setBadge", text: "off" });
    return;
  }

  chrome.storage.local.get("sensitivities", (result) => {
    const defaults = {
      childList: false,
      subtree: false,
      attributes: false,
      attributeOldValue: false,
      characterData: false,
      characterDataOldValue: false
    };

    const allSensitivities = result.sensitivities || {};
    let config = { ...defaults };
    for (const pattern of matchingPatterns) {
      const s = allSensitivities[pattern] || {};
      for (const key of Object.keys(defaults)) {
        if (Boolean(s[key])) {
          config[key] = true;
        }
      }
    }

    if (Object.values(config).every(val => val === false)) {
      drainEarlyNodes();
      return;
    }

    async function createWorker(path) {
      const response = await fetch(chrome.runtime.getURL(path));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return new Worker(url);
    }

    createWorker("worker.js").then(worker => {
      // Raw values waiting to be sent, and values already sent.
      const pending = new Set();
      const seen = new Set();
      let flushTimer = null;

      // Storage writes are chained so overlapping worker replies can't clobber
      // each other's read-modify-write of chrome.storage.local.
      let persistChain = Promise.resolve();

      function persist(links) {
        if (!Array.isArray(links) || links.length === 0) return;
        persistChain = persistChain.then(() => new Promise(resolve => {
          chrome.storage.local.get(["links", "extraction_rules"], (result) => {
            const linksByOrigin = result["links"] || {};
            const extractionRules = result["extraction_rules"] || {};
            let anyChanged = false;
            let primaryCount = 0;

            for (const pattern of matchingPatterns) {
              const stored = linksByOrigin[pattern] || [];
              const rules = extractionRules[pattern] || {};
              const inc = (rules.includes || []).filter(r => r && r !== "YOUR_REGEX");
              const exc = (rules.excludes || []).filter(r => r && r !== "YOUR_REGEX");

              let filtered = links;
              if (inc.length > 0) {
                filtered = filtered.filter(link =>
                  inc.some(p => {
                    try { return new RegExp(p, "i").test(link); } catch (e) { return false; }
                  })
                );
              }
              if (exc.length > 0) {
                filtered = filtered.filter(link =>
                  !exc.some(p => {
                    try { return new RegExp(p, "i").test(link); } catch (e) { return false; }
                  })
                );
              }

              let includeLocation = true;
              if (inc.length > 0) {
                includeLocation = inc.some(p => {
                  try { return new RegExp(p, "i").test(location.href); } catch (e) { return false; }
                });
              }
              if (includeLocation && exc.length > 0) {
                includeLocation = !exc.some(p => {
                  try { return new RegExp(p, "i").test(location.href); } catch (e) { return false; }
                });
              }

              const toMerge = includeLocation ? filtered.concat([location.href]) : filtered;
              const merged = [...new Set(stored.concat(toMerge))];
              if (merged.length !== stored.length) {
                linksByOrigin[pattern] = merged;
                anyChanged = true;
              }
              if (pattern === matchingPatterns[0]) {
                primaryCount = merged.length;
              }
            }

            chrome.runtime.sendMessage({ type: "setBadge", text: primaryCount.toString() });

            if (!anyChanged) {
              resolve();
              return;
            }

            chrome.storage.local.set({ links: linksByOrigin }, () => {
              resolve();
            });
          });
        }));
      }

      function scheduleFlush() {
        if (flushTimer !== null) return;
        flushTimer = setTimeout(flush, 150);
      }

      function flush() {
        flushTimer = null;
        if (pending.size === 0) return;
        const urls = [...pending];
        pending.clear();
        // The worker cannot see the page, so send the base URL it needs to
        // resolve relative links.
        worker.postMessage({ urls, base: document.baseURI });
      }

      function queue(candidates) {
        let changed = false;
        for (const candidate of candidates) {
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          pending.add(candidate);
          changed = true;
        }
        if (changed) scheduleFlush();
      }

      function observeRoot(root) {
        try {
          observer.observe(root, config);
        } catch (e) {
          // Already observed or not observable.
        }
      }

      function observeShadowRoots(nodes) {
        for (const node of nodes) {
          if (node.shadowRoot) observeRoot(node.shadowRoot);
          for (const element of node.querySelectorAll("*")) {
            if (element.shadowRoot) observeRoot(element.shadowRoot);
          }
        }
      }

      const observer = new MutationObserver((mutations) => {
        const addedNodes = [];
        const targets = new Set();

        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) addedNodes.push(node);
            }
          } else if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
            targets.add(mutation.target);
          }
        }

        if (addedNodes.length) {
          const found = new Set();
          for (const node of addedNodes) readNodeLinks(node, found);
          queue(found);
          observeShadowRoots(addedNodes);
        }

        if (targets.size) {
          const found = new Set();
          for (const target of targets) readNodeLinks(target, found);
          queue(found);
        }
      });

      // Attach the real observer. At document_start the <html> element (and
      // even <head>) may not exist yet, so wait for documentElement first.
      function startObserving() {
        if (document.documentElement) {
          observeRoot(document.documentElement);
          return;
        }
        const ready = new MutationObserver(() => {
          if (!document.documentElement) return;
          ready.disconnect();
          const found = new Set();
          readWholeDocument(found);
          queue(found);
          observeRoot(document.documentElement);
        });
        ready.observe(document, { childList: true, subtree: true });
      }

      worker.onmessage = function (event) {
        persist(event.data);
      };

      // 1) Everything the early observer saw while the page was parsing.
      const initial = new Set();
      for (const node of drainEarlyNodes()) {
        readNodeLinks(node, initial);
      }
      // 2) Whatever is in the document right now (head included, shadow DOM and
      //    same-origin iframes included).
      readWholeDocument(initial);
      queue(initial);

      // 3) Watch for changes from now on.
      startObserving();

      // 4) Watch and capture network resource timing entries (fetch, XHR, scripts, styles, beacons, etc.)
      function captureResources() {
        if (typeof performance === "undefined" || !performance.getEntriesByType) return;
        try {
          const resources = performance.getEntriesByType("resource");
          const urls = [];
          for (const res of resources) {
            if (res && res.name) urls.push(res.name);
          }
          if (urls.length) queue(urls);
        } catch (e) {}

        // Check same-origin iframes for network resources
        try {
          const frames = document.querySelectorAll("iframe, frame");
          for (const frame of frames) {
            try {
              const childDoc = frame.contentDocument;
              if (childDoc && childDoc.defaultView && childDoc.defaultView.performance) {
                const res = childDoc.defaultView.performance.getEntriesByType("resource");
                const urls = [];
                for (const r of res) {
                  if (r && r.name) urls.push(r.name);
                }
                if (urls.length) queue(urls);
              }
            } catch (err) {}
          }
        } catch (e) {}
      }

      function observeNetworkResources() {
        captureResources();

        if (typeof PerformanceObserver !== "undefined") {
          try {
            const perfObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const urls = [];
              for (const entry of entries) {
                if (entry && entry.name) urls.push(entry.name);
              }
              if (urls.length) queue(urls);
            });
            perfObserver.observe({ type: "resource", buffered: true });
          } catch (e) {
            try {
              const perfObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const urls = [];
                for (const entry of entries) {
                  if (entry && entry.name) urls.push(entry.name);
                }
                if (urls.length) queue(urls);
              });
              perfObserver.observe({ entryTypes: ["resource"] });
            } catch (err) {}
          }
        }

        window.addEventListener("load", captureResources, { once: true });
      }

      observeNetworkResources();
    });
  });
});
