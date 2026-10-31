const params = new URLSearchParams(window.location.search);
const originParam = params.get("origin");
const originAddParam = params.get("origin_add");

if (!originParam) {
    const originDash = document.getElementsByClassName("origin_dashboard")[0];
    if (originDash) originDash.remove();
    const mainDash = document.getElementsByClassName("main_dashboard")[0];
    if (mainDash) mainDash.style.display = "block";
    if (originAddParam) {
        const originInput = document.getElementById("originInput");
        if (originInput) originInput.value = originAddParam;
    }
    const originInput = document.getElementById("originInput");
    if (originInput) originInput.focus();
} else {
    const originDash = document.getElementsByClassName("origin_dashboard")[0];
    if (originDash) originDash.style.display = "block";
    const mainDash = document.getElementsByClassName("main_dashboard")[0];
    if (mainDash) mainDash.remove();
}
