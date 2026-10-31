/**
 * Subdomain & Origin Extractor for Automatic Link Extractor
 * By default extracts all unique origins/domains across all stored links.
 * When "Only TLD+1 subdomains" is checked, filters strictly to subdomains of the target's root domain.
 * Supports in-memory Include and Exclude regex filters with the same UI and style as the JS crawler.
 */

const MULTI_PART_TLDS = new Set([
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "sch.uk", "ac.uk", "gov.uk",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "ed.jp", "go.jp",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "asn.au", "id.au",
  "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz", "school.nz",
  "com.br", "net.br", "org.br", "gov.br", "edu.br",
  "com.tr", "net.tr", "org.tr", "gov.tr", "edu.tr", "bel.tr",
  "co.il", "org.il", "net.il", "ac.il", "gov.il", "muni.il",
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in", "nic.in", "ac.in", "edu.in", "res.in", "gov.in", "mil.in",
  "co.za", "net.za", "org.za", "gov.za", "ac.za", "edu.za",
  "ac.ir", "co.ir", "gov.ir", "id.ir", "net.ir", "org.ir", "sch.ir",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn",
  "com.sg", "net.sg", "org.sg", "gov.sg", "edu.sg", "per.sg",
  "com.my", "net.my", "org.my", "gov.my", "edu.my",
  "com.mx", "net.mx", "org.mx", "gob.mx", "edu.mx",
  "com.ar", "net.ar", "org.ar", "gov.ar", "edu.ar",
  "com.tw", "net.tw", "org.tw", "gov.tw", "edu.tw",
  "com.hk", "net.hk", "org.hk", "gov.hk", "edu.hk",
  "com.ru", "net.ru", "org.ru", "pp.ru"
]);

function extractHostnameFromPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') return '';
  let str = pattern.trim();
  if (str.includes('://')) {
    str = str.split('://')[1];
  }
  const slashIdx = str.indexOf('/');
  if (slashIdx !== -1) {
    str = str.slice(0, slashIdx);
  }
  const colonIdx = str.indexOf(':');
  if (colonIdx !== -1) {
    str = str.slice(0, colonIdx);
  }
  if (str.startsWith('*.')) {
    str = str.slice(2);
  } else if (str.startsWith('*')) {
    str = str.slice(1);
  }
  return str.toLowerCase();
}

function getRootDomain(hostname) {
  if (!hostname) return '';
  const cleanHost = hostname.toLowerCase().trim();
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHost)) {
    return cleanHost;
  }
  const parts = cleanHost.split('.');
  if (parts.length <= 2) {
    return cleanHost;
  }
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function extractOriginsOrSubdomains(links, rootDomain, options = {}) {
  const { onlyTld = false, includeProtocol = false, includes = [], excludes = [] } = options;
  if (!Array.isArray(links)) return [];
  const root = (rootDomain || '').toLowerCase();
  const results = new Set();

  for (const link of links) {
    if (!link || typeof link !== 'string') continue;
    let urlObj = null;
    try {
      urlObj = new URL(link);
    } catch (e) {
      const match = link.match(/^(?:([a-z]+:)?\/\/)?([^\/\s:]+)(?::(\d+))?/i);
      if (match) {
        const protocol = match[1] || 'https:';
        const hostname = match[2];
        const port = match[3] ? `:${match[3]}` : '';
        try {
          urlObj = new URL(`${protocol}//${hostname}${port}`);
        } catch (err) {}
      }
    }
    if (!urlObj || !urlObj.hostname) continue;

    const hostname = urlObj.hostname.toLowerCase();

    if (onlyTld) {
      if (!root) continue;
      const isSub = hostname === root || hostname.endsWith('.' + root);
      if (!isSub) continue;
    }

    const value = includeProtocol ? urlObj.origin : hostname;
    results.add(value);
  }

  let items = Array.from(results);

  if (Array.isArray(includes) && includes.length > 0) {
    items = items.filter(item =>
      includes.some(pattern => {
        try {
          return new RegExp(pattern, 'i').test(item);
        } catch (e) {
          return false;
        }
      })
    );
  }

  if (Array.isArray(excludes) && excludes.length > 0) {
    items = items.filter(item =>
      !excludes.some(pattern => {
        try {
          return new RegExp(pattern, 'i').test(item);
        } catch (e) {
          return false;
        }
      })
    );
  }

  return items.sort();
}

