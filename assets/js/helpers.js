function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}

document.getElementById("removeAllBtn").addEventListener("click", () => {
  let confirmation = confirm("Are you sure ?");
  if (confirmation) {
    chrome.storage.local.get("links", (result) => {
      result["links"][getQueryParam("origin")] = [];
      chrome.storage.local.set({ ["links"]: result["links"] }, () => {
        location.reload();
      });
    });
  }
});

document.getElementById("copy_all").addEventListener("click", (e) => {
  chrome.storage.local.get("links", (result) => {
    let arr = (result["links"] && result["links"][getQueryParam("origin")]) || [];
    const searchInput = document.getElementById("searchLinksInput");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    if (query) {
      arr = arr.filter(link => link.toLowerCase().includes(query));
    }
    e.target.innerText = "Copied";
    copyToClipboard(arr.join("\n"));
    setTimeout(() => {
      e.target.innerText = "Copy all to clipboard";
    }, 500);
  });
});
