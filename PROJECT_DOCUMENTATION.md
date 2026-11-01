# مستندات جامع پروژه افزونه کروم — Automatic Link Extractor

> **هدف این مستند:** این فایل به عنوان مرجع اصلی و پایگاه دانش کامل پروژه تهیه شده است تا در هر زمان بتوان ساختار، معماری، منطق کد، قراردادها و باگ‌های شناخته‌شده را بررسی کرد. **این فایل طبق تعهد با هر تغییر جدید در پروژه به‌روزرسانی خواهد شد.**

---

## ۱. معرفی کلی و هدف پروژه

افزونه **Automatic Link Extractor** یک افزونه برای مرورگر گوگل کروم بر پایه **Manifest V3** است که به منظور کشف و استخراج خودکار و بلادرنگ پیوندها (Links / URLs) طراحی شده است. این افزونه سه قابلیت و پایپ‌لاین کلیدی دارد:

1. **استخراج زنده پیوندها از ساختار DOM با پشتیبانی از Wildcard Patterns (Live DOM Link Extraction):**
   یک Content Script روی وب‌سایت‌هایی که کاربر فعال (Enable) کرده یا با الگوهای وایلدکارد منطبق است اجرا می‌شود و با استفاده از `MutationObserver` هرگونه تغییر در ساختار صفحه را زیر نظر گرفته و تمامی پیوندها را از ویژگی‌های مختلف HTML (مانند `href`, `src`, `action`, `data-*` و ...) استخراج می‌کند. پیوندها به تفکیک الگو/دامنه ذخیره شده و تعداد آن‌ها در نشانگر (Badge) آیکون افزونه نمایش داده می‌شود.

2. **خزنده و تحلیل‌گر فایل‌های جاوااسکریپت (JavaScript File Crawler):**
   از طریق داشبورد افزونه، کاربر می‌تواند تمام فایل‌های اسکریپت (`.js`) کشف‌شده از دامنه را انتخاب کرده و محتوای آن‌ها را خزش (Crawl) کند تا با استفاده از الگوهای Regex بهینه‌سازی‌شده، تمامی مسیرها، اندپوینت‌های API و پیوندهای مطلق و نسبی داخل فایل‌های جاوااسکریپت استخراج شوند.

3. **استخراج جامع دامنه‌ها و ساب‌دامنه‌ها با فیلترهای Regex (Origins & Subdomains Extractor):**
   با یک کلیک روی دکمه **Extract subdomains**، تمامی لینک‌های ذخیره‌شده بررسی می‌شوند. به صورت پیش‌فرض تمام Originها/دامنه‌های پیدا شده در لینک‌ها نمایش داده می‌شوند. کاربر می‌تواند با چک‌باکس **Only show TLD+1 subdomains** خروجی را منحصراً به ساب‌دامنه‌های دامنه ریشه محدود کرده و با سیستم **Regex Filter** (شامل Include و Exclude) خروجی را به صورت زنده فیلتر کند.

4. **افزودن دستی و دلخواه لینک‌ها به تارگت (Manual Links Importer):**
   با کلیک روی دکمه `+` در کنار عنوان `🔍 Extracted Links` در داشبورد، یک پنجره مودال باز شده و کاربر می‌تواند مجموعه‌ای از لینک‌ها را در textarea وارد کند تا پس از اعتبارسنجی و حذف موارد تکراری، مستقیماً به بانک لینک‌های تارگت ذخیره شوند.

> **ویژگی فنی مهم:** این پروژه کاملاً با **Vanilla JavaScript** (جاوااسکریپت خالص استاندارد مدرن مرورگر) پیاده‌سازی شده و هیچ‌گونه وابستگی، پکیج NPM، بیلد تول (Webpack/Vite/Rollup) یا فریمورک فرانت‌اند ندارد. به صورت مستقیم در حالت Developer Mode کروم بارگذاری (Load unpacked) می‌شود.

---

## ۲. سیستم الگوها و Wildcard Matching

افزونه به جای محدود بودن به تطابق دقیق یک Origin خاص، از انواع الگوهای پیشرفته وایلدکارد پشتیبانی می‌کند:

| نوع الگو | مثال ورودی | توضیحات و دامنه پوشش |
|---|---|---|
| **ساب‌دامنه‌ها + ریشه** | `https://*.google.com` | پوشش کامل دامنه اصلی (`google.com`) و تمام زیردامنه‌ها (`mail.google.com`, `a.b.google.com`) با هر مسیری |
| **مسیرهای پیشوندی** | `https://google.com/*` | پوشش تمامی صفحات و اندپوینت‌هایی که با `https://google.com/` شروع می‌شوند (`/search`, `/images`, ...) |
| **مسیرهای خاص** | `https://google.com/search/*` | پوشش صفحات خاص یک بخش، مثلاً مسیرهای تحت `/search` |
| **ترکیب ساب‌دامنه و مسیر** | `https://*.google.com/*` | پوشش تمام ساب‌دامنه‌ها و تمام مسیرها |
| **مبدأ سنتی دقیق** | `https://google.com` | رفتار سنتی؛ استخراج لینک از تمام صفحات این مبدأ |
| **پروتکل آزاد** | `*.google.com` یا `*://*.google.com/*` | پوشش هر دو پروتکل `http` و `https` |
| **پورت‌های لوکال** | `http://localhost:3000` یا `http://localhost:*` | تست و توسعه روی پورت‌های لوکال هاست |

