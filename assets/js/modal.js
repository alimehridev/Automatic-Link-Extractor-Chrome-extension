function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}


document.getElementById("closeModalBtn").addEventListener("click", () => {
  document.getElementById("myModal").style.display = "none";
})

document.getElementById("get_js_links").addEventListener("click", () => {
  document.getElementById("myModal").style.display = "block";
  let progression = document.getElementById("progression")
  let output = document.getElementById("output")
  output.value = ""

  let numeric_progression = document.getElementById("numeric-progression")

  chrome.storage.local.get("links", (result) => {
    let links = result["links"][getQueryParam("origin")] || [];  
    links = links.filter(l => l.endsWith(".js"))
    let scripts_number = links.length
    progression.setAttribute("max", scripts_number)
    let scripts_crawled = 0
    progression.setAttribute("value", scripts_crawled)
    numeric_progression.innerText = `${scripts_crawled}/${scripts_number}`
    document.getElementsByClassName("links-number")[0].innerText = `${scripts_number} JS files found`
  })
})

document.getElementById("crawlBtn").addEventListener("click", () => {
  let progression = document.getElementById("progression")
  let output = document.getElementById("output")
  let numeric_progression = document.getElementById("numeric-progression")
  let crawlBtn = document.getElementById("crawlBtn")

  output.value = ""
  crawlBtn.innerText = "⟳"
  crawlBtn.disabled = true

  chrome.storage.local.get("links", (result) => {
    let links = result["links"][getQueryParam("origin")] || [];  
    links = links.filter(l => l.endsWith(".js"))
    let scripts_number = links.length
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

        const absoluteRegex = /(?:\b(?:https?:\/\/|ftp:\/\/|\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>\]\)]*)?\b)/g;
        const relativeRegex = /\b(?:\/|\.\/|\.\.\/)[^\s"'<>\]\)]*\b/g;

        const absoluteLinks = content.match(absoluteRegex) || [];
        const relativeLinks = content.match(relativeRegex) || [];
        let output_links = output.value.split("\n").filter(item => item.length > 0)
        output_links = output_links.concat(absoluteLinks)
        output_links = output_links.concat(relativeLinks)
        output_links = [...new Set(output_links)]
        output_links = output_links.filter(item => item.length > 0)
        output_links.sort()
        output.value = output_links.join("\n")
        document.getElementsByClassName("links-number")[0].innerText = `${output_links.length} links`
        document.getElementById("current_file").innerHTML = "Current file: " + new URL(link).pathname.split("/").reverse()[0]
        let progress = parseInt(progression.getAttribute("value"))
        progression.setAttribute("value", progress + 1)
        numeric_progression.innerText = `${progress + 1}/${scripts_number}`

        if (progress + 1 === scripts_number) {
          crawlBtn.innerText = "Crawl"
          crawlBtn.disabled = false
        }

      }).catch(e => {
        document.getElementById("current_file").innerHTML = "Current file: " + new URL(link).pathname.split("/").reverse()[0]
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