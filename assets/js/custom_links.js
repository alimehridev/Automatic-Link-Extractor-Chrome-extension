/**
 * Custom / Manual Links Importer for Automatic Link Extractor
 * Allows users to manually add links to the current target origin.
 */

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("openAddLinksModalBtn");
    const modal = document.getElementById("addLinksModal");
    const closeBtn = document.getElementById("closeAddLinksModalBtn");
    const textarea = document.getElementById("customLinksInput");
    const saveBtn = document.getElementById("saveCustomLinksBtn");
    const targetLabel = document.getElementById("addLinksTargetLabel");
    const countLabel = document.getElementById("customLinksCount");

    if (!openBtn || !modal) return;

    function parseLinks() {
      if (!textarea) return [];
      return textarea.value
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }

    function updateCount() {
      if (!countLabel) return;
      const links = parseLinks();
      countLabel.innerText = `${links.length} link${links.length === 1 ? "" : "s"}`;
    }

    openBtn.addEventListener("click", () => {
      const origin = getQueryParam("origin") || "";
      if (targetLabel) targetLabel.innerText = origin || "-";
      if (textarea) {
        textarea.value = "";
        updateCount();
      }
      modal.style.display = "block";
      if (textarea) textarea.focus();
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

    if (textarea) {
      textarea.addEventListener("input", updateCount);
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const origin = getQueryParam("origin");
        if (!origin) return;

        const newLinks = parseLinks();
        if (newLinks.length === 0) {
          alert("Please enter at least one link.");
          return;
        }

        saveBtn.disabled = true;
        const originalText = saveBtn.innerText;
        saveBtn.innerText = "Adding...";

        chrome.storage.local.get("links", (result) => {
          const linksObj = result["links"] || {};
          const existing = linksObj[origin] || [];
          const merged = [...new Set(existing.concat(newLinks))];
          linksObj[origin] = merged;

          chrome.storage.local.set({ links: linksObj }, () => {
            modal.style.display = "none";
            saveBtn.disabled = false;
            saveBtn.innerText = originalText;
            location.reload();
          });
        });
      });
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getQueryParam
  };
}

