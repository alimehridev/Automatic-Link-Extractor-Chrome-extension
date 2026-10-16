// Schemes that never point to a real, openable link.
const SKIPPED_PREFIXES = [
  "data:",
  "blob:",
  "javascript:",
  "about:",
  "chrome:",
  "chrome-extension:",
  "edge:",
  "vbscript:"
];

self.onmessage = function (event) {
  const data = event.data || {};
  const urls = Array.isArray(data.urls) ? data.urls : [];
  // The worker has no access to the page's location, so the content script
  // sends the page base URL used to resolve relative links.
  const base = (typeof data.base === "string" && data.base) ? data.base : self.location.href;

  const links = [];
  for (const raw of urls) {
    if (typeof raw !== "string") continue;

    const value = raw.trim();
    if (!value || value.startsWith("#")) continue;
    if (SKIPPED_PREFIXES.some(prefix => value.toLowerCase().startsWith(prefix))) continue;

    let resolved;
    try {
      resolved = new URL(value, base).href;
    } catch (e) {
      continue;
    }

    if (SKIPPED_PREFIXES.some(prefix => resolved.toLowerCase().startsWith(prefix))) continue;
    links.push(resolved);
  }

  postMessage([...new Set(links)]);
};
