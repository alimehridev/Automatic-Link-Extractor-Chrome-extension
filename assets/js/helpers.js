function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}


document.getElementById("removeAllBtn").addEventListener("click", () => {
    let confirmation = confirm("Are you sure ?")
    if(confirmation){
        chrome.storage.local.get("links", (result) => {
            result["links"][getQueryParam("origin")] = []
            chrome.storage.local.set({ ["links"]: result["links"] }, () => {
                location.reload()
            });            
        })
    }
})