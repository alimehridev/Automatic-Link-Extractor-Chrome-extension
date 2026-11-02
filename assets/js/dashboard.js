function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function remove_link_from_origin(origin, linkToRemove) {
  chrome.storage.local.get("links", (result) => {
    const linksObj = result["links"] || {};
    const list = linksObj[origin] || [];
    linksObj[origin] = list.filter(l => l !== linkToRemove);
    chrome.storage.local.set({ links: linksObj }, () => {
      location.reload();
    });
  });
}

async function loadOriginData(origin) {
  document.getElementById("origin").textContent = `🔗 Target: ${origin}`;

  // Loading Sensitivities
  chrome.storage.local.get("sensitivities", (result) => {
    const allSensitivities = result["sensitivities"] || {};
    const sensitivities = allSensitivities[origin] || {
      childList: 1,
      subtree: 1,
      attributes: 1,
      attributeOldValue: 1,
      characterData: 1,
      characterDataOldValue: 1
    };
    document.getElementById("childList").checked = Boolean(sensitivities.childList);
    document.getElementById("subtree").checked = Boolean(sensitivities.subtree);
    document.getElementById("attributes").checked = Boolean(sensitivities.attributes);
    document.getElementById("attributeOldValue").checked = Boolean(sensitivities.attributeOldValue);
    document.getElementById("characterData").checked = Boolean(sensitivities.characterData);
    document.getElementById("characterDataOldValue").checked = Boolean(sensitivities.characterDataOldValue);
    if (
        document.getElementById("childList").checked
        && document.getElementById("subtree").checked
        && document.getElementById("attributes").checked
        && document.getElementById("attributeOldValue").checked
        && document.getElementById("characterData").checked
        && document.getElementById("characterDataOldValue").checked
    ) {
        document.getElementById("all").checked = true;
    } else {
        document.getElementById("all").checked = false;
    }
  });

  // Loading data
  const linksDiv = document.getElementById("links");
  const searchInput = document.getElementById("searchLinksInput");
  const initialQuery = getQueryParam("q") || "";
  if (searchInput && initialQuery) {
    searchInput.value = initialQuery;
  }

  chrome.storage.local.get("links", (result) => {
    const allLinks = (result["links"] && result["links"][origin]) || [];
    const per_page = 5;

    function renderLinks(targetPage = 1, searchQuery = "") {
      const query = (searchQuery || "").trim().toLowerCase();
      const filtered = query
        ? allLinks.filter(link => link.toLowerCase().includes(query))
        : allLinks;

      const len = filtered.length;
      const page_count = Math.ceil(len / per_page);

      let current_page = parseInt(targetPage, 10);
      if (isNaN(current_page) || current_page < 1) current_page = 1;
      if (page_count > 0 && current_page > page_count) current_page = page_count;

      const originEl = document.getElementById("origin");
      if (originEl) {
        if (query) {
          originEl.textContent = `🔗 Target: ${origin} (${len} of ${allLinks.length} links matching "${searchQuery.trim()}")`;
        } else {
          originEl.textContent = `🔗 Target: ${origin} (${allLinks.length} links)`;
        }
      }

      linksDiv.innerHTML = "";

      if (len === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.style.padding = "15px 5px";
        emptyDiv.style.color = "#777";
        emptyDiv.style.fontStyle = "italic";
        emptyDiv.innerText = query ? "No matching links found." : "No links extracted yet.";
        linksDiv.appendChild(emptyDiv);
      } else {
        const start = (current_page - 1) * per_page;
        const end = start + per_page;
        const pageItems = filtered.slice(start, end);

        pageItems.forEach(link => {
          const pageDiv = document.createElement("div");
          pageDiv.className = "link";
          const kw = document.createElement("div");
          kw.className = "keyword";
          const a = document.createElement("a");
          a.href = `${link}`;
          a.setAttribute("target", "_blank");
          a.innerText = link;
          a.style.color = "initial";
          kw.appendChild(a);
          pageDiv.appendChild(kw);

          let remove_url_btn = document.createElement("span");
          remove_url_btn.classList.add("removeLogBtn");
          remove_url_btn.addEventListener("click", () => {
            remove_link_from_origin(origin, link);
          });
          remove_url_btn.innerText = "x";
          pageDiv.appendChild(remove_url_btn);

          linksDiv.appendChild(pageDiv);
        });
      }

      let pagination_div = document.querySelector(".origin_dashboard .pagination");
      if (!pagination_div) return;
      pagination_div.innerHTML = "";

      function navigateTo(p) {
        const activeQuery = searchInput ? searchInput.value : "";
        renderLinks(p, activeQuery);
        try {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("page", p);
          const qVal = activeQuery.trim();
          if (qVal) {
            newUrl.searchParams.set("q", qVal);
          } else {
            newUrl.searchParams.delete("q");
          }
          window.history.replaceState({}, "", newUrl.toString());
        } catch (e) {}
      }

      if (page_count > 0) {
        let page_range = [
          current_page - 2 <= 0 ? null : current_page - 2,
          current_page - 1 <= 0 ? null : current_page - 1,
          current_page,
          current_page + 1 > page_count ? null : current_page + 1,
          current_page + 2 > page_count ? null : current_page + 2
        ];

        page_range.forEach((page) => {
          if (page != null) {
            let page_button = document.createElement("div");
            page_button.classList.add("page-button");
            if (page === current_page) {
              page_button.classList.add("page-button-active");
            }
            page_button.innerText = page;
            pagination_div.appendChild(page_button);
            page_button.addEventListener("click", () => {
              navigateTo(page);
            });
          }
        });

        if (!page_range.includes(1) && !page_range.includes("1")) {
          let page_button = document.createElement("div");
          page_button.classList.add("page-button");
          page_button.innerText = "1";
          pagination_div.insertBefore(document.createTextNode("..."), pagination_div.firstChild);
          pagination_div.insertBefore(page_button, pagination_div.firstChild);
          page_button.addEventListener("click", () => {
            navigateTo(1);
          });
        }

        if (!page_range.includes(page_count) && !page_range.includes(page_count.toString())) {
          let page_button = document.createElement("div");
          page_button.classList.add("page-button");
          page_button.innerText = page_count;

          pagination_div.appendChild(document.createTextNode("..."));
          pagination_div.appendChild(page_button);
          page_button.addEventListener("click", () => {
            navigateTo(page_count);
          });
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const activeQuery = searchInput.value;
        renderLinks(1, activeQuery);
        try {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("page", 1);
          const qVal = activeQuery.trim();
          if (qVal) {
            newUrl.searchParams.set("q", qVal);
          } else {
            newUrl.searchParams.delete("q");
          }
          window.history.replaceState({}, "", newUrl.toString());
        } catch (e) {}
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") e.preventDefault();
      });
    }

    const initialPage = getQueryParam("page") ? parseInt(getQueryParam("page"), 10) : 1;
    renderLinks(initialPage, initialQuery);
  });
}

if (getQueryParam("origin")) {
  loadOriginData(getQueryParam("origin"));
}

document.getElementById("all").addEventListener("click", () => {
  document.getElementById("childList").checked = document.getElementById("all").checked;
  document.getElementById("subtree").checked = document.getElementById("all").checked;
  document.getElementById("attributes").checked = document.getElementById("all").checked;
  document.getElementById("attributeOldValue").checked = document.getElementById("all").checked;
  document.getElementById("characterData").checked = document.getElementById("all").checked;
  document.getElementById("characterDataOldValue").checked = document.getElementById("all").checked;
});

document.getElementsByClassName("backBtn")[0].addEventListener("click", () => {
  location.href = location.origin + location.pathname;
});

const openAutoCrawlBtn = document.getElementById("openAutoCrawlBtn");
if (openAutoCrawlBtn) {
  openAutoCrawlBtn.addEventListener("click", () => {
    const origin = getQueryParam("origin");
    if (origin) {
      window.location.href = `crawler.html?origin=${encodeURIComponent(origin)}`;
    }
  });
}
