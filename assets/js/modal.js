function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function getRegexList(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return [];
  return [...container.querySelectorAll(".custom-regex")]
    .map(i => {
      const el = i.querySelector(".regex-value");
      return el ? el.innerText.trim() : "";
    })
    .filter(i => i && i !== "YOUR_REGEX");
}

function save_regex_to_storage(){
  let include_regexes = getRegexList(".regex-include");
  let exclude_regexes = getRegexList(".regex-exclude");

  chrome.storage.local.get("regexes", (result) => {
      const arr = result["regexes"] || {};

      arr[getQueryParam("origin")] = {
        includes: [...include_regexes, "YOUR_REGEX"],
        excludes: [...exclude_regexes, "YOUR_REGEX"]
      };
      chrome.storage.local.set({ ["regexes"]: arr }, () => {});
  });
}

let jsLinksCache = [];

// URLs in code/comment text are often followed by sentence punctuation.
function stripTrailingPunctuation(link) {
  return link.replace(/[.,;:!?)\]}'"]+$/, "");
}

// Regex extraction is heuristic, so let the URL parser confirm each candidate.
function isValidLink(link) {
  try {
    new URL(link, "https://base.invalid/");
    return true;
  } catch (e) {
    return false;
  }
}

// Resolve a candidate URL against the URL of the file it was found in.
// "/x" -> file origin, "./x"/"../x" -> file directory, "//host" -> file scheme.
function resolveAgainst(baseUrl, value) {
  try {
    return new URL(value, baseUrl).href;
  } catch (e) {
    return null;
  }
}

function renderJsFileList(links) {
  let container = document.getElementById("jsFileList");
  container.innerHTML = "";
  links.forEach((link, index) => {
    let filename = "";
    try {
      filename = new URL(link).pathname.split("/").reverse()[0];
    } catch (e) {
      filename = link.split("/").reverse()[0];
    }
    let short_name = link
    if(link.length > 48){
      let first_slice = link.slice(0, 24)
      let last_slice = link.split("").reverse().join("").slice(0,24).split("").reverse().join("")
      short_name = first_slice + "..." + last_slice
    }
    let div = document.createElement("div");
    div.className = "js-file-item";

    let label = document.createElement("label");
    label.className = "js-file-label";

    let chbox = document.createElement("input");
    chbox.type = "checkbox";
    chbox.className = "js-file-chbox";
    chbox.setAttribute("data-index", String(index));
    chbox.checked = true;

    let spanName = document.createElement("span");
    spanName.className = "js-file-name";
    spanName.setAttribute("title", link);
    spanName.textContent = short_name;

    label.appendChild(chbox);
    label.appendChild(spanName);

    let statusCode = document.createElement("span");
    statusCode.className = "js-status-code";

    let openBtn = document.createElement("a");
    openBtn.href = link;
    openBtn.target = "_blank";
    openBtn.rel = "noopener noreferrer";
    openBtn.className = "js-file-open-btn";
    openBtn.textContent = "open";

    div.appendChild(label);
    div.appendChild(statusCode);
    div.appendChild(openBtn);

    container.appendChild(div);
  });
  document.getElementById("jsFileCount").innerText = `${links.length} javascript files`;
  updateSelectToggleText();
}

function getCheckedLinks() {
  let checkboxes = document.querySelectorAll(".js-file-chbox");
  let checked = [];
  checkboxes.forEach(chbox => {
    if (chbox.checked) {
      checked.push(jsLinksCache[parseInt(chbox.getAttribute("data-index"))]);
    }
  });
  return checked;
}

function updateSelectToggleText() {
  let checkboxes = document.querySelectorAll(".js-file-chbox");
  let allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(c => c.checked);
  document.getElementById("selectAllNoneBtn").innerText = allChecked ? "Select None" : "Select All";
}

document.getElementById("closeModalBtn").addEventListener("click", () => {
  document.getElementById("myModal").style.display = "none";
})

