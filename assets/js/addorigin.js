const input = document.getElementById("originInput");
const addOriginBtn = document.getElementById("addOriginBtn");
const originList = document.getElementById("data");
const dataDiv = document.getElementById("data");

function remove_origin_from_list(payload) {
    chrome.storage.local.get(["origins", "sensitivities", "regexes", "links", "extraction_rules"], (result) => {
        if (!result["origins"] || result["origins"].length === 0) return;

        const updatedOrigins = result["origins"].filter((item) => item !== payload);
        const sensitivities = result["sensitivities"] || {};
        const regexes = result["regexes"] || {};
        const links = result["links"] || {};
        const extraction_rules = result["extraction_rules"] || {};

        delete sensitivities[payload];
        delete regexes[payload];
        delete links[payload];
        delete extraction_rules[payload];

        chrome.storage.local.set({
            origins: updatedOrigins,
            sensitivities: sensitivities,
            regexes: regexes,
            extraction_rules: extraction_rules,
            links: links
        }, () => {
            location.reload();
        });
    });
}

addOriginBtn.addEventListener("click", () => {
    const value = input.value.trim();
    if (value === "") return;

    input.value = "";

    chrome.storage.local.get(["origins", "sensitivities", "regexes", "links", "extraction_rules"], (result) => {
        const origins = result["origins"] || [];
        const sensitivities = result["sensitivities"] || {};
        const regexes = result["regexes"] || {};
        const links = result["links"] || {};
        const extraction_rules = result["extraction_rules"] || {};

        if (!origins.includes(value)) {
            origins.push(value);
        }

        if (!Object.keys(sensitivities).includes(value)) {
            sensitivities[value] = {
                childList: 1,
                subtree: 1,
                attributes: 1,
                attributeOldValue: 1,
                characterData: 1,
                characterDataOldValue: 1
            };
        }

        if (!Object.keys(regexes).includes(value)) {
            regexes[value] = {
                includes: [],
                excludes: []
            };
        }

        if (!Object.keys(extraction_rules).includes(value)) {
            extraction_rules[value] = {
                includes: ["YOUR_REGEX"],
                excludes: ["YOUR_REGEX"]
            };
        }

        if (!Object.keys(links).includes(value)) {
            links[value] = [];
        }

        chrome.storage.local.set({
            origins: origins,
            sensitivities: sensitivities,
            regexes: regexes,
            extraction_rules: extraction_rules,
            links: links
        }, () => {
            window.location.href = window.location.origin + window.location.pathname + `?origin=${encodeURIComponent(value)}`;
        });
    });
});

// Optional: add keyword on Enter
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addOriginBtn.click();
});

dataDiv.innerHTML = "";
chrome.storage.local.get("origins", (result) => {
    if (!result["origins"] || result["origins"].length === 0) return;
    let origins = result['origins'] || [];
    origins = origins.slice().reverse();
    origins.forEach((item) => { 
        const pageDiv = document.createElement("div");
        pageDiv.className = "page";
        const kw = document.createElement("div");
        kw.className = "keyword";
        const a = document.createElement("a");
        a.href = `?origin=${encodeURIComponent(item)}`;
        a.innerText = item;
        a.style.color = "initial";
        kw.appendChild(a);
        pageDiv.appendChild(kw);

        let remove_btn = document.createElement("span");
        remove_btn.classList.add("removeLogBtn");
        remove_btn.addEventListener("click", () => {
            remove_origin_from_list(item);
        });
        remove_btn.innerText = "x";
        pageDiv.appendChild(remove_btn);

        dataDiv.appendChild(pageDiv);
    });
});
