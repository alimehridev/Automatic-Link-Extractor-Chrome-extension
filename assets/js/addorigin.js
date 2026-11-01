const input = document.getElementById("originInput");
const addOriginBtn = document.getElementById("addOriginBtn");
const originList = document.getElementById("data");
const dataDiv = document.getElementById("data");

function remove_origin_from_list(payload) {
    if (!payload) return;

    const confirmed = confirm(`Are you sure you want to delete origin "${payload}" and all its associated data (links, regexes, settings)?`);
    if (!confirmed) return;

    chrome.storage.local.get(["origins", "sensitivities", "regexes", "links", "extraction_rules"], (result) => {
        if (!result["origins"] || result["origins"].length === 0) return;

        const trimmed = payload.trim();
        const withSlash = trimmed.endsWith('/') ? trimmed : trimmed + '/';
        const withoutSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
        const variants = new Set([
            payload,
            trimmed,
            withSlash,
            withoutSlash,
            encodeURIComponent(payload),
            decodeURIComponent(payload),
            encodeURIComponent(trimmed),
            decodeURIComponent(trimmed)
        ]);

        const updatedOrigins = (result["origins"] || []).filter((item) => !variants.has(item));
        const sensitivities = result["sensitivities"] || {};
        const regexes = result["regexes"] || {};
        const links = result["links"] || {};
        const extraction_rules = result["extraction_rules"] || {};

        variants.forEach(key => {
            delete sensitivities[key];
            delete regexes[key];
            delete links[key];
            delete extraction_rules[key];
        });

        chrome.storage.local.set({
            origins: updatedOrigins,
            sensitivities: sensitivities,
            regexes: regexes,
            extraction_rules: extraction_rules,
            links: links
        }, () => {
            const currentOrigin = new URLSearchParams(window.location.search).get("origin");
            if (currentOrigin && variants.has(currentOrigin)) {
                window.location.href = window.location.pathname;
            } else {
                location.reload();
            }
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
chrome.storage.local.get(["origins", "links"], (result) => {
    const origins = result["origins"] || [];
    const links = result["links"] || {};

    const originCountBadge = document.getElementById("originCountBadge");
    if (originCountBadge) {
        originCountBadge.textContent = origins.length === 1 ? "1 origin" : `${origins.length} origins`;
    }

    if (origins.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "empty-origins";
        emptyDiv.style.textAlign = "center";
        emptyDiv.style.color = "#888";
        emptyDiv.style.fontSize = "13px";
        emptyDiv.style.padding = "25px 0";
        emptyDiv.textContent = "No origins added yet. Add an origin or pattern above to start extracting links.";
        dataDiv.appendChild(emptyDiv);
        return;
    }

    const reversedOrigins = origins.slice().reverse();
    reversedOrigins.forEach((item) => { 
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

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "origin-actions";

        const originLinks = links[item] || [];
        const countSpan = document.createElement("span");
        countSpan.className = "origin-link-count";
        countSpan.textContent = originLinks.length === 1 ? "1 link" : `${originLinks.length} links`;

        let remove_btn = document.createElement("span");
        remove_btn.classList.add("removeLogBtn");
        remove_btn.title = "Delete origin and all its data";
        remove_btn.addEventListener("click", (e) => {
            e.stopPropagation();
            remove_origin_from_list(item);
        });
        remove_btn.innerText = "x";

        actionsDiv.appendChild(countSpan);
        actionsDiv.appendChild(remove_btn);
        pageDiv.appendChild(actionsDiv);

        dataDiv.appendChild(pageDiv);
    });
});