// UI Setup and Event Handlers
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
  const extractBtn = document.getElementById("extract_subdomains");
  const modal = document.getElementById("subdomainModal");
  const closeBtn = document.getElementById("closeSubdomainModalBtn");
  const outputTextarea = document.getElementById("subdomainOutput");
  const rootDomainLabel = document.getElementById("subdomainRootDomain");
  const rootDomainOptionLabel = document.getElementById("subdomainRootDomainLabel");
  const countLabel = document.getElementById("subdomainCount");
  const copyBtn = document.getElementById("copySubdomainsBtn");
  const copyMainBtn = document.getElementById("copySubdomainsMainBtn");
  const refetchBtn = document.getElementById("refetchSubdomainsBtn");
  const onlyTldCheckbox = document.getElementById("only-tld-subdomains");
  const includeProtocolCheckbox = document.getElementById("include-protocol");

  const includeAddBtn = document.querySelector(".add-subdomain-regex-include");
  const excludeAddBtn = document.querySelector(".add-subdomain-regex-exclude");
  const includeContainer = document.querySelector(".regex-subdomain-include .custom-regexes");
  const excludeContainer = document.querySelector(".regex-subdomain-exclude .custom-regexes");

  if (!extractBtn || !modal) return;

  let cachedLinks = [];
  let currentRootDomain = "";

  function getRegexList(container) {
    if (!container) return [];
    return [...container.querySelectorAll(".custom-regex")]
      .map(el => {
        const valEl = el.querySelector(".regex-value");
        return valEl ? valEl.innerText.trim() : "";
      })
      .filter(val => val && val !== "YOUR_REGEX");
  }

  function addRegexPill(container) {
    if (!container) return;
    try {
      const existing = container.querySelectorAll(".custom-regex");
      if (existing.length > 0) {
        const lastVal = existing[existing.length - 1].querySelector(".regex-value").innerText;
        if (lastVal === "YOUR_REGEX") return;
      }
    } catch (e) {}

    const customRegex = document.createElement("div");
    customRegex.classList.add("custom-regex");
    customRegex.appendChild(document.createTextNode(" / "));

    const regexValueSpan = document.createElement("span");
    regexValueSpan.setAttribute("contenteditable", "true");
    regexValueSpan.classList.add("regex-value");
    regexValueSpan.innerHTML = "YOUR_REGEX";
    customRegex.appendChild(regexValueSpan);

    regexValueSpan.addEventListener("keyup", () => {
      renderOutput();
    });

    customRegex.appendChild(document.createTextNode(" /g "));

    const removeRegexSpan = document.createElement("span");
    removeRegexSpan.innerHTML = "-";
    removeRegexSpan.classList.add("regex-remove-btn");
    customRegex.appendChild(removeRegexSpan);

    removeRegexSpan.addEventListener("click", () => {
      customRegex.remove();
      renderOutput();
    });

    container.appendChild(customRegex);
    renderOutput();
  }

  if (includeAddBtn && includeContainer) {
    includeAddBtn.addEventListener("click", () => {
      addRegexPill(includeContainer);
    });
  }

  if (excludeAddBtn && excludeContainer) {
    excludeAddBtn.addEventListener("click", () => {
      addRegexPill(excludeContainer);
    });
  }

  function renderOutput() {
    const onlyTld = onlyTldCheckbox ? onlyTldCheckbox.checked : false;
    const includeProtocol = includeProtocolCheckbox ? includeProtocolCheckbox.checked : false;
    const includes = getRegexList(includeContainer);
    const excludes = getRegexList(excludeContainer);

    const items = extractOriginsOrSubdomains(cachedLinks, currentRootDomain, {
      onlyTld,
      includeProtocol,
      includes,
      excludes
    });

    outputTextarea.value = items.join("\n");
    const itemType = onlyTld ? "subdomains" : "origins";
    countLabel.innerText = `${items.length} ${itemType}`;
  }

  function fetchAndRender(callback) {
    const originParam = getQueryParam("origin");
    if (!originParam) return;

    const hostname = extractHostnameFromPattern(originParam);
    currentRootDomain = getRootDomain(hostname);

    if (rootDomainLabel) rootDomainLabel.innerText = currentRootDomain || hostname || originParam;
    if (rootDomainOptionLabel) rootDomainOptionLabel.innerText = currentRootDomain || hostname || "domain";

    chrome.storage.local.get("links", (result) => {
      cachedLinks = (result["links"] && result["links"][originParam]) || [];
      renderOutput();
      if (typeof callback === "function") callback();
    });
  }

  extractBtn.addEventListener("click", () => {
    fetchAndRender(() => {
      modal.style.display = "block";
    });
  });

  if (refetchBtn) {
    refetchBtn.addEventListener("click", () => {
      const originalText = refetchBtn.innerText;
      refetchBtn.innerText = "⟳ Fetching...";
      refetchBtn.disabled = true;

      fetchAndRender(() => {
        refetchBtn.innerText = "✓ Refetched!";
        setTimeout(() => {
          refetchBtn.innerText = originalText;
          refetchBtn.disabled = false;
        }, 600);
      });
    });
  }

  if (onlyTldCheckbox) {
    onlyTldCheckbox.addEventListener("change", () => {
      renderOutput();
    });
  }

  if (includeProtocolCheckbox) {
    includeProtocolCheckbox.addEventListener("change", () => {
      renderOutput();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  function performCopy(buttonElement, originalText, successText) {
    const text = outputTextarea.value;
    if (typeof copyToClipboard === "function") {
      copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    buttonElement.innerText = successText;
    setTimeout(() => {
      buttonElement.innerText = originalText;
    }, 1000);
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      performCopy(copyBtn, "copy", "copied");
    });
  }

  if (copyMainBtn) {
    copyMainBtn.addEventListener("click", () => {
      performCopy(copyMainBtn, "Copy to clipboard", "Copied!");
    });
  }
});
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MULTI_PART_TLDS,
    extractHostnameFromPattern,
    getRootDomain,
    extractOriginsOrSubdomains
  };
}
