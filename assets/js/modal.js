function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

let jsLinksCache = [];

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
    let div = document.createElement("div");
    div.className = "js-file-item";
    div.innerHTML = `
      <label class="js-file-label">
        <input type="checkbox" class="js-file-chbox" data-index="${index}" checked>
        <span class="js-file-name" title="${link}">${link}</span>
      </label>
      <span class="js-status-code"></span>
      <a href="${link}" target="_blank" class="js-file-open-btn">open</a>
    `;
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
  if(custom_regexes.querySelectorAll(".custom-regex").length === 0){
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
    regex_value_span.innerHTML = "YOUR_REGEX"
    custom_regex.appendChild(regex_value_span)
    custom_regex.appendChild(document.createTextNode(" /g "))
    let remove_regex_span = document.createElement("span")
    remove_regex_span.innerHTML = "-"
    remove_regex_span.classList.add("regex-remove-btn")
    custom_regex.appendChild(remove_regex_span)
    remove_regex_span.addEventListener("click", () => {
      custom_regex.remove()
    })
    custom_regexes.appendChild(custom_regex)
  }
  

  let el2 = document.getElementsByClassName("add-regex-exclude")[0]
  custom_regexes = el2.parentElement.nextElementSibling
  if(custom_regexes.querySelectorAll(".custom-regex").length === 0){
    try{
      if(custom_regexes.querySelectorAll(".custom-regex")[custom_regexes.querySelectorAll(".custom-regex").length - 1].querySelector(".regex-value").innerText == "YOUR_REGEX"){
          return
        }
    }catch{}
    
    custom_regex = document.createElement("div")
    custom_regex.classList.add("custom-regex")
    custom_regex.appendChild(document.createTextNode(" / "))
    regex_value_span = document.createElement("span")
    regex_value_span.setAttribute("contenteditable", "true")
    regex_value_span.classList.add("regex-value")
    regex_value_span.innerHTML = "YOUR_REGEX"
    custom_regex.appendChild(regex_value_span)
    custom_regex.appendChild(document.createTextNode(" /g "))
    remove_regex_span = document.createElement("span")
    remove_regex_span.innerHTML = "-"
    remove_regex_span.classList.add("regex-remove-btn")
    custom_regex.appendChild(remove_regex_span)
    remove_regex_span.addEventListener("click", () => {
      custom_regex.remove()
    })
    custom_regexes.appendChild(custom_regex)
  }
  
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

  //Include Regexes
  
  //Exclude Regexes
  

  links.forEach(link => {
    fetch(link, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain'
      }
    }).then(async response => {
      let content = await response.text()
      let status_code_el = [...document.querySelectorAll(".js-file-name")].filter(i => i.innerText===link)[0].parentElement.nextElementSibling
      status_code_el.innerText = response.status
      if(response.status === 200){
        status_code_el.style.color = "#00a900"
      }
      let include_regexes = [...document.querySelector(".regex-include").querySelectorAll(".custom-regex")].map(i => i.querySelector(".regex-value").innerText).filter(i => i !== "YOUR_REGEX")
      let exclude_regexes = [...document.querySelector(".regex-exclude").querySelectorAll(".custom-regex")].map(i => i.querySelector(".regex-value").innerText).filter(i => i !== "YOUR_REGEX")
      const absoluteRegex = /(?:\b(?:https?:\/\/|ftp:\/\/|\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>\]\)]*)?\b)/g;
      const relativeRegex = /\b(?:\/|\.\/|\.\.\/)[^\s"'<>\]\)]*\b/g;

      const absoluteLinks = content.match(absoluteRegex) || [];
      const relativeLinks = content.match(relativeRegex) || [];
      let output_links = output.value.split("\n").filter(item => item.length > 0)
      output_links = output_links.concat(absoluteLinks)
      output_links = output_links.concat(relativeLinks)
      output_links = [...new Set(output_links)]
      output_links = output_links.filter(item => item.length > 0)
      if((include_regexes.length > 0)){
        output_links = output_links.filter(link =>
            include_regexes.some(pattern => new RegExp(pattern, 'i').test(link))
        );
      }
      if((exclude_regexes.length > 0)){
        output_links = output_links.filter(link => !exclude_regexes.some(p => new RegExp(p, "i").test(link)))
      }
      output_links.sort()
      output.value = output_links.join("\n")
      document.getElementsByClassName("links-number")[0].innerText = `${output_links.length} links`
      document.getElementById("current_file").innerHTML = "Current file: " + link
      let progress = parseInt(progression.getAttribute("value"))
      progression.setAttribute("value", progress + 1)
      numeric_progression.innerText = `${progress + 1}/${scripts_number}`

      if (progress + 1 === scripts_number) {
        crawlBtn.innerText = "Crawl"
        crawlBtn.disabled = false
        document.getElementById("current_file").innerHTML = ""
      }

    }).catch(e => {
      document.getElementById("current_file").innerHTML = "Current file: " + link
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
  regex_value_span.innerHTML = "YOUR_REGEX"
  custom_regex.appendChild(regex_value_span)
  custom_regex.appendChild(document.createTextNode(" /g "))
  let remove_regex_span = document.createElement("span")
  remove_regex_span.innerHTML = "-"
  remove_regex_span.classList.add("regex-remove-btn")
  custom_regex.appendChild(remove_regex_span)
  remove_regex_span.addEventListener("click", () => {
    custom_regex.remove()
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
  regex_value_span.innerHTML = "YOUR_REGEX"
  custom_regex.appendChild(regex_value_span)
  custom_regex.appendChild(document.createTextNode(" /g "))
  let remove_regex_span = document.createElement("span")
  remove_regex_span.innerHTML = "-"
  remove_regex_span.classList.add("regex-remove-btn")
  custom_regex.appendChild(remove_regex_span)
  remove_regex_span.addEventListener("click", () => {
    custom_regex.remove()
  })
  custom_regexes.appendChild(custom_regex)
})