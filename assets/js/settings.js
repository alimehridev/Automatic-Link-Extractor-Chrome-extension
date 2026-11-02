/**
 * Extraction Settings Modal Controller for Automatic Link Extractor
 * Manages target-specific Include and Exclude regex rules stored in chrome.storage.local.extraction_rules.
 */

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function save_extraction_rules_to_storage() {
  const origin = getQueryParam("origin");
  if (!origin) return;

  const includeContainer = document.querySelector(".regex-extraction-include .custom-regexes");
  const excludeContainer = document.querySelector(".regex-extraction-exclude .custom-regexes");

  const include_rules = includeContainer
    ? [...includeContainer.querySelectorAll(".custom-regex")]
        .map(el => el.querySelector(".regex-value") ? el.querySelector(".regex-value").innerText.trim() : "")
        .filter(val => val && val !== "YOUR_REGEX")
    : [];

  const exclude_rules = excludeContainer
    ? [...excludeContainer.querySelectorAll(".custom-regex")]
        .map(el => el.querySelector(".regex-value") ? el.querySelector(".regex-value").innerText.trim() : "")
        .filter(val => val && val !== "YOUR_REGEX")
    : [];

  chrome.storage.local.get("extraction_rules", (result) => {
    const rulesObj = result["extraction_rules"] || {};
    rulesObj[origin] = {
      includes: [...include_rules, "YOUR_REGEX"],
      excludes: [...exclude_rules, "YOUR_REGEX"]
    };

    chrome.storage.local.set({ extraction_rules: rulesObj });
  });
}

function createExtractionRegexPill(container, value = "YOUR_REGEX") {
  if (!container) return;

  const customRegex = document.createElement("div");
  customRegex.classList.add("custom-regex");
  customRegex.appendChild(document.createTextNode(" / "));

  const regexValueSpan = document.createElement("span");
  regexValueSpan.setAttribute("contenteditable", "true");
  regexValueSpan.classList.add("regex-value");
  regexValueSpan.innerText = value;
  customRegex.appendChild(regexValueSpan);

  regexValueSpan.addEventListener("keyup", () => {
    save_extraction_rules_to_storage();
  });

  customRegex.appendChild(document.createTextNode(" /g "));

  const removeRegexSpan = document.createElement("span");
  removeRegexSpan.innerText = "-";
  removeRegexSpan.classList.add("regex-remove-btn");
  customRegex.appendChild(removeRegexSpan);

  removeRegexSpan.addEventListener("click", () => {
    customRegex.remove();
    save_extraction_rules_to_storage();
  });

  container.appendChild(customRegex);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("open_settings");
    const modal = document.getElementById("settingsModal");
    const closeBtn = document.getElementById("closeSettingsModalBtn");
    const targetLabel = document.getElementById("settingsTargetLabel");

    const addIncludeBtn = document.querySelector(".add-extraction-regex-include");
    const addExcludeBtn = document.querySelector(".add-extraction-regex-exclude");
    const includeContainer = document.querySelector(".regex-extraction-include .custom-regexes");
    const excludeContainer = document.querySelector(".regex-extraction-exclude .custom-regexes");

    if (!openBtn || !modal) return;

    function handleAddClick(container) {
      if (!container) return;
      try {
        const existing = container.querySelectorAll(".custom-regex");
        if (existing.length > 0) {
          const lastVal = existing[existing.length - 1].querySelector(".regex-value").innerText.trim();
          if (lastVal === "YOUR_REGEX") return;
        }
      } catch (e) {}

      createExtractionRegexPill(container, "YOUR_REGEX");
      save_extraction_rules_to_storage();
    }

    if (addIncludeBtn && includeContainer) {
      addIncludeBtn.addEventListener("click", () => handleAddClick(includeContainer));
    }

    if (addExcludeBtn && excludeContainer) {
      addExcludeBtn.addEventListener("click", () => handleAddClick(excludeContainer));
    }

    openBtn.addEventListener("click", () => {
      const origin = getQueryParam("origin");
      if (!origin) return;

      if (targetLabel) targetLabel.innerText = origin;

      if (includeContainer) includeContainer.innerHTML = "";
      if (excludeContainer) excludeContainer.innerHTML = "";

      chrome.storage.local.get("extraction_rules", (result) => {
        const allRules = result["extraction_rules"] || {};
        const targetRules = allRules[origin] || { includes: ["YOUR_REGEX"], excludes: ["YOUR_REGEX"] };

        const incList = Array.isArray(targetRules.includes) && targetRules.includes.length > 0
          ? targetRules.includes
          : ["YOUR_REGEX"];

        const excList = Array.isArray(targetRules.excludes) && targetRules.excludes.length > 0
          ? targetRules.excludes
          : ["YOUR_REGEX"];

        if (includeContainer) {
          incList.forEach(re => createExtractionRegexPill(includeContainer, re));
        }

        if (excludeContainer) {
          excList.forEach(re => createExtractionRegexPill(excludeContainer, re));
        }

        modal.style.display = "block";
      });
    });

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

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "block") {
        modal.style.display = "none";
      }
    });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getQueryParam,
    save_extraction_rules_to_storage
  };
}

