# DOM‑Watcher – Chrome Extension

A Chrome extension that monitors pages under a given origin and alerts you whenever specified keywords appear on those pages. It continuously watches for DOM changes and scans the page each time the DOM is updated.

## 🚀 Features

- 🔍 You specify one or multiple search terms and a target origin (e.g. `https://example.com`).
- 🕵️‍♂️ The extension watches all pages under that origin in real-time.
- 🔔 When the specified term(s) appear anywhere in the DOM, you immediately get notified.
- 🔄 It listens for **any DOM mutations** on the page (e.g. new elements, attribute changes) and re-scans the content.
- ✅ Extremely useful for tracking dynamically loading content or live updates.

## 🧠 How It Works

1. In dashboard, user sets:
   - A keyword or list of keywords to watch for.
   - A target origin (like `https://example.com`).
2. `content.js` runs on every page under that origin.
3. It installs a **MutationObserver** (modern, high-performance API) to detect any changes in the DOM (added/removed nodes, text/attribute changes)
4. Upon every mutation, the current page is scanned in search of the specified term(s).
5. If a match is found, you will be notified

## 🛠 Installation

1. Clone the repository:
   git clone https://github.com/alimehridev/DOM‑Watcher.git
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the project folder.

## ⚙️ Configuration & Usage

* Dashboard UI allows adding keywords and origin targets.
* Options persist through `chrome.storage.local` or `localStorage`.
* Notifications appear as a number under the extension icon
* The extension runs in real-time on every DOM update for pages under the configured origin.

## 📌 Potential Use Cases

* To finding reflections for XSS.
* Tracking when live content updates (e.g. comments, chat).
* Monitoring dynamically changing pages for certain keywords.

## 🎯 TODO / Roadmap

* [ ] Add support for regex in Origins and reflection patterns.
* [ ] When a reflection pattern is removed, its associated logs should also be deleted.
* [ ] When an origin is removed, its reflection patterns and logs must also be removed.
* [ ] Display the number of reflections for each origin in the dashboard.
* [ ] Add timestamps to reflection logs.
* [ ] Implement search functionality within reflection logs.
* [ ] Make reflection logs sortable (e.g. by date, keyword, etc.).
* [ ] Show a confirmation popup before deleting items.
* [ ] Validate the origin format when a user attempts to add a new one.

## 🧑‍💻 Author

* Ali Mehri – [@alimehridev](https://github.com/alimehridev)

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