document.getElementById("get_js_links").addEventListener("click", () => {
  document.getElementById("myModal").style.display = "block";

  chrome.storage.local.get("links", (result) => {
    let links = result["links"][getQueryParam("origin")] || [];
    jsLinksCache = links.filter(l => (l.includes(".js") && l.startsWith("http")));
    renderJsFileList(jsLinksCache);
  })
  let el1 = document.getElementsByClassName("add-regex-include")[0]
  let custom_regexes = el1.parentElement.nextElementSibling
  custom_regexes.innerHTML = ""
  chrome.storage.local.get("regexes", (result) => {
    let regexesData = (result["regexes"] && result["regexes"][getQueryParam("origin")]) || {};
    let incList = Array.isArray(regexesData.includes) ? regexesData.includes : ["YOUR_REGEX"];
    let excList = Array.isArray(regexesData.excludes) ? regexesData.excludes : ["YOUR_REGEX"];
    incList.forEach(re => {
      let el1 = document.getElementsByClassName("add-regex-include")[0]
      let custom_regexes = el1.parentElement.nextElementSibling
      let custom_regex = document.createElement("div")
      custom_regex.classList.add("custom-regex")
      custom_regex.appendChild(document.createTextNode(" / "))
      let regex_value_span = document.createElement("span")
      regex_value_span.setAttribute("contenteditable", "true")
      regex_value_span.classList.add("regex-value")
      regex_value_span.textContent = re
      custom_regex.appendChild(regex_value_span)
      
      regex_value_span.addEventListener("keyup", (ev) => {
        save_regex_to_storage()
      })
      
      custom_regex.appendChild(document.createTextNode(" /g "))
      let remove_regex_span = document.createElement("span")
      remove_regex_span.textContent = "-"
      remove_regex_span.classList.add("regex-remove-btn")
      custom_regex.appendChild(remove_regex_span)
      remove_regex_span.addEventListener("click", () => {
        custom_regex.remove()
        save_regex_to_storage()
      })
      custom_regexes.appendChild(custom_regex)
    })
    let el2 = document.getElementsByClassName("add-regex-exclude")[0]
    custom_regexes = el2.parentElement.nextElementSibling
    custom_regexes.innerHTML = ""
    excList.forEach(re => {
      let el2 = document.getElementsByClassName("add-regex-exclude")[0]
      custom_regexes = el2.parentElement.nextElementSibling
      let custom_regex = document.createElement("div")
      custom_regex.classList.add("custom-regex")
      custom_regex.appendChild(document.createTextNode(" / "))
      regex_value_span = document.createElement("span")
      regex_value_span.setAttribute("contenteditable", "true")
      regex_value_span.classList.add("regex-value")
      regex_value_span.textContent = re
      custom_regex.appendChild(regex_value_span)

      regex_value_span.addEventListener("keyup", (ev) => {
        save_regex_to_storage()
      })

      custom_regex.appendChild(document.createTextNode(" /g "))
      remove_regex_span = document.createElement("span")
      remove_regex_span.textContent = "-"
      remove_regex_span.classList.add("regex-remove-btn")
      custom_regex.appendChild(remove_regex_span)
      remove_regex_span.addEventListener("click", () => {
        custom_regex.remove()
        save_regex_to_storage()
      })
      custom_regexes.appendChild(custom_regex)
    })
  })
})

document.getElementById("selectAllNoneBtn").addEventListener("click", () => {
  let checkboxes = document.querySelectorAll(".js-file-chbox");
  let allChecked = Array.from(checkboxes).every(c => c.checked);
  checkboxes.forEach(chbox => {
    chbox.checked = !allChecked;
  });
  updateSelectToggleText();
})

document.getElementById("jsFileList").addEventListener("change", (e) => {
  if (e.target.classList.contains("js-file-chbox")) {
    updateSelectToggleText();
  }
})

