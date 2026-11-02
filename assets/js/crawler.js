// assets/js/crawler.js
// Auto Crawler Engine & Dashboard Controller

(function () {
  "use strict";

  // 1. Get Target from URL
  const params = new URLSearchParams(window.location.search);
  const currentTarget = params.get("origin") || "";

  // DOM Elements
  const backToDashBtn = document.getElementById("backToDashBtn");
  const targetOriginDisplay = document.getElementById("targetOriginDisplay");
  const crawlerStatusBadge = document.getElementById("crawlerStatusBadge");
  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const progressSummary = document.getElementById("progressSummary");
  const depthIndicator = document.getElementById("depthIndicator");
  const crawledCountEl = document.getElementById("crawledCount");
  const remainingCountEl = document.getElementById("remainingCount");
  const totalCountEl = document.getElementById("totalCount");
  const currentLinkText = document.getElementById("currentLinkText");

  // Controls
  const startCrawlerBtn = document.getElementById("startCrawlerBtn");
  const pauseCrawlerBtn = document.getElementById("pauseCrawlerBtn");
  const resumeCrawlerBtn = document.getElementById("resumeCrawlerBtn");
  const stopCrawlerBtn = document.getElementById("stopCrawlerBtn");
  const resetCrawlerBtn = document.getElementById("resetCrawlerBtn");

  // Settings
  const crawlerDelayInput = document.getElementById("crawlerDelay");
  const crawlerDelayValue = document.getElementById("crawlerDelayValue");
  const crawlerMaxDepthInput = document.getElementById("crawlerMaxDepth");
  const crawlerMaxDepthValue = document.getElementById("crawlerMaxDepthValue");
  const crawlerMaxPagesInput = document.getElementById("crawlerMaxPages");
  const crawlerMaxPagesValue = document.getElementById("crawlerMaxPagesValue");
  const crawlerStayInScopeCheckbox = document.getElementById("crawlerStayInScope");
  const settingsSavedIndicator = document.getElementById("settingsSavedIndicator");

  // Logs
  const logsContainer = document.getElementById("logsContainer");
  const emptyLogsMsg = document.getElementById("emptyLogsMsg");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  // Internal state tracking
  let isCrawlLoopRunning = false;
  let saveTimer = null;

  // Non-HTML asset extensions to filter out from crawling queue
  const STATIC_ASSET_EXTS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
    ".css", ".js", ".mjs",
    ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".exe", ".dmg", ".apk", ".bin"
  ]);

  // Utility: Storage Promise Wrappers
  function getStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => resolve(res || {}));
    });
  }

  function setStorage(obj) {
    return new Promise((resolve) => {
      chrome.storage.local.set(obj, () => resolve());
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 2. Validate Target
  if (!currentTarget) {
    targetOriginDisplay.textContent = "No target origin specified!";
    targetOriginDisplay.style.color = "#dc2626";
    startCrawlerBtn.disabled = true;
    currentLinkText.textContent = "Please return to the dashboard and select a target origin.";
    backToDashBtn.addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });
    return;
  }

  targetOriginDisplay.textContent = currentTarget;
  backToDashBtn.addEventListener("click", () => {
    window.location.href = `dashboard.html?origin=${encodeURIComponent(currentTarget)}`;
  });

  // 3. Initialize or Load Storage State
  async function initCrawlerState() {
    const res = await getStorage(["crawler_state", "crawler_configs", "links"]);
    const savedConfigs = res.crawler_configs || {};
    const targetConfig = savedConfigs[currentTarget] || {
      delaySeconds: 1.5,
      maxDepth: 3,
      maxPages: 200,
      stayInScope: true
    };

    // Apply settings to UI inputs
    applySettingsToInputs(targetConfig);

    let state = res.crawler_state;
    const storedLinks = (res.links && res.links[currentTarget]) || [];

    // Check if state exists for this target
    if (state && state.target === currentTarget) {
      // Existing state for this target, preserve it
      state.settings = { ...targetConfig, ...(state.settings || {}) };

      // If crawler is still idle and has not visited pages yet,
      // sync the queue with the full list of stored links so all available links appear
      if (state.status === "idle" && (!state.visited || state.visited.length === 0)) {
        const fullQueue = buildInitialQueue(currentTarget, storedLinks);
        state.queue = fullQueue;
        state.totalCount = fullQueue.length;
        state.depthMap = state.depthMap || {};
        fullQueue.forEach(u => {
          if (!state.depthMap[u]) state.depthMap[u] = 1;
        });
      }

      updateUI(state);
      await setStorage({ crawler_state: state });
    } else {
      // Create fresh state for this target
      const seedQueue = buildInitialQueue(currentTarget, storedLinks);

      const depthMap = {};
      seedQueue.forEach(u => { depthMap[u] = 1; });

      state = {
        target: currentTarget,
        status: "idle",
        currentLink: "",
        crawledCount: 0,
        totalCount: seedQueue.length,
        percentage: 0,
        queue: seedQueue,
        visited: [],
        depthMap: depthMap,
        settings: targetConfig,
        logs: []
      };

      await setStorage({ crawler_state: state });
      updateUI(state);
    }

    // Auto-resume if status was running
    if (state.status === "running" && !isCrawlLoopRunning) {
      runCrawlLoop();
    }
  }

  function buildInitialQueue(target, storedLinks) {
    const queue = [];

    // If target itself is a valid URL (not pure wildcard), add as root
    if (/^https?:\/\//i.test(target) && !target.includes("*")) {
      queue.push(target);
    } else {
      // If wildcard target (e.g. *.example.com or *://example.com/*), try to construct root
      const cleaned = target.replace(/^\*:\/\/|\/\*$/g, "").replace(/^\*\./, "https://");
      if (/^https?:\/\//i.test(cleaned)) {
        queue.push(cleaned);
      }
    }

    // Add all existing discovered links from storage
    if (Array.isArray(storedLinks)) {
      for (const link of storedLinks) {
        if (typeof link === "string" && /^https?:\/\//i.test(link)) {
          const clean = link.split("#")[0].trim();
          if (clean && !queue.includes(clean) && !isStaticAsset(clean)) {
            queue.push(clean);
          }
        }
      }
    }

    return queue.length > 0 ? queue : [currentTarget];
  }

  function applySettingsToInputs(settings) {
    if (!settings) return;
    crawlerDelayInput.value = settings.delaySeconds ?? 1.5;
    crawlerDelayValue.textContent = `${crawlerDelayInput.value}s`;

    crawlerMaxDepthInput.value = settings.maxDepth ?? 3;
    crawlerMaxDepthValue.textContent = crawlerMaxDepthInput.value;

    crawlerMaxPagesInput.value = settings.maxPages ?? 200;
    crawlerMaxPagesValue.textContent = crawlerMaxPagesInput.value;

    crawlerStayInScopeCheckbox.checked = settings.stayInScope !== false;
  }

  // 4. Update UI Elements
  function updateUI(state) {
    if (!state) return;

    // Status Badge
    crawlerStatusBadge.className = `status-badge status-${state.status || "idle"}`;
    crawlerStatusBadge.textContent = (state.status || "idle").toUpperCase();

    // Stats
    const crawled = (state.visited && state.visited.length) || 0;
    const remaining = (state.queue && state.queue.length) || 0;
    const total = crawled + remaining;
    const pct = total > 0 ? Math.min(100, Math.round((crawled / total) * 100)) : 0;

    crawledCountEl.textContent = crawled.toLocaleString();
    remainingCountEl.textContent = remaining.toLocaleString();
    totalCountEl.textContent = total.toLocaleString();

    progressBar.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;
    progressSummary.textContent = `${crawled} of ${total} links crawled`;

    // Current Depth
    const currentUrl = state.currentLink || "";
    const currentDepth = (state.depthMap && state.depthMap[currentUrl]) || (crawled > 0 ? 1 : 0);
    depthIndicator.textContent = `Depth: ${currentDepth}`;

    // Current Link
    if (state.status === "running" && state.currentLink) {
      currentLinkText.textContent = state.currentLink;
      currentLinkText.title = state.currentLink;
    } else if (state.status === "paused") {
      currentLinkText.textContent = `(Paused) Last URL: ${state.currentLink || "None"}`;
      currentLinkText.title = state.currentLink || "";
    } else if (state.status === "completed") {
      currentLinkText.textContent = "✅ Crawling completed for all discovered pages in scope!";
      currentLinkText.title = "Completed";
    } else if (state.status === "stopped") {
      currentLinkText.textContent = "⏹ Crawling stopped by user.";
      currentLinkText.title = "Stopped";
    } else {
      currentLinkText.textContent = remaining > 0 ? `Ready. ${remaining} links queued.` : "Waiting to start...";
      currentLinkText.title = currentLinkText.textContent;
    }

    // Button states
    const status = state.status || "idle";
    if (status === "running") {
      startCrawlerBtn.style.display = "none";
      resumeCrawlerBtn.style.display = "none";
      pauseCrawlerBtn.style.display = "inline-flex";
      pauseCrawlerBtn.disabled = false;
      stopCrawlerBtn.disabled = false;
      resetCrawlerBtn.disabled = true;
    } else if (status === "paused") {
      startCrawlerBtn.style.display = "none";
      pauseCrawlerBtn.style.display = "none";
      resumeCrawlerBtn.style.display = "inline-flex";
      resumeCrawlerBtn.disabled = false;
      stopCrawlerBtn.disabled = false;
      resetCrawlerBtn.disabled = false;
    } else {
      // idle, stopped, completed
      startCrawlerBtn.style.display = "inline-flex";
      startCrawlerBtn.disabled = remaining === 0 && crawled > 0;
      pauseCrawlerBtn.style.display = "none";
      resumeCrawlerBtn.style.display = "none";
      stopCrawlerBtn.disabled = true;
      resetCrawlerBtn.disabled = false;
    }

    // Render Logs
    renderLogs(state.logs || []);
  }

  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      emptyLogsMsg.style.display = "block";
      logsContainer.innerHTML = "";
      logsContainer.appendChild(emptyLogsMsg);
      return;
    }

    emptyLogsMsg.style.display = "none";
    logsContainer.innerHTML = "";

    // Show most recent 100 logs in reverse chronological order
    const slice = logs.slice(-100).reverse();
    for (const item of slice) {
      const row = document.createElement("div");
      row.className = "log-item";

      const time = document.createElement("span");
      time.className = "log-time";
      time.textContent = item.time || "";

      const status = document.createElement("span");
      status.className = item.success ? "log-status-ok" : "log-status-err";
      status.textContent = item.success ? "✓" : "✗";

      const url = document.createElement("span");
      url.className = "log-url";
      url.textContent = item.url;
      url.title = item.url;

      const badge = document.createElement("span");
      badge.className = "log-extracted-count";
      badge.textContent = item.note || (item.count ? `+${item.count} links` : "");

      row.appendChild(time);
      row.appendChild(status);
      row.appendChild(url);
      row.appendChild(badge);

      logsContainer.appendChild(row);
    }
  }

  // 5. Dynamic Settings Auto-save & Event Listeners
  function handleSettingChange() {
    crawlerDelayValue.textContent = `${crawlerDelayInput.value}s`;
    crawlerMaxDepthValue.textContent = crawlerMaxDepthInput.value;
    crawlerMaxPagesValue.textContent = crawlerMaxPagesInput.value;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const newSettings = {
        delaySeconds: parseFloat(crawlerDelayInput.value) || 1.5,
        maxDepth: parseInt(crawlerMaxDepthInput.value, 10) || 3,
        maxPages: parseInt(crawlerMaxPagesInput.value, 10) || 200,
        stayInScope: crawlerStayInScopeCheckbox.checked
      };

      const res = await getStorage(["crawler_state", "crawler_configs"]);
      const state = res.crawler_state || {};
      state.settings = newSettings;

      const configs = res.crawler_configs || {};
      configs[currentTarget] = newSettings;

      await setStorage({ crawler_state: state, crawler_configs: configs });

      // Flash "Saved ✓"
      settingsSavedIndicator.classList.add("visible");
      setTimeout(() => {
        settingsSavedIndicator.classList.remove("visible");
      }, 1500);
    }, 200);
  }

  crawlerDelayInput.addEventListener("input", handleSettingChange);
  crawlerMaxDepthInput.addEventListener("input", handleSettingChange);
  crawlerMaxPagesInput.addEventListener("input", handleSettingChange);
  crawlerStayInScopeCheckbox.addEventListener("change", handleSettingChange);

  // 6. Crawler Loop & Controls
  startCrawlerBtn.addEventListener("click", async () => {
    const res = await getStorage(["crawler_state", "links"]);
    let state = res.crawler_state || {};

    // If queue is empty, re-seed
    if (!state.queue || state.queue.length === 0) {
      const storedLinks = (res.links && res.links[currentTarget]) || [];
      state.queue = buildInitialQueue(currentTarget, storedLinks);
      state.depthMap = state.depthMap || {};
      state.queue.forEach(u => {
        if (!state.depthMap[u]) state.depthMap[u] = 1;
      });
    }

    state.status = "running";
    await setStorage({ crawler_state: state });
    updateUI(state);
    runCrawlLoop();
  });

  resumeCrawlerBtn.addEventListener("click", async () => {
    const res = await getStorage(["crawler_state"]);
    const state = res.crawler_state || {};
    state.status = "running";
    await setStorage({ crawler_state: state });
    updateUI(state);
    runCrawlLoop();
  });

  pauseCrawlerBtn.addEventListener("click", async () => {
    const res = await getStorage(["crawler_state"]);
    const state = res.crawler_state || {};
    state.status = "paused";
    await setStorage({ crawler_state: state });
    updateUI(state);
  });

  stopCrawlerBtn.addEventListener("click", async () => {
    const res = await getStorage(["crawler_state"]);
    const state = res.crawler_state || {};
    state.status = "stopped";
    state.currentLink = "";
    await setStorage({ crawler_state: state });
    updateUI(state);
  });

  resetCrawlerBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset the crawl queue and visited set back to the target root?")) {
      return;
    }
    const res = await getStorage(["crawler_state", "links", "crawler_configs"]);
    const storedLinks = (res.links && res.links[currentTarget]) || [];
    const seedQueue = buildInitialQueue(currentTarget, storedLinks);
    const depthMap = {};
    seedQueue.forEach(u => { depthMap[u] = 1; });

    const state = {
      target: currentTarget,
      status: "idle",
      currentLink: "",
      crawledCount: 0,
      totalCount: seedQueue.length,
      percentage: 0,
      queue: seedQueue,
      visited: [],
      depthMap: depthMap,
      settings: (res.crawler_state && res.crawler_state.settings) || {
        delaySeconds: 1.5,
        maxDepth: 3,
        maxPages: 200,
        stayInScope: true
      },
      logs: []
    };

    await setStorage({ crawler_state: state });
    updateUI(state);
  });

  clearLogsBtn.addEventListener("click", async () => {
    const res = await getStorage(["crawler_state"]);
    const state = res.crawler_state || {};
    state.logs = [];
    await setStorage({ crawler_state: state });
    updateUI(state);
  });

  // 7. Core Crawl Loop
  async function runCrawlLoop() {
    if (isCrawlLoopRunning) return;
    isCrawlLoopRunning = true;

    try {
      while (true) {
        // ALWAYS fetch the latest state from storage before crawling each link!
        // This ensures mid-crawl settings changes are immediately respected.
        const res = await getStorage(["crawler_state", "links", "extraction_rules"]);
        const state = res.crawler_state;

        if (!state || state.target !== currentTarget) break;
        if (state.status !== "running") break;

        const settings = state.settings || {
          delaySeconds: 1.5,
          maxDepth: 3,
          maxPages: 200,
          stayInScope: true
        };

        // Check completion limits
        if (!state.queue || state.queue.length === 0 || state.visited.length >= settings.maxPages) {
          state.status = "completed";
          state.currentLink = "";
          addLogEntry(state, true, currentTarget, "Finished! All discovered URLs crawled.", 0);
          await setStorage({ crawler_state: state });
          updateUI(state);
          break;
        }

        // Pop next URL
        const nextUrl = state.queue.shift();
        if (state.visited.includes(nextUrl)) {
          // Already visited, save shifted queue and proceed
          await setStorage({ crawler_state: state });
          continue;
        }

        // Mark current link
        state.currentLink = nextUrl;
        const currentDepth = (state.depthMap && state.depthMap[nextUrl]) || 1;
        updateUI(state);
        await setStorage({ crawler_state: state });

        // Crawl the URL
        let extractedCount = 0;
        let isSuccess = false;
        let logNote = "";

        try {
          const fetchResp = await fetch(nextUrl, {
            headers: {
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
          });

          if (fetchResp.ok) {
            isSuccess = true;
            const htmlText = await fetchResp.text();
            const doc = new DOMParser().parseFromString(htmlText, "text/html");
            const baseUri = fetchResp.url || nextUrl;

            // Extract all links
            const rawLinks = extractLinksFromDocument(doc, baseUri);

            // Filter with target extraction rules (Include / Exclude regexes)
            const targetRules = (res.extraction_rules && res.extraction_rules[currentTarget]) || { include: [], exclude: [] };
            const filteredLinks = filterLinksWithRules(rawLinks, targetRules);

            extractedCount = filteredLinks.length;
            logNote = `+${extractedCount} links found`;

            // Persist newly discovered links into target's main link storage
            const currentStored = (res.links && res.links[currentTarget]) || [];
            const mergedStored = [...new Set([...currentStored, ...filteredLinks])];
            if (mergedStored.length !== currentStored.length) {
              const linksObj = res.links || {};
              linksObj[currentTarget] = mergedStored;
              await setStorage({ links: linksObj });
            }

            // Enqueue subsequent links if depth limit allows
            if (currentDepth < settings.maxDepth) {
              for (const candidate of filteredLinks) {
                if (state.visited.length + state.queue.length >= settings.maxPages) {
                  break;
                }

                // Scope validation
                if (settings.stayInScope && !isUrlInScope(candidate, currentTarget)) {
                  continue;
                }

                // Filter out non-crawlable static asset files
                if (isStaticAsset(candidate)) {
                  continue;
                }

                // Canonicalize candidate (strip fragment #)
                const cleanCandidate = candidate.split("#")[0].trim();
                if (!cleanCandidate) continue;

                if (!state.visited.includes(cleanCandidate) && !state.queue.includes(cleanCandidate)) {
                  state.queue.push(cleanCandidate);
                  state.depthMap = state.depthMap || {};
                  state.depthMap[cleanCandidate] = currentDepth + 1;
                }
              }
            }
          } else {
            logNote = `HTTP ${fetchResp.status} ${fetchResp.statusText || ""}`;
          }
        } catch (err) {
          logNote = `Error: ${err.message || "Network error"}`;
        }

        // Add to visited
        state.visited.push(nextUrl);
        state.crawledCount = state.visited.length;
        const total = state.visited.length + state.queue.length;
        state.totalCount = total;
        state.percentage = total > 0 ? Math.round((state.crawledCount / total) * 100) : 100;

        addLogEntry(state, isSuccess, nextUrl, logNote, extractedCount);

        await setStorage({ crawler_state: state });
        updateUI(state);

        // Pause for delaySeconds before next request (respecting dynamic settings)
        const delayMs = Math.max(500, (settings.delaySeconds || 1.5) * 1000);
        await sleep(delayMs);
      }
    } finally {
      isCrawlLoopRunning = false;
    }
  }

  // Helper: Extract Links from HTML DOM
  function extractLinksFromDocument(doc, baseUri) {
    const out = new Set();
    const LINK_ATTRS = ["href", "src", "action", "data-url", "data-href", "data-src"];
    const selector = LINK_ATTRS.map(a => `[${a}]`).join(",");

    for (const el of doc.querySelectorAll(selector)) {
      for (const attr of LINK_ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        const val = el.getAttribute(attr);
        if (!val) continue;

        try {
          const resolved = new URL(val.trim(), baseUri).href;
          if (/^https?:\/\//i.test(resolved)) {
            out.add(resolved);
          }
        } catch (e) {
          // ignore malformed URLs
        }
      }
    }

    return Array.from(out);
  }

  // Helper: Apply Include / Exclude Extraction Rules
  function filterLinksWithRules(links, rules) {
    if (!rules) return links;
    let list = links;

    const inc = rules.include || [];
    const exc = rules.exclude || [];

    if (inc.length > 0) {
      list = list.filter(link => {
        return inc.some(pattern => {
          try { return new RegExp(pattern, "i").test(link); } catch (e) { return false; }
        });
      });
    }

    if (exc.length > 0) {
      list = list.filter(link => {
        return !exc.some(pattern => {
          try { return new RegExp(pattern, "i").test(link); } catch (e) { return false; }
        });
      });
    }

    return list;
  }

  // Helper: Scope Checking
  function isUrlInScope(url, pattern) {
    if (typeof findMatchingPatterns === "function") {
      try {
        const matched = findMatchingPatterns([pattern], url);
        return Array.isArray(matched) && matched.length > 0;
      } catch (e) { }
    }
    // Fallback: substring / domain check
    try {
      const u = new URL(url);
      const p = pattern.replace(/^\*:\/\/|\/\*$/g, "").replace(/^\*\./, "");
      return u.hostname.includes(p) || p.includes(u.hostname);
    } catch (e) {
      return false;
    }
  }

  // Helper: Detect Non-HTML Media Assets
  function isStaticAsset(url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      const dotIdx = pathname.lastIndexOf(".");
      if (dotIdx !== -1) {
        const ext = pathname.slice(dotIdx);
        if (STATIC_ASSET_EXTS.has(ext)) return true;
      }
    } catch (e) { }
    return false;
  }

  // Helper: Log Management
  function addLogEntry(state, isSuccess, url, note, count) {
    state.logs = state.logs || [];
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    state.logs.push({
      time: timeStr,
      success: Boolean(isSuccess),
      url: url,
      note: note || "",
      count: count || 0
    });

    if (state.logs.length > 200) {
      state.logs.shift();
    }
  }

  // 8. Storage Changed Listener (Sync across tabs)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.crawler_state) {
      const newState = changes.crawler_state.newValue;
      if (newState && newState.target === currentTarget) {
        updateUI(newState);
      }
    }
  });

  // 9. Initial Load
  initCrawlerState();
})();