منطق تبدیل الگو به رگکس و بررسی تطابق به شکل مجزا در ماژول [`assets/js/pattern_matcher.js`](file:///d:/tools/Automatic%20Link%20Extractor%20-%20Chrome%20extension/assets/js/pattern_matcher.js) پیاده‌سازی شده و در تمامی محیط‌ها (`content.js`, `background.js`, `dashboard.html`) به اشتراک گذاشته شده است.

---

## ۳. معماری فنی و فضاهای اجرا (Execution Contexts)

```mermaid
flowchart TD
    subgraph Browser Context
        Page["صفحه وب (DOM)"]
        PM["pattern_matcher.js"]
        CS["content.js (Isolated World)"]
        WW["worker.js (Web Worker)"]
    end

    subgraph Extension Context
        SW["background.js (Service Worker)"]
        DB["dashboard.html (Extension Page)"]
        SUB["subdomains.js (Origins & Subdomains Extractor)"]
        Storage[("chrome.storage.local")]
    end

    Page -- "DOM Mutations & Elements" --> CS
    PM -.-> CS
    PM -.-> SW
    CS -- "Blob URL / postMessage({urls, base})" --> WW
    WW -- "Normalized Absolute URLs" --> CS
    CS -- "setBadge" --> SW
    CS -- "persist links" --> Storage
    SW -- "onClicked (تطابق الگو)" --> DB
    DB -- "خوانش و نگارش تنظیمات و لینک‌ها" --> Storage
    SUB -- "واکشی لینک‌ها و فیلتر گزینشی" --> Storage
```

| محیط / کامپوننت | فایل مربوطه | دسترسی به DOM؟ | دسترسی به API کروم؟ | وظیفه اصلی |
|---|---|:---:|:---:|---|
| **Service Worker** | `background.js` | ❌ خیر | ✅ بله (`chrome.*`) | لود `pattern_matcher.js` با `importScripts`، مدیریت کلیک، تشخیص الگوی منطبق با تب فعال و باز کردن داشبورد. |
| **Content Script** | `assets/js/pattern_matcher.js` + `content.js` | ✅ بله (Isolated) | ✅ بله (محدود به `storage`, `runtime`) | بررسی تطابق URL جاری با الگوهای وایلدکارد، نظارت بر DOM، ارسال کاندیدها به ورکر، ذخیره لینک‌ها در کلید مربوط به الگو. |
| **Web Worker** | `worker.js` | ❌ خیر | ❌ خیر (سندباکس ایزوله) | پردازش پس‌زمینه و موازی URLها، فیلتر اسکیماهای نامعتبر و نرمال‌سازی لینک‌ها. |
| **Extension Page** | `dashboard.html` + `assets/js/*` | ✅ بله (DOM داشبورد) | ✅ بله (دسترسی کامل) | رابط کاربری مدیریت الگوها، تنظیم حساسیت، مشاهده لینک‌ها با صفحه‌بندی امن، مودال خزنده JS و مودال استخراج ساب‌دامنه‌ها/مبدأها. |

---

## ۴. جریان داده و پایپ‌لاین‌های استخراج (Extraction Pipelines)

### ۴.۱. پایپ‌لاین اول: استخراج زنده از DOM (Pipeline A)

این فرآیند به شکل زنده در هر صفحه‌ای که آدرس آن با یکی از الگوهای ثبت شده منطبق باشد اجرا می‌شود:
1. در `document_start` نودهای زودهنگام با `earlyObserver` بافر می‌شوند.
2. با `findMatchingPatterns(origins, location.href)` الگوهای منطبق شناسایی می‌شوند.
3. در صورت انطباق، `worker.js` از طریق Blob URL ایجاد شده و DOM پویش می‌شود.
4. مقادیر اتریبیوت‌های لینک‌ساز (`href`, `src`, `srcset`, `action`, `formaction`, `data-*`, `poster`, ...) بافر و با دی‌بانس ۱۵۰ میلی‌ثانیه برای ورکر ارسال می‌شوند.
5. ورکر پیوندها را نرمال‌سازی کرده و لینک‌های یکتا و مطلق را به `content.js` پس می‌دهد.
6. لینک‌ها در زنجیره `persistChain` درون کلید الگوهای منطبق در `chrome.storage.local` ذخیره شده و Badge تب به‌روزرسانی می‌شود.

---

### ۴.۲. پایپ‌لاین دوم: خزنده فایل‌های جاوااسکریپت (Pipeline B)

1. کاربر روی **Extract links from JS files** کلیک می‌کند.
2. اسکریپت‌های استخراج‌شده برای آن الگو واکشی و در مودال لیست می‌شوند.
3. با کلیک روی **Crawl**، درخواست‌های `fetch` ارسال شده و پیوندها با رگکس‌های مطلق و نسبی استخراج می‌گردند.
4. مسیرهای نسبی نسبت به URL خود اسکریپت بازنشانی شده و با اعمال فیلترهای Regex کاربر و گزینه Decode URLs، به استوریج اضافه می‌شوند.

---

### ۴.۳. پایپ‌لاین سوم: استخراج مبدأها و ساب‌دامنه‌ها (Pipeline C - Origins & Subdomains)

این فرآیند با کلیک روی دکمه **Extract subdomains** اجرا می‌شود:

```mermaid
flowchart TD
    ClickSub["کلیک روی دکمه Extract subdomains"] --> GetPattern["دریافت Origin/Pattern جاری از آدرس"]
    GetPattern --> CalcRoot["محاسبه دامنه‌ی ریشه eTLD+1 با getRootDomain"]
    CalcRoot --> FetchLinks["خواندن تمامی لینک‌های استخراج‌شده از storage"]
    FetchLinks --> CheckFilter{"آیا تیک Only show TLD+1 subdomains فعال است؟"}
    CheckFilter -- "خیر (پیش‌فرض)" --> AllOrigins["استخراج تمام Originها و دامنه‌های کشف‌شده در لینک‌ها"]
    CheckFilter -- "بله" --> TldOnly["فیلتر کردن فقط ساب‌دامنه‌های متعلق به دامنه ریشه"]
    AllOrigins --> CheckProto{"آیا تیک Include protocol فعال است؟"}
    TldOnly --> CheckProto
    CheckProto -- "بله" --> FullOrigin["تبدیل به https://..."]
    CheckProto -- "خیر" --> HostnameOnly["نام دامنه‌ها/ساب‌دامنه‌ها"]
    FullOrigin --> RegexFilter["اعمال فیلترهای Regex درون‌حافظه‌ای (Include / Exclude)"]
    HostnameOnly --> RegexFilter
    RegexFilter --> DedupeSort["حذف موارد تکراری، مرتب‌سازی الفبایی"]
    DedupeSort --> OpenSubModal["نمایش در مودال + امکان کپی و بازخوانی سریع (Re-fetch)"]
```

#### قابلیت‌ها و گزینه‌های مودال:
1. **نمایش پیش‌فرض (Default):** نمایش تمام دامنه‌ها/Originهای کشف‌شده در کلیه لینک‌های صفحه بدون هیچ فیلتری (شامل دامنه‌های متفرقه، CDNها، APIهای خارجی و ...).
2. **چک‌باکس Only show TLD+1 subdomains:** در صورت فعال شدن، لیست بلافاصله فیلتر شده و تنها ساب‌دامنه‌هایی که به دامنه اصلی ریشه (eTLD+1) تعلق دارند نمایش داده می‌شوند (مثلاً برای `google.com` فقط ساب‌دامنه‌هایی چون `apis.google.com` و `mail.google.com` نمایش می‌یابند).
3. **فیلترهای عبارت باقاعده درون‌حافظه‌ای (Include & Exclude Regexes):** ایجاد پیل‌های ریجکس تعاملی با کلیک روی دکمه `+` دقیقا با همان استایل‌ها، کلاس‌ها و ساختار جاوااسکریپتی خزشگر فایل‌های JS (`contenteditable`، دکمه حذف `-`، و فرمت `/ pattern /g`). این فیلترها فقط روی خروجی فعال همان نشست اعمال می‌شوند و نیازی به ذخیره شدن در استوریج ندارند.
4. **چک‌باکس Include protocol:** امکان تغییر فرمت بین نام تمیز هاست (`sub.example.com`) و مبدأ کامل وب (`https://sub.example.com`).
5. **دکمه Re-fetch (⟳):** واکشی مجدد زنده از حافظه بدون بستن پنجره مودال برای دریافت لینک‌های جدیدی که به تازگی در پس‌زمینه توسط مانیتورینگ DOM ثبت شده‌اند.
6. **الگوریتم eTLD+1:** با پوشش پسوندهای چندبخشی اینترنتی (`MULTI_PART_TLDS`) از قبیل `.co.uk`, `.ac.ir`, `.com.tr`, `.org.uk` و ...

---

## ۵. ساختار داده در `chrome.storage.local`

فضای ذخیره‌سازی محلی افزونه شامل چهار کلید اصلی است:

### ۵.۱. `origins` (`string[]`)
آرایه‌ای از الگوها و دامنه‌های ثبت‌شده، شامل دامنه‌های دقیق یا عبارات وایلدکارد:
```json
[
  "https://*.google.com",
  "https://example.com/*",
  "http://localhost:3000"
]
```

### ۵.۲. `sensitivities` (`{ [pattern: string]: Object }`)
تنظیمات پرچم‌های `MutationObserver` به ازای هر الگو (به صورت پیش‌فرض با `1` ایجاد می‌شوند):
```json
{
  "https://*.google.com": {
    "childList": 1,
    "subtree": 1,
    "attributes": 1,
    "attributeOldValue": 1,
    "characterData": 1,
    "characterDataOldValue": 1
  }
}
```

### ۵.۳. `regexes` (`{ [pattern: string]: { includes: string[], excludes: string[] } }`)
الگوهای فیلتر شمول یا عدم شمول خزشگر فایل‌های JS به تفکیک هر الگو:
```json
{
  "https://*.google.com": {
    "includes": ["api", "YOUR_REGEX"],
    "excludes": ["node_modules", "YOUR_REGEX"]
  }
}
```

### ۵.۴. `links` (`{ [pattern: string]: string[] }`)
مجموعه لینک‌های یکتای استخراج‌شده برای آن الگو (مثلاً برای `https://*.google.com` شامل لینک‌های جمع‌آوری‌شده از `google.com` و تمامی ساب‌دامنه‌ها):
```json
{
  "https://*.google.com": [
    "https://google.com/",
    "https://mail.google.com/mail/u/0/",
    "https://drive.google.com/drive/my-drive"
  ]
}
```

---

## ۶. بررسی تفکیکی فایل‌های پروژه

### `assets/js/settings.js`
- مدیریت پنجره مودال تنظیمات استخراج (`#settingsModal`):
  - باز شدن با کلیک روی دکمه `#open_settings` (دارای آیکون SVG چرخ‌دنده).
  - مدیریت اینپوت‌های ریجکس Include و Exclude جهت تعیین شروط پذیرش لینک‌های زنده در حین وب‌گردی.
  - ذخیره‌سازی خودکار در کلید `extraction_rules` در `chrome.storage.local`.
  - مقداردهی اولیه هنگام افزودن تارگت در `addorigin.js` و پاک‌سازی کامل هنگام حذف تارگت.

### `assets/js/subdomains.js`
- مدیریت استخراج Origins و Subdomains:
  - مجموعه `MULTI_PART_TLDS`: پوشش پسوندهای چندبخشی.
  - `extractHostnameFromPattern(pattern)`: استخراج نام هاست از الگو.
  - `getRootDomain(hostname)`: محاسبه دامنه ریشه eTLD+1.
  - `extractOriginsOrSubdomains(links, rootDomain, { onlyTld, includeProtocol, includes, excludes })`: استخراج گزینشی بر اساس چک‌باکس‌ها و فیلترهای Regex درون‌حافظه‌ای.
  - پیاده‌سازی اینپوت‌های پیل‌مانند Regex مشابه `modal.js` با دکمه `+` و دکمه `-` و اعمال بلادرنگ در زمان `keyup`.
  - دکمه کپی بالای کادر متنی (`#copySubdomainsBtn`).

### `assets/js/custom_links.js`
- مدیریت افزودن دستی پیوندها به تارگت فعلی:
  - باز کردن پنجره مودال اختصاصی `#addLinksModal` با کلیک روی دکمه `+` در کنار عنوان لینک‌های استخراج‌شده.
  - دریافت ورودی چندخطی از textarea، پاک‌سازی فضاهای خالی و خطوط تهی، شمارش زنده تعداد لینک‌ها.
  - ادغام امن با لینک‌های قبلی در `chrome.storage.local` با حذف موارد تکراری (`Set`) و رفرش خودکار داشبورد.

### `assets/js/pattern_matcher.js`
- ماژول متمرکز و مستقل برای تطابق الگوها و وایلدکاردها.
- توابع کلیدی: `escapeRegex`، `patternToRegex`، `matchPattern` و `findMatchingPatterns`.

### `manifest.json`
- تعریف استاندارد **Manifest V3**.
- اضافه شدن `pattern_matcher.js` به عنوان اسکریپت پیش‌نیاز در `content_scripts`.
- دسترسی به میزبان: `<all_urls>`.

### `background.js` (Service Worker)
- بارگذاری `pattern_matcher.js` با استفاده از `importScripts`.
- در زمان کلیک کاربر روی آیکون، آدرس تب فعال (`tab.url`) را با الگوهای ثبت‌شده تطبیق داده و در صورت انطباق، مستقیماً داشبورد مربوط به همان الگو را باز یا فوکوس می‌کند.

### `content.js` (Content Script)
- اجرای زودهنگام در `document_start`.
- پایش و استخراج بلادرنگ کلیه درخواست‌های شبکه (Network / Resource Timing) از طریق `PerformanceObserver` و `performance.getEntriesByType("resource")` برای شکار درخواست‌های پس‌زمینه (Fetch, XHR, Beacon, Dynamic Assets) در فریم اصلی و آی‌فریم‌های هم‌مبدأ.
- استفاده از `findMatchingPatterns(arr, location.href)` برای تشخیص فعال بودن پایش در صفحه جاری.
- ادغام لینک‌های جدید در بانک لینک‌های تمامی الگوهای منطبق در `persist(links)`.

### `assets/js/dash_checker.js`
- استفاده از `URLSearchParams`؛ پشتیبانی کامل و بدون خطا از کاراکترهای وایلدکارد و پارامترهای مختلف.

### `assets/js/addorigin.js`
- افزودن الگوها با انکود امن URL (`encodeURIComponent`).
- مقداردهی اولیه `sensitivities`، `regexes`، `extraction_rules` و `links`.
- نمایش دیالوگ تأیید (`confirm()`) قبل از حذف مبدأ در دکمه `.removeLogBtn`.
- پاک‌سازی کامل تمام کلیدهای وابسته (`origins`, `sensitivities`, `regexes`, `extraction_rules`, `links`) به همراه پوشش واریانت‌های مختلف در هنگام حذف یک الگو.

### `assets/js/dashboard.js`
- حل مشکل کرش صفحه در زمان خالی بودن لینک‌ها (گارد روی `page_count > 0`).
- رفع باگ دکمه ضربدر حذف تکی لینک با پیاده‌سازی تابع اختصاصی `remove_link_from_origin`.
- پیاده‌سازی جستجوی زنده (Live Search) از طریق فیلد ورودی `#searchLinksInput`:
  - فیلتر آنی لینک‌ها هنگام تایپ (`input`).
  - محاسبه مجدد و بلادرنگ صفحه‌بندی (Pagination) روی نتایج فیلترشده.
  - تعویض صفحات به صورت کاملاً داینامیک و درجا در DOM (بدون رفرش صفحه) همراه با همگام‌سازی پارامترهای `page` و `q` در URL با `history.replaceState`.
- نمایش تعداد کل لینک‌های استخراج‌شده و تعداد لینک‌های منطبق با جستجو در هدر داشبورد.

### `assets/js/helpers.js`
- شامل توابع کمکی مشترک: `getQueryParam` و `copyToClipboard`.
- پاک‌سازی تمام لینک‌های مبدأ با `#removeAllBtn`.
- عملکرد هوشمند دکمه `#copy_all`:
  - کپی تمام لینک‌های تارگت در حالت عادی.
  - در صورت فعال بودن جستجو در `#searchLinksInput`، منحصراً نتایج منطبق با فیلتر جستجو در کلیپ‌بورد کپی می‌شوند.

### `dashboard.html`
- چیدمان مدرن و بهینه‌سازی‌شده دکمه‌ها و ابزارها:
  - دکمه قرمز و جمع‌وجور **Remove All** (`#removeAllBtn`) به همراه دکمه سبز `+` (`#openAddLinksModalBtn`) در کنار هدر `🔍 Extracted Links` قرار گرفته‌اند.
  - پیوند کلیک‌پذیر راست‌چین **Copy all to clipboard** (`#copy_all`) بلافاصله در زیر فهرست لینک‌ها قرار داده شده است.
  - دکمه‌های اصلی ابزارها شامل **Extract links from JS files**، **Extract subdomains** و دکمه جدید **Settings** (`#open_settings` با آیکون چرخ‌دنده) در کانتینر پایینی (`.buttons_container`) قرار دارند.
  - بهبود ساختار هدر بخش مبدأها با نشانگر تعداد کل Originها (`#originCountBadge`) و یادداشت راهنمای وایلدکاردها در زیر کادر ورودی.
- پنجره‌های مودال اختصاصی: مودال خزشگر جاوااسکریپت (`#myModal`)، مودال ساب‌دامنه‌ها (`#subdomainModal`)، مودال ورود دستی لینک‌ها (`#addLinksModal`) و مودال تنظیمات استخراج (`#settingsModal`).
- فیلد جستجوی بلادرنگ `#searchLinksInput`.
- لود اسکریپت‌های ماژولار: `pattern_matcher.js`، `dashboard.js`، `sensitivities.js`، `modal.js`، `subdomains.js`، `custom_links.js` و `settings.js`.

### `assets/styles/style.css` و `assets/styles/modal.css`
- استایل‌دهی بنفش به دکمه `#extract_subdomains` و اعمال استایل دکمه‌های کپی و کادر textarea مودال.
- استایل دکمه سبز رنگ `+` (`#openAddLinksModalBtn`) و کادر ورودی سفید رنگ لینک‌های دستی (`#customLinksInput`).

---

## ۷. آخرین تغییرات اعمال شده در پروژه (Git History)

1. **بهبود بصری بخش Originها و افزودن نشانگرهای آماری (`dashboard.html`, `addorigin.js`, `style.css`):**
   - نمایش نشان تعداد لینک‌های کشف‌شده برای هر مبدأ (`origin-link-count`) در کنار دکمه حذف `.removeLogBtn`.
   - نمایش شمارنده کل Originهای ثبت‌شده در هدر (`originCountBadge` در کنار `🔍 Origin List`).
   - تبدیل توضیحات طولانی placeholder ورودی مبدأ به یک یادداشت راهنما (`origin-input-note`) در زیر اینپوت با پشتیبانی از کدهای نمونه الگوهای وایلدکارد.
   - اضافه شدن حالت پیش‌نمایش خالی (Empty state) برای زمانی که هنوز هیچ مبدأیی ثبت نشده است.
   - بهینه‌سازی استایل‌های CSS و محدودسازی عرض لینک مبدأ جهت جلوگیری از به‌هم‌ریختگی چیدمان در نام‌های طولانی.
2. **افزودن دیالوگ تأیید (Confirm) و پاک‌سازی کامل داده‌ها در حذف Origin (`2522d28`):**
   - نمایش پیام تأیید `confirm()` پیش از اقدام به حذف Origin در دکمه‌های `.removeLogBtn` جهت پیشگیری از حذف تصادفی.
   - حذف همه‌جانبه تمام داده‌های ذخیره‌شده مرتبط با مبدأ/الگو از استوریج (`links`، `regexes`، `extraction_rules`، `sensitivities`) به همراه پوشش کلیه واریانت‌های ممکن (با و بدون اسلش پایانی، کدگذاری URL و trim).
   - توقف انتشار رویداد با `stopPropagation` و هدایت صحیح کاربر به ریشه داشبورد در صورت باز بودن تب تارگت حذف‌شده.
2. **حذف پرمیشن بلااستفاده `scripting` از مانیفست (`6f3dfd5`):**
   - حذف مجوز غیرضروری `"scripting"` از آرایه `permissions` در `manifest.json`.
   - پیروی از اصل حداقل دسترسی (Least Privilege) و برطرف کردن هشدارهای غیرضروری مجوزها در مرورگر.
2. **حذف کد مرده در پیام‌رسانی `content.js` (`3d06a0f`):**
   - حذف دستور `window.postMessage({ action: "continue", url: location.href })` پس از ذخیره لینک‌ها در `chrome.storage.local`.
   - پاک‌سازی سربار پیام‌رسانی زاید و جلوگیری از انتشار داده‌های افزونه به شیء سراسری `window` صفحه وب.
2. **امن‌سازی تزریق DOM و پیشگیری از XSS در لیست فایل‌های JS (`f8bea4b`):**
   - جایگزینی ساخت رشته‌ای HTML از طریق `innerHTML` با ایجاد امن گره‌های DOM (`document.createElement`، `setAttribute` و `textContent`).
   - تنظیم امن ویژگی‌های `title`، `href` و اضافه کردن `rel="noopener noreferrer"` به پیوند باز کردن فایل‌ها.
   - جایگزینی `innerHTML` با `textContent` در نمایش فایل جاری (`current_file`) و مقادیر ریجکس جهت جلوگیری از هرگونه تزریق یا پارس ناخواسته تگ‌های HTML.
3. **رفع باگ ورودی نامعتبر Regex در خزشگر فایل‌های جاوااسکریپت (`57dc6cc`):**
   - افزودن تابع کمکی `getRegexList` جهت واکشی و فیلتر کردن مقادیر بدون خطا و بدون وابستگی به متن‌های خالی یا ناقص.
   - پوشش‌دهی کامل دستورات `new RegExp(pattern, 'i').test(...)` درون بلاک `try / catch` در فیلترهای Include و Exclude.
   - جلوگیری از توقف و شکست Promise خزش فایل‌های JS در صورت وارد کردن کاراکترها یا الگوهای نامعتبر ریجکس (مانند براکت باز `[a-z` یا بک‌اسلش انتها `\`).
   - لود ایمن و تدافعی ریجکس‌ها از `chrome.storage.local` با در نظر گرفتن مقادیر پیش‌فرض مناسب.
   - همگام‌سازی ذخیره‌سازی در `chrome.storage.local` هنگام حذف داینامیک تگ‌های ریجکس جدید.
3. **پیاده‌سازی پنجره مودال Extraction Settings و بهینه‌سازی چیدمان UI (`c060a60`):**
   - بازآرایی و چیدمان بهینه دکمه‌ها در داشبورد: انتقال دکمه Remove All به کنار هدر لینک‌ها، قرارگیری پیوند راست‌چین Copy All در زیر جدول لینک‌ها و تجمیع دکمه‌های اکشن اصلی (JS Crawler, Subdomains, Settings) در پنل پایین.
   - ایجاد دکمه **Settings** با آیکون اختصاصی وکتور SVG در پنل ابزارهای داشبورد.
   - پیاده‌سازی مودال `#settingsModal` با استایل یکپارچه مودال ساب‌دامنه‌ها.
   - اضافه شدن فیلترهای زنده **Extraction include regexes** و **Extraction exclude regexes** با ذخیره‌سازی خودکار در `chrome.storage.local.extraction_rules`.
   - اعمال بلادرنگ فیلترهای ریجکس در `content.js` پیش از ذخیره لینک‌های زنده در دیتابیس.
   - مدیریت چرخه حیات تنظیمات در `addorigin.js` (مقداردهی در زمان افزودن تارگت و پاک‌سازی کامل در زمان حذف).
2. **پایش و استخراج هوشمند درخواست‌های شبکه با Resource Timing (`7b1b37a`):**
   - فعال‌سازی `PerformanceObserver` و متد `performance.getEntriesByType("resource")` در `content.js`.
   - شکار خودکار تمام درخواست‌های Fetch, XHR، فایل‌های داینامیک و ترافیک لود شده در پس‌زمینه بدون نیاز به وجود لینک در DOM.
2. **طراحی و بازنویسی جامع و حرفه‌ای فایل `README.md` (`791dd57`):**
   - ایجاد مستند انگلیسی زیبا، مدرن و کامل شامل نشان‌های اختصاصی (Badges)، جدول قابلیت‌ها، دیاگرام جریان معماری با Mermaid، راهنمای گام‌به‌گام نصب و استفاده، ساختار درختی فایل‌ها و نمایش اسکرین‌شات‌ها.
2. **افزودن امکان جستجو با صفحه‌بندی و کپی هوشمند نتایج جستجو (`d00c886`):**
   - قرار دادن فیلد ورودی `#searchLinksInput` در زیر هدر لینک‌ها.
   - اعمال بلادرنگ جستجو روی لینک‌های تارگت و تطبیق داینامیک پیجینیشن با تعداد نتایج بدون رفرش صفحه.
   - به‌روزرسانی عملکرد دکمه `Copy all to clipboard` (`#copy_all`) جهت ذخیره انحصاری نتایج جستجو در کلیپ‌بورد زمانی که کادر جستجو پر است.
2. **افزودن امکان ورود دستی لینک‌ها به تارگت فعلی (`3f075cd` و `b9c10ea`):**
   - قرار دادن دکمه سبز رنگ `+` در کنار هدر `🔍 Extracted Links`.
   - ایجاد پنجره مودال اختصاصی `#addLinksModal` با استایل یکسان با مودال Subdomains.
   - امکان وارد کردن لینک‌ها در textarea و اضافه کردن آن‌ها به بانک لینک‌های تارگت در `chrome.storage.local` با حفظ یکتایی (Deduplication).
3. **پاک‌سازی و بهینه‌سازی دکمه‌ها و استایل‌های اضافی مودال Subdomains (`dae3e04`):**
   - حذف دکمه‌های تکراری پایین مودال Subdomains و پاک‌سازی کدهای مرتبط.
3. **بهینه‌سازی و ساده‌سازی ساختار مودال Subdomains (`b4899ab`):**
   - پیاده‌سازی اینپوت‌های اضافه کردن رگکس با استایل و کدهای مشابه `modal.js` برای بخش‌های Include و Exclude.
   - اعمال مستقیم و بلادرنگ روی نتایج بدون نیاز به ذخیره‌سازی در دیتابیس استوریج.
3. **ارتقای پنجره مودال استخراج Origins و Subdomains (`a52789d`):**
   - به صورت پیش‌فرض تمام Originها/دامنه‌های پیدا شده در لینک‌ها نمایش داده می‌شوند.
   - اضافه شدن چک‌باکس گزینشی `only-tld-subdomains` جهت محدود کردن خروجی به ساب‌دامنه‌های eTLD+1 دامنه ریشه.
   - اضافه شدن چک‌باکس `include-protocol` جهت سوئیچ بین نام دامنه و Origin کامل.
   - اضافه شدن دکمه **Re-fetch** (`#refetchSubdomainsBtn`) برای واکشی دوباره و زنده بدون نیاز به بستن مودال.
3. **پشتیبانی کامل از Wildcard Patterns (`a1e609a`):**
   - افزودن امکان ثبت الگوهایی مانند `https://*.google.com` و `https://google.com/*`.
   - ایجاد ماژول مستقل `assets/js/pattern_matcher.js`.
4. **رفع باگ‌ها و ارتقای پایداری داشبورد:**
   - رفع باگ دکمه حذف تکی لینک در `dashboard.js`.
   - رفع خطای کرش صفحه‌بندی در زمان صفر بودن تعداد لینک‌ها.
   - ارتقای `dash_checker.js` به استفاده از `URLSearchParams`.
   - پاک‌سازی کامل اطلاعات یتیم در زمان حذف مبدأ.

---

## ۸. باگ‌ها، رفتارهای غیرمنتظره و نکات فنی قابل بهبود (Known Issues)

1. ✅ **برطرف‌شده: محافظت در برابر خطای ورودی نامعتبر Regex در مودال خزش (`modal.js`):**
   فراخوانی‌های `new RegExp(pattern, 'i').test(...)` در هر دو فیلتر Include و Exclude با ساختار `try / catch` محافظت شدند؛ بنابراین در صورت وارد کردن الگوی ناقص یا نامعتبر توسط کاربر، خطای `SyntaxError` مدیریت شده و خزش با موفقیت برای سایر لینک‌ها ادامه می‌یابد.
2. ✅ **برطرف‌شده: امنیت تزریق DOM در لیست فایل‌های JS (`modal.js`):**
   اینترپولیشن مستقیم متغیرها در `innerHTML` حذف شد و ساخت عناصر با متدهای امن DOM نظیر `createElement`، `setAttribute` و `textContent` جایگزین گردید. همچنین برای نمایش نشانی فایل جاری و مقادیر ریجکس‌ها نیز از `textContent` استفاده شد تا از هرگونه آسیب‌پذیری احتمالی DOM-based XSS پیشگیری شود.
3. ✅ **برطرف‌شده: کد مرده (Dead Code) در پیام‌رسانی (`content.js`):**
   خط بلااستفاده `window.postMessage({ action: "continue", ... })` حذف شد و از ارسال پیام‌های زاید به صفحه میزبان و آلودگی شیء سراسری پنجره جلوگیری گردید.
4. ✅ **برطرف‌شده: حذف مجوز بلااستفاده `scripting` در مانیفست (`manifest.json`):**
   مجوز غیرضروری `scripting` که در هیچ‌کجای پروژه مورد استفاده نبود از `manifest.json` حذف شد تا افزونه تنها با حداقل پرمیشن‌های مورد نیاز (`storage` و `tabs`) کار کند و هشدارهای امنیتی نصب کاهش یابد.
5. ⚠️ **محدودیت احتمالی CSP برای Blob Worker در برخی سایت‌ها:**
   برخی از سایت‌ها با فعال‌سازی هدر سخت‌گیرانه `Content-Security-Policy` با مقدار `worker-src 'none'` ممکن است مانع ساخت Web Worker از طریق Blob URL در `content.js` شوند.

---

## ۹. راهنمای بارگذاری، توسعه و تست

1. مرورگر گوگل کروم را باز کرده و به نشانی `chrome://extensions/` بروید.
2. گزینه **Developer mode** را در بالا سمت راست فعال کنید.
3. دکمه **Load unpacked** را زده و پوشه ریشه این پروژه را انتخاب نمایید.
4. پس از اعمال هرگونه تغییر در کدهای پروژه:
   - در صورت تغییر `background.js`، `manifest.json`، `pattern_matcher.js` یا `content.js`: دکمه **Reload (آیکون چرخش)** کارت افزونه را در صفحه Extensions کلیک کنید و تب تست را رفرش نمایید.
   - در صورت تغییر در فایل‌های داشبورد (`dashboard.html`, `assets/js/*`, `assets/styles/*`): کافیست تب داشبورد را در مرورگر Refresh نمایید.
5. برای تست سریع صحت نحوی کدها در محیط ترمینال می‌توانید دستور زیر را اجرا کنید:
   ```powershell
   node --check background.js content.js worker.js assets/js/pattern_matcher.js assets/js/addorigin.js assets/js/dashboard.js assets/js/dash_checker.js assets/js/helpers.js assets/js/modal.js assets/js/sensitivities.js assets/js/subdomains.js
   ```

---

## ۱۰. تعهد به‌روزرسانی مستندات

> **قانون طلایی پروژه:** با درخواست هرگونه تغییر در عملکرد، فایل‌ها، منطق استخراج، رفع باگ‌ها یا افزودن فیچرهای جدید، **این فایل (`PROJECT_DOCUMENTATION.md`) باید همگام با تغییرات کد به‌روزرسانی شود** تا همواره آخرین وضعیت پروژه را به صورت مستند و قابل رجوع منعکس کند.
