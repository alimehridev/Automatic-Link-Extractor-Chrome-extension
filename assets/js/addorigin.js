const input = document.getElementById("originInput");
const addOriginBtn = document.getElementById("addOriginBtn");
const originList = document.getElementById("data");

function remove_origin_from_list(payload){
    chrome.storage.local.get("origins", (result) => {
        if (!result["origins"] || result["origins"].length === 0) return;

        const updated = result["origins"].filter((item) => item !== payload);
        chrome.storage.local.set({ ["origins"]: updated }, () => {
            location.reload()
        });
    });
}


addOriginBtn.addEventListener("click", () => {
    const value = input.value.trim();
    if (value === "") return;

    const pageDiv = document.createElement("div");
    pageDiv.className = "page";
    const kw = document.createElement("div");
    kw.className = "keyword";
    const a = document.createElement("a")
    a.href = `?origin=${value}`
    a.innerText = value
    a.style.color = "initial"
    kw.appendChild(a);
    pageDiv.appendChild(kw)

    let remove_url_btn = document.createElement("span")
    remove_url_btn.classList.add("removeLogBtn")
    remove_url_btn.addEventListener("click", () => {
        remove_origin_from_list(value)
    })
    remove_url_btn.innerText = "x"
    pageDiv.appendChild(remove_url_btn)

    dataDiv.appendChild(pageDiv)
    input.value = "";

    chrome.storage.local.get("origins", (result) => {
        const arr = result["origins"] || [];
        
        if (!arr.includes(value)) {
            arr.push(value);
        }

        chrome.storage.local.set({ ["origins"]: arr }, () => {
            console.log("Added:", value);
        });
    });

    chrome.storage.local.get("sensitivities", (result) => {
        const arr = result["sensitivities"] || {};
        
        if (!Object.keys(arr).includes(value)) {
            arr[value] = {
                childList: 0,
                subtree: 0,
                attributes: 0,
                attributeOldValue: 0,
                characterData: 0,
                characterDataOldValue: 0
            }
        }

        chrome.storage.local.set({ ["sensitivities"]: arr }, () => {});
    });
    chrome.storage.local.get("links", (result) => {
        const arr = result["links"] || {};
        
        if (!Object.keys(arr).includes(value)) {
            arr[value] = []
        }

        chrome.storage.local.set({ ["links"]: arr }, () => {});
    });

});

// Optional: add keyword on Enter
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addOriginBtn.click();
});



const dataDiv = document.getElementById("data");
dataDiv.innerHTML = "";
chrome.storage.local.get("origins", (result) => {
    if (!result["origins"] || result["origins"].length === 0) return;
    let origins = result['origins']
    origins.reverse()
    origins.forEach((item) => { 
        const pageDiv = document.createElement("div");
        pageDiv.className = "page";
        const kw = document.createElement("div");
        kw.className = "keyword";
        const a = document.createElement("a")
        a.href = `?origin=${item}`
        a.innerText = item
        a.style.color = "initial"
        kw.appendChild(a);
        pageDiv.appendChild(kw)

        let remove_url_btn = document.createElement("span")
        remove_url_btn.classList.add("removeLogBtn")
        remove_url_btn.addEventListener("click", () => {
            remove_origin_from_list(item)
        })
        remove_url_btn.innerText = "x"
        pageDiv.appendChild(remove_url_btn)

        dataDiv.appendChild(pageDiv)
    })
    
});