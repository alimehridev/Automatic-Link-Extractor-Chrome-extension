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

chrome.storage.local.get("origins", (result) => {
  const arr = result["origins"] || [];
  if (!arr.includes(origin)) {
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

    const s = (result.sensitivities && result.sensitivities[origin]) || {};
    const config = {
      ...defaults,
      ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Boolean(v)]))
    };
    if (Object.values(config).every(val => val === false)) return;

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
          chrome.storage.local.get("links", (result) => {
            const linksByOrigin = result["links"] || {};
            const stored = linksByOrigin[origin] || [];
            const merged = [...new Set(stored.concat(links, [location.href]))];
            if (merged.length === stored.length) {
              resolve();
              return;
            }
            linksByOrigin[origin] = merged;
            chrome.runtime.sendMessage({ type: "setBadge", text: merged.length.toString() });
            chrome.storage.local.set({ links: linksByOrigin }, () => {
              window.postMessage({
                action: "continue",
                url: location.href
              });
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

      worker.onmessage = function (event) {
        persist(event.data);
      };

      // Read what already exists (head included, shadow DOM and same-origin
      // iframes included), then watch for changes.
      const initial = new Set();
      readRootLinks(document.documentElement, initial);
      readFrameLinks(document, initial);
      queue(initial);

      observeRoot(document.documentElement);
    });
  });
});