document.getElementById("crawlBtn").addEventListener("click", () => {
  let progression = document.getElementById("progression")
  let output = document.getElementById("output")
  let numeric_progression = document.getElementById("numeric-progression")
  let crawlBtn = document.getElementById("crawlBtn")
  let decodeURLCheckBox = document.getElementById("decode-urls").checked
  let addBaseURLCheckBox = document.getElementById("base-url-predict").checked
  let links = getCheckedLinks();
  let scripts_number = links.length;

  output.value = ""
  crawlBtn.innerText = "⟳"
  crawlBtn.disabled = true

  progression.setAttribute("max", scripts_number)
  let scripts_crawled = 0
  progression.setAttribute("value", scripts_crawled)
  numeric_progression.innerText = `${scripts_crawled}/${scripts_number}`

  if (scripts_number === 0) {
    crawlBtn.innerText = "Crawl"
    crawlBtn.disabled = false
    return
  }
  links.forEach(link => {
    fetch(link, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain'
      }
    }).then(async response => {
      let content = await response.text()
      let status_code_el = [...document.querySelectorAll(".js-file-name")].filter(i => i.getAttribute("title")===link)[0].parentElement.nextElementSibling
      status_code_el.innerText = response.status
      if(response.status === 200){
        status_code_el.style.color = "#00a900"
      }
      let include_regexes = getRegexList(".regex-include");
      let exclude_regexes = getRegexList(".regex-exclude");
      // Absolute: any listed scheme, or a protocol-relative //host URL.
      const absoluteRegex = /(?:(?:https?|ftps?|wss?):)?\/\/[^\s"'`<>\\^|{}\[\]]+/gi;
      // Relative: only when it is a whole quoted string literal, so it cannot
      // re-match the path part of an absolute URL.
      const relativeRegex = /["'`]((?:\.\.?\/|\/(?!\/))[^"'`\s\\]*)["'`]/g;

      const fileUrl = response.url || link; // final URL after redirects

      const absoluteLinks = (content.match(absoluteRegex) || [])
        .map(stripTrailingPunctuation)
        .map(v => resolveAgainst(fileUrl, v))
        .filter(Boolean);

      const relativeLinks = [...content.matchAll(relativeRegex)]
        .map(m => m[1])
        .map(v => resolveAgainst(fileUrl, v))
        .filter(Boolean);

      let output_links = output.value.split("\n").filter(item => item.length > 0)
      output_links = output_links.concat(absoluteLinks)
      output_links = output_links.concat(relativeLinks)
      output_links = [...new Set(output_links)]
      output_links = output_links.filter(item => item.length > 0)
      output_links = output_links.filter(isValidLink)
      if (include_regexes.length > 0) {
        output_links = output_links.filter(link =>
          include_regexes.some(pattern => {
            try {
              return new RegExp(pattern, 'i').test(link);
            } catch (e) {
              return false;
            }
          })
        );
      }
      if (exclude_regexes.length > 0) {
        output_links = output_links.filter(link =>
          !exclude_regexes.some(p => {
            try {
              return new RegExp(p, "i").test(link);
            } catch (e) {
              return false;
            }
          })
        );
      }
      output_links.sort()
      if(decodeURLCheckBox){
        output_links = output_links.map(i => decodeURIComponent(i))
      }
      output.value = output_links.join("\n")
      document.getElementsByClassName("links-number")[0].innerText = `${output_links.length} links`
      document.getElementById("current_file").textContent = "Current file: " + link
      let progress = parseInt(progression.getAttribute("value"))
      progression.setAttribute("value", progress + 1)
      numeric_progression.innerText = `${progress + 1}/${scripts_number}`

      if (progress + 1 === scripts_number) {
        crawlBtn.innerText = "Crawl"
        crawlBtn.disabled = false
        document.getElementById("current_file").textContent = ""
      }

    }).catch(e => {
      document.getElementById("current_file").textContent = "Current file: " + link
      let progress = parseInt(progression.getAttribute("value"))
      progression.setAttribute("value", progress + 1)
      numeric_progression.innerText = `${progress + 1}/${scripts_number}`

      if (progress + 1 === scripts_number) {
        crawlBtn.innerText = "Crawl"
        crawlBtn.disabled = false
      }
    });

  })
})

document.getElementById("addLinksToTargetBtn").addEventListener("click", () => {
  let output = document.getElementById("output")
  let found_links = output.value.split("\n").filter(item => item.length > 0)
  if (found_links.length === 0) return

  let origin = getQueryParam("origin")
  chrome.storage.local.get("links", (result) => {
    let links_obj = result["links"] || {};
    let existing = links_obj[origin] || [];
    let merged = [...new Set(existing.concat(found_links))]
    links_obj[origin] = merged
    chrome.storage.local.set({ ["links"]: links_obj }, () => {
      location.reload()
    });
  })
})

document.getElementById("copyBtn").addEventListener("click", (e) => {
  const text = document.getElementById("output").value
  copyToClipboard(text)
  e.target.innerText = "copied"
  setTimeout(() => {
    e.target.innerText = "copy"
  }, 1000)
})

document.getElementsByClassName("add-regex-include")[0].addEventListener("click", (ev) => {
  let el = ev.target
  let custom_regexes = el.parentElement.nextElementSibling
  try{
    if(custom_regexes.querySelectorAll(".custom-regex")[custom_regexes.querySelectorAll(".custom-regex").length - 1].querySelector(".regex-value").innerText == "YOUR_REGEX"){
        return
      }
  }catch{}
  
  let custom_regex = document.createElement("div")
  custom_regex.classList.add("custom-regex")
  custom_regex.appendChild(document.createTextNode(" / "))
  let regex_value_span = document.createElement("span")
  regex_value_span.setAttribute("contenteditable", "true")
  regex_value_span.classList.add("regex-value")
  regex_value_span.textContent = "YOUR_REGEX"
  custom_regex.appendChild(regex_value_span)

  regex_value_span.addEventListener("keyup", (ev) => {
    save_regex_to_storage()
  })
  
  custom_regex.appendChild(document.createTextNode(" /g "))
  let remove_regex_span = document.createElement("span")
  remove_regex_span.textContent = "-"
  remove_regex_span.classList.add("regex-remove-btn")
  custom_regex.appendChild(remove_regex_span)
  remove_regex_span.addEventListener("click", () => {
    custom_regex.remove()
    save_regex_to_storage()
  })
  custom_regexes.appendChild(custom_regex)
})
document.getElementsByClassName("add-regex-exclude")[0].addEventListener("click", (ev) => {
  let el = ev.target
  let custom_regexes = el.parentElement.nextElementSibling
  try{
    if(custom_regexes.querySelectorAll(".custom-regex")[custom_regexes.querySelectorAll(".custom-regex").length - 1].querySelector(".regex-value").innerText == "YOUR_REGEX"){
        return
      }
  }catch{}
  
  let custom_regex = document.createElement("div")
  custom_regex.classList.add("custom-regex")
  custom_regex.appendChild(document.createTextNode(" / "))
  let regex_value_span = document.createElement("span")
  regex_value_span.setAttribute("contenteditable", "true")
  regex_value_span.classList.add("regex-value")
  regex_value_span.textContent = "YOUR_REGEX"
  custom_regex.appendChild(regex_value_span)
  
  regex_value_span.addEventListener("keyup", (ev) => {
    save_regex_to_storage()
  })

  custom_regex.appendChild(document.createTextNode(" /g "))
  let remove_regex_span = document.createElement("span")
  remove_regex_span.textContent = "-"
  remove_regex_span.classList.add("regex-remove-btn")
  custom_regex.appendChild(remove_regex_span)
  remove_regex_span.addEventListener("click", () => {
    custom_regex.remove()
    save_regex_to_storage()
  })
  custom_regexes.appendChild(custom_regex)
})