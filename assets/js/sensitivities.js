document.getElementById("save_sensitivities").addEventListener("click", () => {
    let childList = +document.getElementById("childList").checked
    let subtree = +document.getElementById("subtree").checked
    let attributes = +document.getElementById("attributes").checked
    let attributeOldValue = +document.getElementById("attributeOldValue").checked
    let characterData = +document.getElementById("characterData").checked
    let characterDataOldValue = +document.getElementById("characterDataOldValue").checked
    let sensitivities = {
        childList: childList,
        subtree: subtree,
        attributes: attributes,
        attributeOldValue: attributeOldValue,
        characterData: characterData,
        characterDataOldValue: characterDataOldValue,
    }
    chrome.storage.local.get("sensitivities", (result) => {
        const arr = result["sensitivities"] || {};
        arr[getQueryParam("origin")] = sensitivities
        chrome.storage.local.set({ ["sensitivities"]: arr }, () => {});
    });
})
let sensitivity_chboxes = document.getElementsByClassName("sensitivity")
Object.keys(sensitivity_chboxes).forEach(item => {
    let chbox = sensitivity_chboxes[item]
    chbox.addEventListener("click", e => {
        if(
            document.getElementById("childList").checked
            && document.getElementById("subtree").checked
            && document.getElementById("attributes").checked
            && document.getElementById("attributeOldValue").checked
            && document.getElementById("characterData").checked
            && document.getElementById("characterDataOldValue").checked
        ){
            document.getElementById("all").checked = true
        }else {
            document.getElementById("all").checked = false
        }
    })
})


