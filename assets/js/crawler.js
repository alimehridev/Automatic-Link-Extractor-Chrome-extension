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
  const crawlerTimeoutInput = document.getElementById("crawlerTimeout");
  const crawlerTimeoutValue = document.getElementById("crawlerTimeoutValue");
  const crawlerExcludedExtensionsInput = document.getElementById("crawlerExcludedExtensions");
  const crawlerExcludedCount = document.getElementById("crawlerExcludedCount");
  const crawlerExcludedUrlsInput = document.getElementById("crawlerExcludedUrls");
  const crawlerExcludedUrlsCount = document.getElementById("crawlerExcludedUrlsCount");
  const crawlerHeadersList = document.getElementById("crawlerHeadersList");
  const addHeaderBtn = document.getElementById("addHeaderBtn");
  const crawlerHeadersCount = document.getElementById("crawlerHeadersCount");
  const settingsSavedIndicator = document.getElementById("settingsSavedIndicator");
  const crawlerSettingsCard = document.getElementById("crawlerSettingsCard");
  const crawlerSettingsHeader = document.getElementById("crawlerSettingsHeader");
  const toggleSettingsBtn = document.getElementById("toggleSettingsBtn");
  const toggleSettingsText = document.getElementById("toggleSettingsText");
  const toggleSettingsIcon = document.getElementById("toggleSettingsIcon");

  // Tab-driven Navigation Settings
  const crawlerUseTabNavigationCheckbox = document.getElementById("crawlerUseTabNavigation");
  const tabNavOptionsContainer = document.getElementById("tabNavOptions");
  const crawlerPageWaitDelayInput = document.getElementById("crawlerPageWaitDelay");
  const crawlerPageWaitDelayValue = document.getElementById("crawlerPageWaitDelayValue");
  const crawlerTabBackgroundCheckbox = document.getElementById("crawlerTabBackground");
  const crawlerAutoCloseTabCheckbox = document.getElementById("crawlerAutoCloseTab");

  // Logs
  const logsContainer = document.getElementById("logsContainer");
  const emptyLogsMsg = document.getElementById("emptyLogsMsg");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  // Internal state tracking
  let isCrawlLoopRunning = false;
  let saveTimer = null;
  let crawlerTabId = null;
  const CRAWLER_SESSION_RULE_ID = 8888;

  // Default non-HTML asset extensions to filter out from crawling queue
  const DEFAULT_EXCLUDED_EXTS_STR = "png, jpg, jpeg, gif, svg, webp, ico, css, js, mjs, pdf, zip, tar, gz, rar, 7z, mp3, mp4, wav, avi, mov, webm, woff, woff2, ttf, eot, otf, exe, dmg, apk, bin";

  // Validate and parse comma-separated extensions into a Set of lowercased ".ext" strings
  function parseAndValidateExtensions(rawInput) {
    if (typeof rawInput !== "string") {
      rawInput = DEFAULT_EXCLUDED_EXTS_STR;
    }
    const cleanTokens = [];
    const extSet = new Set();
    const invalidTokens = [];
    const validExtRegex = /^[a-zA-Z0-9_\-]+$/;

    const parts = rawInput.split(",");
    for (const part of parts) {
      let trimmed = part.trim().toLowerCase();
      if (!trimmed) continue;
      trimmed = trimmed.replace(/^\.+/, "");
      if (!trimmed) continue;

      if (validExtRegex.test(trimmed)) {
        const dotExt = "." + trimmed;
        if (!extSet.has(dotExt)) {
          extSet.add(dotExt);
          cleanTokens.push(trimmed);
        }
      } else {
        invalidTokens.push(trimmed);
      }
    }

    return {
      isValid: invalidTokens.length === 0,
      invalidTokens: invalidTokens,
      normalizedString: cleanTokens.join(", "),
      extSet: extSet,
      count: extSet.size
    };
  }

  // Parse multiline or comma-separated URL blacklist patterns
  function parseExcludedUrlPatterns(rawInput) {
    if (typeof rawInput !== "string") return [];
    const lines = rawInput.split(/[\r\n,]+/);
    const patterns = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !patterns.includes(trimmed)) {
        patterns.push(trimmed);
      }
    }
    return patterns;
  }

  // Synchronize newly discovered in-scope links from storage into the active queue
  function syncStoredLinksIntoQueue(state, storedLinks, extSet, blacklistPatterns, defaultDepth = 1) {
    if (!state || !Array.isArray(storedLinks) || storedLinks.length === 0) return 0;
    if (!Array.isArray(state.queue)) state.queue = [];
    if (!Array.isArray(state.visited)) state.visited = [];

    const visitedSet = new Set(state.visited);
    const queueSet = new Set(state.queue);
    let addedCount = 0;

    for (const rawLink of storedLinks) {
      if (typeof rawLink !== "string") continue;
      const clean = rawLink.split("#")[0].trim();
      if (!clean || !/^https?:\/\//i.test(clean)) continue;

      // Must be strictly inside target scope
      if (!isUrlInScope(clean, currentTarget)) continue;

      // Must not be blacklisted
      if (isUrlBlacklisted(clean, blacklistPatterns)) continue;

      // Must not be a static asset
      if (isStaticAsset(clean, extSet)) continue;

      if (!visitedSet.has(clean) && !queueSet.has(clean)) {
        state.queue.push(clean);
        queueSet.add(clean);
        state.depthMap = state.depthMap || {};
        if (!state.depthMap[clean]) {
          state.depthMap[clean] = defaultDepth;
        }
        addedCount++;
      }
    }

    if (addedCount > 0) {
      const total = state.visited.length + state.queue.length;
      state.totalCount = total;
      state.percentage = total > 0 ? Math.round((state.visited.length / total) * 100) : 0;
    }

    return addedCount;
  }

  // Custom HTTP Headers Helpers
  function getCustomHeadersFromUI() {
    if (!crawlerHeadersList) return [];
    const rows = crawlerHeadersList.querySelectorAll(".header-row");
    const headers = [];
    rows.forEach((row) => {
      const nameInput = row.querySelector(".header-name-input");
      const valInput = row.querySelector(".header-value-input");
      const name = nameInput ? nameInput.value.trim() : "";
      const val = valInput ? valInput.value.trim() : "";
      if (name) {
        headers.push({ name, value: val });
      }
    });
    return headers;
  }

  function createHeaderRowElement(headerName = "", headerValue = "") {
    const row = document.createElement("div");
    row.className = "header-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "setting-input header-name-input";
    nameInput.placeholder = "Header Name (e.g. Authorization)";
    nameInput.value = headerName;

    const valInput = document.createElement("input");
    valInput.type = "text";
    valInput.className = "setting-input header-value-input";
    valInput.placeholder = "Header Value (e.g. Bearer token)";
    valInput.value = headerValue;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "header-remove-btn";
    removeBtn.title = "Remove this header";
    removeBtn.textContent = "✕";

    // Auto-split on "Name: Value" if pasted or typed into name input
    nameInput.addEventListener("input", () => {
      const raw = nameInput.value;
      if (raw.includes(":") && !valInput.value) {
        const colonIdx = raw.indexOf(":");
        const pName = raw.slice(0, colonIdx).trim();
        const pVal = raw.slice(colonIdx + 1).trim();
        if (pName) {
          nameInput.value = pName;
          valInput.value = pVal;
        }
      }
      handleSettingChange();
    });

    valInput.addEventListener("input", handleSettingChange);

    removeBtn.addEventListener("click", () => {
      row.remove();
      ensureHeadersEmptyHint();
      handleSettingChange();
    });

    row.appendChild(nameInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    return row;
  }

  function ensureHeadersEmptyHint() {
    if (!crawlerHeadersList) return;
    const existingRows = crawlerHeadersList.querySelectorAll(".header-row");
    let hint = crawlerHeadersList.querySelector(".headers-empty-hint");
    if (existingRows.length === 0) {
      if (!hint) {
        hint = document.createElement("div");
        hint.className = "headers-empty-hint";
        hint.textContent = "No custom headers configured. Click \"+ Add Header\" to define custom request headers.";
        crawlerHeadersList.appendChild(hint);
      }
    } else {
      if (hint) hint.remove();
    }
  }

  function renderHeadersUI(headersArray = []) {
    if (!crawlerHeadersList) return;
    crawlerHeadersList.innerHTML = "";
    if (Array.isArray(headersArray) && headersArray.length > 0) {
      headersArray.forEach((h) => {
        if (h && typeof h.name === "string" && h.name.trim()) {
          const rowEl = createHeaderRowElement(h.name, h.value || "");
          crawlerHeadersList.appendChild(rowEl);
        }
      });
    }
    ensureHeadersEmptyHint();
    const count = crawlerHeadersList.querySelectorAll(".header-row").length;
    if (crawlerHeadersCount) {
      crawlerHeadersCount.textContent = `${count} ${count === 1 ? "header" : "headers"}`;
    }
  }

  function buildHeadersObject(customHeaders) {
    const headers = {};
    if (Array.isArray(customHeaders)) {
      for (const h of customHeaders) {
        if (!h || !h.name) continue;
        const key = String(h.name).trim();
        if (!key) continue;
        const val = h.value !== undefined && h.value !== null ? String(h.value).trim() : "";
        headers[key] = val;
      }
    }
    return headers;
  }

  async function syncCrawlerTabHeaders(tabId, customHeaders) {
    if (!chrome.declarativeNetRequest?.updateSessionRules) {
      return;
    }
    try {
      const validHeaders = [];
      if (Array.isArray(customHeaders)) {
        for (const h of customHeaders) {
          if (!h || !h.name) continue;
          const name = String(h.name).trim();
          if (!name) continue;
          const value = h.value !== undefined && h.value !== null ? String(h.value).trim() : "";
          validHeaders.push({
            header: name,
            operation: "set",
            value: value
          });
        }
      }

      if (validHeaders.length === 0 || !tabId) {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [CRAWLER_SESSION_RULE_ID]
        });
        return;
      }

      const rule = {
        id: CRAWLER_SESSION_RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: validHeaders
        },
        condition: {
          tabIds: [tabId],
          resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "other"]
        }
      };

      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [CRAWLER_SESSION_RULE_ID],
        addRules: [rule]
      });
    } catch (e) {
      console.warn("Could not update declarativeNetRequest session rules:", e);
    }
  }

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

  // Tab Navigation Visibility Helper
  function syncTabNavOptionsVisibility() {
    if (!tabNavOptionsContainer || !crawlerUseTabNavigationCheckbox) return;
    if (crawlerUseTabNavigationCheckbox.checked) {
      tabNavOptionsContainer.style.opacity = "1";
      tabNavOptionsContainer.style.pointerEvents = "auto";
    } else {
      tabNavOptionsContainer.style.opacity = "0.45";
      tabNavOptionsContainer.style.pointerEvents = "none";
    }
  }

  // 3. Initialize or Load Storage State
  async function initCrawlerState() {
    const res = await getStorage(["crawler_state", "crawler_configs", "links"]);
    const savedConfigs = res.crawler_configs || {};
    const targetConfig = savedConfigs[currentTarget] || {
      delaySeconds: 1.5,
      maxDepth: 3,
      maxPages: 0,
      timeoutSeconds: 15,
      stayInScope: true,
      excludedExtensions: DEFAULT_EXCLUDED_EXTS_STR,
      excludedUrls: "",
      customHeaders: [],
      useTabNavigation: false,
      pageWaitDelay: 2.0,
      tabBackground: true,
      autoCloseTab: true
    };
    if (targetConfig.maxPages === undefined || targetConfig.maxPages === 200) {
      targetConfig.maxPages = 0;
    }
    if (targetConfig.timeoutSeconds === undefined) {
      targetConfig.timeoutSeconds = 15;
    }
    if (targetConfig.excludedExtensions === undefined) {
      targetConfig.excludedExtensions = DEFAULT_EXCLUDED_EXTS_STR;
    }
    if (targetConfig.excludedUrls === undefined) {
      targetConfig.excludedUrls = "";
    }
    if (!Array.isArray(targetConfig.customHeaders)) {
      targetConfig.customHeaders = [];
    }

    // Apply settings to UI inputs
    applySettingsToInputs(targetConfig);

    let state = res.crawler_state;
    const storedLinks = (res.links && res.links[currentTarget]) || [];
    const extVal = parseAndValidateExtensions(targetConfig.excludedExtensions);
    const extSet = extVal.extSet;
    const blacklistPatterns = parseExcludedUrlPatterns(targetConfig.excludedUrls);

    // Check if state exists for this target
    if (state && state.target === currentTarget) {
      // Existing state for this target, preserve settings
      state.settings = { ...targetConfig, ...(state.settings || {}) };
      if (state.settings.maxPages === 200) {
        state.settings.maxPages = 0;
      }

      // If state was incorrectly marked "completed" while links still remained in queue,
      // auto-correct status to "stopped" so the user can easily continue crawling!
      if (state.status === "completed" && Array.isArray(state.queue) && state.queue.length > 0) {
        state.status = "stopped";
      }

      // Purge any out-of-scope, excluded or blacklisted URLs from the existing queue
      if (Array.isArray(state.queue)) {
        state.queue = state.queue.filter(url => isUrlInScope(url, currentTarget) && !isStaticAsset(url, extSet) && !isUrlBlacklisted(url, blacklistPatterns));
      }

      // If crawler is still idle and has not visited pages yet,
      // sync the queue with the full list of in-scope stored links
      if (state.status === "idle" && (!state.visited || state.visited.length === 0)) {
        const fullQueue = buildInitialQueue(currentTarget, storedLinks, extSet, blacklistPatterns);
        state.queue = fullQueue;
        state.totalCount = fullQueue.length;
        state.depthMap = state.depthMap || {};
        fullQueue.forEach(u => {
          if (!state.depthMap[u]) state.depthMap[u] = 1;
        });
      } else {
        // Synchronize any newly discovered links from storage into the queue
        syncStoredLinksIntoQueue(state, storedLinks, extSet, blacklistPatterns, 1);
        const total = (state.visited ? state.visited.length : 0) + (state.queue ? state.queue.length : 0);
        state.totalCount = total;
      }

      updateUI(state);
      await setStorage({ crawler_state: state });
    } else {
      // Create fresh state for this target
      const seedQueue = buildInitialQueue(currentTarget, storedLinks, extSet, blacklistPatterns);

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

  function buildInitialQueue(target, storedLinks, extSet, blacklistPatterns = []) {
    const queue = [];

    // If target itself is a valid URL (not pure wildcard), add as root if not blacklisted
    if (/^https?:\/\//i.test(target) && !target.includes("*")) {
      if (!isStaticAsset(target, extSet) && !isUrlBlacklisted(target, blacklistPatterns)) {
        queue.push(target);
      }
    } else {
      // If wildcard target (e.g. *.example.com or *://example.com/*), try to construct root
      const cleaned = target.replace(/^\*:\/\/|\/\*$/g, "").replace(/^\*\./, "https://");
      if (/^https?:\/\//i.test(cleaned) && !isStaticAsset(cleaned, extSet) && !isUrlBlacklisted(cleaned, blacklistPatterns)) {
        queue.push(cleaned);
      }
    }

    // Add all existing discovered links from storage ONLY if they match target scope and not excluded/blacklisted!
    if (Array.isArray(storedLinks)) {
      for (const link of storedLinks) {
        if (typeof link === "string" && /^https?:\/\//i.test(link)) {
          const clean = link.split("#")[0].trim();
          if (clean && !queue.includes(clean) && !isStaticAsset(clean, extSet) && isUrlInScope(clean, target) && !isUrlBlacklisted(clean, blacklistPatterns)) {
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

    const maxP = parseInt(settings.maxPages, 10);
    const validMaxP = (isNaN(maxP) || maxP < 0) ? 0 : maxP;
    crawlerMaxPagesInput.value = validMaxP;
    crawlerMaxPagesValue.textContent = validMaxP === 0 ? "Unlimited (0)" : String(validMaxP);

    if (crawlerTimeoutInput) {
      crawlerTimeoutInput.value = settings.timeoutSeconds ?? 15;
      if (crawlerTimeoutValue) {
        crawlerTimeoutValue.textContent = `${crawlerTimeoutInput.value}s`;
      }
    }

    // Excluded Extensions
    if (crawlerExcludedExtensionsInput) {
      crawlerExcludedExtensionsInput.value = settings.excludedExtensions ?? DEFAULT_EXCLUDED_EXTS_STR;
      const v = parseAndValidateExtensions(crawlerExcludedExtensionsInput.value);
      if (crawlerExcludedCount) {
        crawlerExcludedCount.textContent = `${v.count} excluded`;
        if (!v.isValid) {
          crawlerExcludedCount.textContent += ` (${v.invalidTokens.length} invalid)`;
          crawlerExcludedCount.style.color = "#dc2626";
          crawlerExcludedExtensionsInput.style.borderColor = "#ef4444";
        } else {
          crawlerExcludedCount.style.color = "#64748b";
          crawlerExcludedExtensionsInput.style.borderColor = "";
        }
      }
    }

    // Excluded URL Patterns (Blacklist)
    if (crawlerExcludedUrlsInput) {
      crawlerExcludedUrlsInput.value = settings.excludedUrls ?? "";
      const rules = parseExcludedUrlPatterns(crawlerExcludedUrlsInput.value);
      if (crawlerExcludedUrlsCount) {
        crawlerExcludedUrlsCount.textContent = `${rules.length} ${rules.length === 1 ? "rule" : "rules"}`;
      }
    }

    // Custom HTTP Request Headers
    renderHeadersUI(settings.customHeaders || []);

    // Tab-driven Navigation settings
    if (crawlerUseTabNavigationCheckbox) {
      crawlerUseTabNavigationCheckbox.checked = Boolean(settings.useTabNavigation);
    }
    if (crawlerPageWaitDelayInput) {
      crawlerPageWaitDelayInput.value = settings.pageWaitDelay ?? 2.0;
      crawlerPageWaitDelayValue.textContent = `${crawlerPageWaitDelayInput.value}s`;
    }
    if (crawlerTabBackgroundCheckbox) {
      crawlerTabBackgroundCheckbox.checked = settings.tabBackground !== false;
    }
    if (crawlerAutoCloseTabCheckbox) {
      crawlerAutoCloseTabCheckbox.checked = settings.autoCloseTab !== false;
    }

    syncTabNavOptionsVisibility();
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
      const modeLabel = state.settings && state.settings.useTabNavigation ? "🌐 [Tab]" : "⚡ [Fetch]";
      currentLinkText.textContent = `${modeLabel} ${state.currentLink}`;
      currentLinkText.title = state.currentLink;
    } else if (state.status === "paused") {
      currentLinkText.textContent = `(Paused) Last URL: ${state.currentLink || "None"}`;
      currentLinkText.title = state.currentLink || "";
    } else if (state.status === "completed") {
      if (remaining > 0) {
        currentLinkText.textContent = `⏸ Crawl halted with ${remaining} links remaining in queue.`;
      } else {
        currentLinkText.textContent = "✅ Crawling completed for all discovered pages in scope!";
      }
      currentLinkText.title = currentLinkText.textContent;
    } else if (state.status === "stopped") {
      const maxPagesLimit = parseInt(state.settings?.maxPages, 10) || 0;
      if (maxPagesLimit > 0 && crawled >= maxPagesLimit && remaining > 0) {
        currentLinkText.textContent = `⏹ Stopped: Reached Max Pages limit (${maxPagesLimit}). ${remaining} links remaining in queue.`;
      } else if (remaining > 0) {
        currentLinkText.textContent = `⏹ Crawling stopped. ${remaining} links remaining in queue.`;
      } else {
        currentLinkText.textContent = "⏹ Crawling stopped by user.";
      }
      currentLinkText.title = currentLinkText.textContent;
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
    const parsedMaxP = parseInt(crawlerMaxPagesInput.value, 10);
    const currentMaxP = (isNaN(parsedMaxP) || parsedMaxP < 0) ? 0 : parsedMaxP;
    crawlerMaxPagesValue.textContent = currentMaxP === 0 ? "Unlimited (0)" : String(currentMaxP);
    if (crawlerTimeoutInput && crawlerTimeoutValue) {
      crawlerTimeoutValue.textContent = `${crawlerTimeoutInput.value}s`;
    }
    if (crawlerPageWaitDelayInput) {
      crawlerPageWaitDelayValue.textContent = `${crawlerPageWaitDelayInput.value}s`;
    }

    // Real-time validation & count for excluded file extensions
    let extValidation = parseAndValidateExtensions(DEFAULT_EXCLUDED_EXTS_STR);
    if (crawlerExcludedExtensionsInput && crawlerExcludedCount) {
      extValidation = parseAndValidateExtensions(crawlerExcludedExtensionsInput.value);
      if (!extValidation.isValid) {
        crawlerExcludedCount.textContent = `${extValidation.count} excluded (${extValidation.invalidTokens.length} invalid)`;
        crawlerExcludedCount.style.color = "#dc2626";
        crawlerExcludedExtensionsInput.style.borderColor = "#ef4444";
      } else {
        crawlerExcludedCount.textContent = `${extValidation.count} excluded`;
        crawlerExcludedCount.style.color = "#64748b";
        crawlerExcludedExtensionsInput.style.borderColor = "";
      }
    }

    // Real-time count for excluded URL patterns (Blacklist)
    let blacklistPatterns = [];
    if (crawlerExcludedUrlsInput) {
      blacklistPatterns = parseExcludedUrlPatterns(crawlerExcludedUrlsInput.value);
      if (crawlerExcludedUrlsCount) {
        crawlerExcludedUrlsCount.textContent = `${blacklistPatterns.length} ${blacklistPatterns.length === 1 ? "rule" : "rules"}`;
      }
    }

    // Real-time count for custom HTTP headers
    const currentCustomHeaders = getCustomHeadersFromUI();
    if (crawlerHeadersCount) {
      crawlerHeadersCount.textContent = `${currentCustomHeaders.length} ${currentCustomHeaders.length === 1 ? "header" : "headers"}`;
    }

    syncTabNavOptionsVisibility();

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const newSettings = {
        delaySeconds: parseFloat(crawlerDelayInput.value) || 1.5,
        maxDepth: parseInt(crawlerMaxDepthInput.value, 10) || 3,
        maxPages: currentMaxP,
        timeoutSeconds: crawlerTimeoutInput ? (parseFloat(crawlerTimeoutInput.value) || 15) : 15,
        stayInScope: true,
        excludedExtensions: crawlerExcludedExtensionsInput ? crawlerExcludedExtensionsInput.value : DEFAULT_EXCLUDED_EXTS_STR,
        excludedUrls: crawlerExcludedUrlsInput ? crawlerExcludedUrlsInput.value : "",
        customHeaders: currentCustomHeaders,
        useTabNavigation: crawlerUseTabNavigationCheckbox ? crawlerUseTabNavigationCheckbox.checked : false,
        pageWaitDelay: crawlerPageWaitDelayInput ? (parseFloat(crawlerPageWaitDelayInput.value) || 2.0) : 2.0,
        tabBackground: crawlerTabBackgroundCheckbox ? crawlerTabBackgroundCheckbox.checked : true,
        autoCloseTab: crawlerAutoCloseTabCheckbox ? crawlerAutoCloseTabCheckbox.checked : true
      };

      const res = await getStorage(["crawler_state", "crawler_configs", "links"]);
      const state = res.crawler_state || {};
      const storedLinks = (res.links && res.links[currentTarget]) || [];
      const extSet = extValidation.extSet;

      // Re-evaluate queue and update statistics
      if (state.target === currentTarget) {
        if (state.status === "idle" && (!state.visited || state.visited.length === 0)) {
          const fullQueue = buildInitialQueue(currentTarget, storedLinks, extSet, blacklistPatterns);
          state.queue = fullQueue;
          state.totalCount = fullQueue.length;
          state.depthMap = state.depthMap || {};
          fullQueue.forEach(u => {
            if (!state.depthMap[u]) state.depthMap[u] = 1;
          });
          state.percentage = 0;
        } else if (Array.isArray(state.queue)) {
          // If crawl was already initiated or paused, purge newly excluded extensions and blacklisted URLs
          state.queue = state.queue.filter(url => !isStaticAsset(url, extSet) && !isUrlBlacklisted(url, blacklistPatterns));
          // Synchronize any newly discovered in-scope links from storage into the existing queue
          syncStoredLinksIntoQueue(state, storedLinks, extSet, blacklistPatterns, 1);
          const total = (state.visited ? state.visited.length : 0) + state.queue.length;
          state.totalCount = total;
          state.percentage = total > 0 ? Math.round(((state.visited ? state.visited.length : 0) / total) * 100) : 0;
        }
      }

      state.settings = newSettings;

      const configs = res.crawler_configs || {};
      configs[currentTarget] = newSettings;

      await setStorage({ crawler_state: state, crawler_configs: configs });
      if (state.target === currentTarget) {
        updateUI(state);
      }

      // Flash "Saved ✓"
      settingsSavedIndicator.classList.add("visible");
      setTimeout(() => {
        settingsSavedIndicator.classList.remove("visible");
      }, 1500);
    }, 250);
  }

  crawlerDelayInput.addEventListener("input", handleSettingChange);
  crawlerMaxDepthInput.addEventListener("input", handleSettingChange);
  crawlerMaxPagesInput.addEventListener("input", handleSettingChange);
  if (crawlerTimeoutInput) {
    crawlerTimeoutInput.addEventListener("input", handleSettingChange);
  }

  if (crawlerExcludedExtensionsInput) {
    crawlerExcludedExtensionsInput.addEventListener("input", handleSettingChange);
  }

  if (crawlerExcludedUrlsInput) {
    crawlerExcludedUrlsInput.addEventListener("input", handleSettingChange);
  }

  if (crawlerUseTabNavigationCheckbox) {
    crawlerUseTabNavigationCheckbox.addEventListener("change", handleSettingChange);
  }
  if (crawlerPageWaitDelayInput) {
    crawlerPageWaitDelayInput.addEventListener("input", handleSettingChange);
  }
  if (crawlerTabBackgroundCheckbox) {
    crawlerTabBackgroundCheckbox.addEventListener("change", handleSettingChange);
  }
  if (crawlerAutoCloseTabCheckbox) {
    crawlerAutoCloseTabCheckbox.addEventListener("change", handleSettingChange);
  }

  if (addHeaderBtn) {
    addHeaderBtn.addEventListener("click", () => {
      const hint = crawlerHeadersList ? crawlerHeadersList.querySelector(".headers-empty-hint") : null;
      if (hint) hint.remove();
      const newRow = createHeaderRowElement("", "");
      if (crawlerHeadersList) {
        crawlerHeadersList.appendChild(newRow);
      }
      const nameInp = newRow.querySelector(".header-name-input");
      if (nameInp) nameInp.focus();
      handleSettingChange();
    });
  }

  // Settings Card Minimize / Maximize (Collapsible / Expandable)
  function setSettingsCardCollapsed(collapsed) {
    if (!crawlerSettingsCard) return;
    if (collapsed) {
      crawlerSettingsCard.classList.add("is-collapsed");
      if (toggleSettingsText) toggleSettingsText.textContent = "Maximize";
      if (toggleSettingsBtn) toggleSettingsBtn.title = "Maximize settings";
      if (toggleSettingsIcon) toggleSettingsIcon.style.transform = "rotate(180deg)";
      try {
        localStorage.setItem("crawler_settings_collapsed", "true");
      } catch (e) {}
    } else {
      crawlerSettingsCard.classList.remove("is-collapsed");
      if (toggleSettingsText) toggleSettingsText.textContent = "Minimize";
      if (toggleSettingsBtn) toggleSettingsBtn.title = "Minimize settings";
      if (toggleSettingsIcon) toggleSettingsIcon.style.transform = "rotate(0deg)";
      try {
        localStorage.setItem("crawler_settings_collapsed", "false");
      } catch (e) {}
    }
  }

  function toggleSettingsCard() {
    if (!crawlerSettingsCard) return;
    const isCurrentlyCollapsed = crawlerSettingsCard.classList.contains("is-collapsed");
    setSettingsCardCollapsed(!isCurrentlyCollapsed);
  }

  // Restore collapsed state on init
  try {
    if (localStorage.getItem("crawler_settings_collapsed") === "true") {
      setSettingsCardCollapsed(true);
    }
  } catch (e) {}

  if (toggleSettingsBtn) {
    toggleSettingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSettingsCard();
    });
  }

  if (crawlerSettingsHeader) {
    crawlerSettingsHeader.addEventListener("click", () => {
      toggleSettingsCard();
    });
  }

  // 6. Tab Navigation Helpers
  async function getOrCreateCrawlerTab(url, inBackground = true, customHeaders = []) {
    // 1. Identify current panel/user tab to protect its focus
    let currentPanelTab = null;
    try {
      currentPanelTab = await chrome.tabs.getCurrent();
      if (!currentPanelTab) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentPanelTab = activeTab || null;
      }
    } catch (e) {}

    // 2. If crawler tab already exists and is alive, reuse it
    if (crawlerTabId !== null) {
      try {
        const existing = await chrome.tabs.get(crawlerTabId);
        if (existing && !existing.discarded) {
          await syncCrawlerTabHeaders(crawlerTabId, customHeaders);
          await chrome.tabs.update(crawlerTabId, { url });

          // Guarantee focus adheres to user setting
          if (inBackground) {
            if (currentPanelTab && currentPanelTab.id && existing.active) {
              try {
                await chrome.tabs.update(currentPanelTab.id, { active: true });
              } catch (err) {}
            }
          } else {
            if (!existing.active) {
              try {
                await chrome.tabs.update(crawlerTabId, { active: true });
              } catch (err) {}
            }
          }
          return crawlerTabId;
        }
      } catch (e) {
        crawlerTabId = null;
      }
    }

    // 3. Create fresh crawler tab
    const hasCustomHeaders = Array.isArray(customHeaders) && customHeaders.some(h => h && h.name && String(h.name).trim());

    if (hasCustomHeaders) {
      // Need tabId first to apply declarativeNetRequest session rules before page navigation
      const tab = await chrome.tabs.create({ url: "about:blank", active: !inBackground });
      crawlerTabId = tab.id;
      await syncCrawlerTabHeaders(crawlerTabId, customHeaders);
      await chrome.tabs.update(crawlerTabId, { url });
    } else {
      // Atomic direct navigation at target URL (avoids two-step about:blank flicker and focus theft)
      const tab = await chrome.tabs.create({ url: url, active: !inBackground });
      crawlerTabId = tab.id;
      await syncCrawlerTabHeaders(crawlerTabId, []);
    }

    // 4. Forcefully guarantee focus preservation if inBackground is requested
    if (inBackground && currentPanelTab && currentPanelTab.id) {
      try {
        const tabCheck = await chrome.tabs.get(crawlerTabId);
        if (tabCheck && tabCheck.active) {
          await chrome.tabs.update(currentPanelTab.id, { active: true });
        }
      } catch (e) {}
    } else if (!inBackground && crawlerTabId) {
      try {
        await chrome.tabs.update(crawlerTabId, { active: true });
      } catch (e) {}
    }

    return crawlerTabId;
  }

  function waitForTabLoad(tabId, timeoutMs = 15000) {
    return new Promise(async (resolve) => {
      let timer = null;
      let resolved = false;

      function cleanup() {
        if (timer) clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
      }

      function listener(updatedTabId, changeInfo) {
        if (!resolved && updatedTabId === tabId && changeInfo.status === "complete") {
          resolved = true;
          cleanup();
          resolve(true);
        }
      }

      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(false);
        }
      }, timeoutMs);

      chrome.tabs.onUpdated.addListener(listener);

      // Check if tab is already completed (instant load or browser cache)
      try {
        const currentTab = await chrome.tabs.get(tabId);
        if (!resolved && currentTab && currentTab.status === "complete") {
          resolved = true;
          cleanup();
          resolve(true);
        }
      } catch (e) {}
    });
  }

  function requestTabLinks(tabId, timeoutMs = 8000) {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve([]);
        }
      }, timeoutMs);

      chrome.tabs.sendMessage(tabId, { type: "extractTabLinks" }, (response) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError || !response || !Array.isArray(response.links)) {
          resolve([]);
        } else {
          resolve(response.links);
        }
      });
    });
  }

  async function closeCrawlerTabIfNeeded() {
    if (crawlerTabId !== null) {
      try {
        await chrome.tabs.remove(crawlerTabId);
      } catch (e) {}
      crawlerTabId = null;
    }
    if (chrome.declarativeNetRequest?.updateSessionRules) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [CRAWLER_SESSION_RULE_ID]
        });
      } catch (e) {}
    }
  }

  // 7. Crawler Loop & Controls
  startCrawlerBtn.addEventListener("click", async () => {
    const res = await getStorage(["crawler_state", "links"]);
    let state = res.crawler_state || {};
    const storedLinks = (res.links && res.links[currentTarget]) || [];
    const currentExcluded = (state.settings && state.settings.excludedExtensions) || DEFAULT_EXCLUDED_EXTS_STR;
    const extVal = parseAndValidateExtensions(currentExcluded);
    const blacklistPatterns = parseExcludedUrlPatterns(state.settings?.excludedUrls);

    // If queue is empty, re-seed
    if (!state.queue || state.queue.length === 0) {
      state.queue = buildInitialQueue(currentTarget, storedLinks, extVal.extSet, blacklistPatterns);
      state.depthMap = state.depthMap || {};
      state.queue.forEach((u) => {
        if (!state.depthMap[u]) state.depthMap[u] = 1;
      });
    } else {
      // Synchronize any newly discovered in-scope links from storage into the existing queue
      syncStoredLinksIntoQueue(state, storedLinks, extVal.extSet, blacklistPatterns, 1);
    }

    state.status = "running";
    await setStorage({ crawler_state: state });
    updateUI(state);
    runCrawlLoop();
  });

  resumeCrawlerBtn.addEventListener("click", async () => {
    const res = await getStorage(["crawler_state", "links"]);
    const state = res.crawler_state || {};
    const storedLinks = (res.links && res.links[currentTarget]) || [];
    const currentExcluded = (state.settings && state.settings.excludedExtensions) || DEFAULT_EXCLUDED_EXTS_STR;
    const extVal = parseAndValidateExtensions(currentExcluded);
    const blacklistPatterns = parseExcludedUrlPatterns(state.settings?.excludedUrls);
    syncStoredLinksIntoQueue(state, storedLinks, extVal.extSet, blacklistPatterns, 1);

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
    await closeCrawlerTabIfNeeded();
    updateUI(state);
  });

  resetCrawlerBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to reset the crawl queue and visited set back to the target root?")) {
      return;
    }
    await closeCrawlerTabIfNeeded();
    const res = await getStorage(["crawler_state", "links", "crawler_configs"]);
    const storedLinks = (res.links && res.links[currentTarget]) || [];
    const settings = (res.crawler_state && res.crawler_state.settings) || (res.crawler_configs && res.crawler_configs[currentTarget]) || {
      delaySeconds: 1.5,
      maxDepth: 3,
      maxPages: 0,
      timeoutSeconds: 15,
      stayInScope: true,
      excludedExtensions: DEFAULT_EXCLUDED_EXTS_STR,
      excludedUrls: "",
      customHeaders: [],
      useTabNavigation: false,
      pageWaitDelay: 2.0,
      tabBackground: true,
      autoCloseTab: true
    };
    const extVal = parseAndValidateExtensions(settings.excludedExtensions);
    const blacklistPatterns = parseExcludedUrlPatterns(settings.excludedUrls);
    const seedQueue = buildInitialQueue(currentTarget, storedLinks, extVal.extSet, blacklistPatterns);
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
      settings: settings,
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

  // 8. Core Crawl Loop (Supports both Tab-driven & Fetch navigation)
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
          maxPages: 0,
          timeoutSeconds: 15,
          stayInScope: true,
          excludedExtensions: DEFAULT_EXCLUDED_EXTS_STR,
          excludedUrls: "",
          customHeaders: [],
          useTabNavigation: false,
          pageWaitDelay: 2.0,
          tabBackground: true,
          autoCloseTab: true
        };
        const extVal = parseAndValidateExtensions(settings.excludedExtensions);
        const currentExtSet = extVal.extSet;
        const blacklistPatterns = parseExcludedUrlPatterns(settings.excludedUrls);
        const timeoutSec = Math.max(2, parseFloat(settings.timeoutSeconds) || 15);
        const timeoutMs = timeoutSec * 1000;
        const maxPagesLimit = parseInt(settings.maxPages, 10) || 0;

        // Synchronize newly discovered in-scope links from storage into the active queue
        const currentStorageLinks = (res.links && res.links[currentTarget]) || [];
        syncStoredLinksIntoQueue(state, currentStorageLinks, currentExtSet, blacklistPatterns, 1);

        // Check completion limits:
        // 1. Genuine queue completion: all URLs in scope have been visited
        if (!state.queue || state.queue.length === 0) {
          state.status = "completed";
          state.currentLink = "";
          state.percentage = 100;
          addLogEntry(state, true, currentTarget, "Finished! All discovered URLs crawled.", 0);
          await setStorage({ crawler_state: state });
          if (settings.autoCloseTab) {
            await closeCrawlerTabIfNeeded();
          }
          updateUI(state);
          break;
        }

        // 2. Max Total Pages limit reached (only when user explicitly specified a limit > 0)
        if (maxPagesLimit > 0 && state.visited.length >= maxPagesLimit) {
          state.status = "stopped";
          state.currentLink = "";
          const remaining = state.queue.length;
          addLogEntry(state, false, currentTarget, `Stopped: Reached Max Pages limit (${maxPagesLimit}). ${remaining} links remaining in queue.`, 0);
          await setStorage({ crawler_state: state });
          if (settings.autoCloseTab) {
            await closeCrawlerTabIfNeeded();
          }
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

        // Scope check: Always strictly stay inside target domain / pattern
        if (!isUrlInScope(nextUrl, currentTarget)) {
          state.visited.push(nextUrl);
          await setStorage({ crawler_state: state });
          continue;
        }

        // Static asset check: Skip any URLs matching excluded file extensions
        if (isStaticAsset(nextUrl, currentExtSet)) {
          state.visited.push(nextUrl);
          await setStorage({ crawler_state: state });
          continue;
        }

        // Blacklist check: Skip any URLs matching excluded URL patterns
        if (isUrlBlacklisted(nextUrl, blacklistPatterns)) {
          state.visited.push(nextUrl);
          await setStorage({ crawler_state: state });
          continue;
        }

        // Mark current link
        state.currentLink = nextUrl;
        const currentDepth = (state.depthMap && state.depthMap[nextUrl]) || 1;
        updateUI(state);
        await setStorage({ crawler_state: state });

        // Crawl the URL based on selected mode
        let extractedCount = 0;
        let isSuccess = false;
        let logNote = "";
        let discoveredInThisStep = [];

        if (settings.useTabNavigation) {
          // ============================================
          // METHOD 1: Tab-driven Browser Navigation
          // ============================================
          try {
            const inBackground = settings.tabBackground !== false;
            const tid = await getOrCreateCrawlerTab(nextUrl, inBackground, settings.customHeaders);

            // Wait for tab page to load within user-configured timeout
            const loaded = await waitForTabLoad(tid, timeoutMs);
            if (!loaded) {
              logNote = `Tab Timeout (${timeoutSec}s)`;
            }

            // Wait post-load delay for SPA hydration (React/Vue), AJAX and DOM changes
            const postLoadWaitMs = Math.max(500, (settings.pageWaitDelay || 2.0) * 1000);
            await sleep(postLoadWaitMs);

            // Request extracted links from tab's content script (with safety timeout)
            let tabLinks = await requestTabLinks(tid, Math.min(10000, timeoutMs));

            // Fallback to fetch if tab messaging returned no links
            if (!tabLinks || tabLinks.length === 0) {
              try {
                const fbCtrl = new AbortController();
                const fbTimer = setTimeout(() => fbCtrl.abort(), timeoutMs);
                const customHeadersObj = buildHeadersObject(settings.customHeaders);
                const fbResp = await fetch(nextUrl, {
                  signal: fbCtrl.signal,
                  headers: {
                    "Accept": "text/html,application/xhtml+xml",
                    ...customHeadersObj
                  }
                });
                if (fbResp.ok) {
                  const fbText = await fbResp.text();
                  clearTimeout(fbTimer);
                  const fbDoc = new DOMParser().parseFromString(fbText, "text/html");
                  tabLinks = extractLinksFromDocument(fbDoc, fbResp.url || nextUrl);
                } else {
                  clearTimeout(fbTimer);
                }
              } catch (e) {}
            }

            // Filter ONLY the links extracted from THIS page using target extraction rules
            const targetRules = (res.extraction_rules && res.extraction_rules[currentTarget]) || { include: [], exclude: [] };
            const filteredLinks = filterLinksWithRules(tabLinks || [], targetRules);

            isSuccess = loaded || filteredLinks.length > 0;
            extractedCount = filteredLinks.length;
            discoveredInThisStep = filteredLinks;
            if (!logNote) {
              logNote = `+${extractedCount} links`;
            } else if (extractedCount > 0) {
              logNote += ` (+${extractedCount} links)`;
            }

            // Persist newly discovered links into target's main link storage
            const freshLinksRes = await getStorage(["links"]);
            const storageLinks = (freshLinksRes.links && freshLinksRes.links[currentTarget]) || [];
            const mergedStored = [...new Set([...storageLinks, ...filteredLinks])];
            if (mergedStored.length !== storageLinks.length) {
              const linksObj = freshLinksRes.links || {};
              linksObj[currentTarget] = mergedStored;
              await setStorage({ links: linksObj });
            }

            // Immediately sync any newly discovered links from storage into the active queue
            syncStoredLinksIntoQueue(state, mergedStored, currentExtSet, blacklistPatterns, currentDepth + 1);
          } catch (err) {
            logNote = `Tab Error: ${err.message || "Failed"}`;
          }
        } else {
          // ============================================
          // METHOD 2: Fast Background Fetch Navigation
          // ============================================
          const abortCtrl = new AbortController();
          const abortTimer = setTimeout(() => abortCtrl.abort(), timeoutMs);
          const customHeadersObj = buildHeadersObject(settings.customHeaders);

          try {
            const fetchResp = await fetch(nextUrl, {
              signal: abortCtrl.signal,
              headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                ...customHeadersObj
              }
            });

            if (fetchResp.ok) {
              const htmlText = await fetchResp.text();
              clearTimeout(abortTimer);
              const doc = new DOMParser().parseFromString(htmlText, "text/html");
              const baseUri = fetchResp.url || nextUrl;

              // Extract all links
              const rawLinks = extractLinksFromDocument(doc, baseUri);

              // Filter with target extraction rules (Include / Exclude regexes)
              const targetRules = (res.extraction_rules && res.extraction_rules[currentTarget]) || { include: [], exclude: [] };
              const filteredLinks = filterLinksWithRules(rawLinks, targetRules);

              isSuccess = true;
              extractedCount = filteredLinks.length;
              discoveredInThisStep = filteredLinks;
              logNote = `+${extractedCount} links`;

              // Persist newly discovered links into target's main link storage
              const currentStored = (res.links && res.links[currentTarget]) || [];
              const mergedStored = [...new Set([...currentStored, ...filteredLinks])];
              if (mergedStored.length !== currentStored.length) {
                const linksObj = res.links || {};
                linksObj[currentTarget] = mergedStored;
                await setStorage({ links: linksObj });
              }

              // Immediately sync any newly discovered links into the active queue
              syncStoredLinksIntoQueue(state, mergedStored, currentExtSet, blacklistPatterns, currentDepth + 1);
            } else {
              clearTimeout(abortTimer);
              logNote = `HTTP ${fetchResp.status} ${fetchResp.statusText || ""}`;
            }
          } catch (err) {
            clearTimeout(abortTimer);
            if (err.name === "AbortError") {
              logNote = `Timeout (${timeoutSec}s)`;
            } else {
              logNote = `Fetch Error: ${err.message || "Network error"}`;
            }
          }
        }

        // Enqueue subsequent links if depth limit allows
        const maxDepthLimit = parseInt(settings.maxDepth, 10) || 3;
        if (isSuccess && currentDepth < maxDepthLimit) {
          const visitedSet = new Set(state.visited || []);
          const queueSet = new Set(state.queue || []);
          for (const candidate of discoveredInThisStep) {
            // Scope validation: strictly stay within target domain / pattern
            if (!isUrlInScope(candidate, currentTarget)) {
              continue;
            }

            // Blacklist URL patterns validation
            if (isUrlBlacklisted(candidate, blacklistPatterns)) {
              continue;
            }

            // Filter out non-crawlable static asset files based on user-configured extensions
            if (isStaticAsset(candidate, currentExtSet)) {
              continue;
            }

            // Canonicalize candidate (strip fragment #)
            const cleanCandidate = candidate.split("#")[0].trim();
            if (!cleanCandidate) continue;

            if (!visitedSet.has(cleanCandidate) && !queueSet.has(cleanCandidate)) {
              state.queue.push(cleanCandidate);
              queueSet.add(cleanCandidate);
              state.depthMap = state.depthMap || {};
              state.depthMap[cleanCandidate] = currentDepth + 1;
            }
          }
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
      const finalRes = await getStorage(["crawler_state"]);
      const finalSettings = (finalRes.crawler_state && finalRes.crawler_state.settings) || {};
      if (finalSettings.autoCloseTab && (finalRes.crawler_state?.status === "completed" || finalRes.crawler_state?.status === "stopped")) {
        await closeCrawlerTabIfNeeded();
      }
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
    if (!url || !pattern) return false;
    if (typeof findMatchingPatterns === "function") {
      try {
        const matched = findMatchingPatterns([pattern], url);
        return Array.isArray(matched) && matched.length > 0;
      } catch (e) {}
    }
    try {
      if (typeof patternToRegex === "function") {
        const targetRegex = patternToRegex(pattern);
        if (targetRegex) return targetRegex.test(url);
      }
    } catch (e) {}

    // Strict domain check fallback (never loose substring)
    try {
      const u = new URL(url);
      const cleanPattern = pattern.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
      if (cleanPattern.startsWith("*.")) {
        const baseDomain = cleanPattern.slice(2);
        return u.hostname === baseDomain || u.hostname.endsWith("." + baseDomain);
      }
      return u.hostname === cleanPattern;
    } catch (e) {
      return false;
    }
  }

  // Helper: Blacklist / Excluded URL Pattern Matching
  function isUrlBlacklisted(url, patterns) {
    if (!url || !Array.isArray(patterns) || patterns.length === 0) return false;
    for (const raw of patterns) {
      if (!raw || typeof raw !== "string") continue;
      const p = raw.trim();
      if (!p) continue;

      // 1. Exact match
      if (url === p) return true;

      // 2. Pattern Matcher (wildcard support)
      try {
        if (typeof matchPattern === "function" && matchPattern(p, url)) {
          return true;
        }
      } catch (e) {}

      // 3. Path-only pattern (e.g. "/admin/*" or "/logout")
      if (p.startsWith("/")) {
        try {
          if (typeof matchPattern === "function" && matchPattern("*://*" + p, url)) {
            return true;
          }
        } catch (e) {}
        try {
          const u = new URL(url);
          const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
          const pathRegex = new RegExp("^" + escaped + "$", "i");
          if (pathRegex.test(u.pathname)) return true;
        } catch (e) {}
      }

      // 4. Loose wildcard fallback
      try {
        const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        const wildcardRegex = new RegExp("^" + escaped + "$", "i");
        if (wildcardRegex.test(url)) return true;
      } catch (e) {}
    }
    return false;
  }

  // Helper: Detect Non-HTML Media Assets based on dynamic extSet
  function isStaticAsset(url, extSet) {
    if (!url) return false;
    const set = (extSet instanceof Set) ? extSet : parseAndValidateExtensions(DEFAULT_EXCLUDED_EXTS_STR).extSet;
    if (set.size === 0) return false;

    try {
      const pathname = new URL(url).pathname.toLowerCase();
      const dotIdx = pathname.lastIndexOf(".");
      if (dotIdx !== -1) {
        const ext = pathname.slice(dotIdx);
        if (set.has(ext)) return true;
      }
    } catch (e) {}
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

  // 9. Storage Changed Listener (Sync across tabs)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.crawler_state) {
      const newState = changes.crawler_state.newValue;
      if (newState && newState.target === currentTarget) {
        updateUI(newState);
      }
    }
  });

  // 10. Initial Load
  initCrawlerState();
})();
