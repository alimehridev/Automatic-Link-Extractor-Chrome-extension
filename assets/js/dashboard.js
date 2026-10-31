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
  chrome.storage.local.get("links", (result) => {
    let arr = (result["links"] && result["links"][origin]) || [];
    let counter = 0;
    let per_page = 5;
    let current_page = getQueryParam("page") ? parseInt(getQueryParam("page"), 10) : 1;
    if (isNaN(current_page) || current_page < 1) current_page = 1;

    arr.forEach(link => {
      if (!(counter >= (current_page - 1) * per_page) || !(counter < (current_page * per_page))) {
        counter++;
        return;
      }
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
      counter++;
    });

    const len = arr.length;
    document.getElementById("origin").textContent = `🔗 Target: ${origin} (${len} links)`;
    let page_count = Math.ceil(len / per_page);
    let pagination_div = document.getElementsByClassName("pagination")[0];
    pagination_div.innerHTML = "";

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
            if (location.href.match(/page=\d{1,5}/)) {
              location = location.href.replace(location.href.match(/page=\d{1,5}/)[0], `page=${page}`);
            } else {
              location = location + `&page=${page}`;
            }
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
          if (location.href.match(/page=\d{1,5}/)) {
            location = location.href.replace(location.href.match(/page=\d{1,5}/)[0], `page=1`);
          } else {
            location = location + `&page=1`;
          }
        });
      }

      if (!page_range.includes(page_count) && !page_range.includes(page_count.toString())) {
        let page_button = document.createElement("div");
        page_button.classList.add("page-button");
        page_button.innerText = page_count;
        
        pagination_div.appendChild(document.createTextNode("..."));
        pagination_div.appendChild(page_button);
        page_button.addEventListener("click", () => {
          if (location.href.match(/page=\d{1,5}/)) {
            location = location.href.replace(location.href.match(/page=\d{1,5}/)[0], `page=${page_count}`);
          } else {
            location = location + `&page=${page_count}`;
          }
        });
      }
    }
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
