
self.onmessage = function(content) {
    let html = content.data

    const hrefRegex = /<a\s+[^>]*href=(["'])(.*?)\1/gi;
    let links = [];
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const srcRegex = /<\w+\s+[^>]*src=(["'])(.*?)\1/gi;
    while ((match = srcRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const actionRegex = /<form\s+[^>]*action=(["'])(.*?)\1/gi;
    while ((match = actionRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const formactionRegex = /<(?:button|input)\s+[^>]*formaction=(["'])(.*?)\1/gi;
    while ((match = formactionRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const dataUrlRegex = /<\w+\s+[^>]*data-url=(["'])(.*?)\1/gi;
    while ((match = dataUrlRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const dataHrefRegex = /<\w+\s+[^>]*data-href=(["'])(.*?)\1/gi;
    while ((match = dataHrefRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const posterRegex = /<video\s+[^>]*poster=(["'])(.*?)\1/gi;
    while ((match = posterRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const citeRegex = /<(blockquote|q|del|ins)\s+[^>]*cite=(["'])(.*?)\2/gi;
    while ((match = citeRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const dataSrcRegex = /<\w+\s+[^>]*data-src=(["'])(.*?)\1/gi;
    while ((match = dataSrcRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const backgroundRegex = /<(body|table)\s+[^>]*background=(["'])(.*?)\2/gi;
    while ((match = backgroundRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const profileRegex = /<head\s+[^>]*profile=(["'])(.*?)\1/gi;
    while ((match = profileRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const manifestRegex = /<html\s+[^>]*manifest=(["'])(.*?)\1/gi;
    while ((match = manifestRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    const longdescRegex = /<(img|iframe)\s+[^>]*longdesc=(["'])(.*?)\2/gi;
    while ((match = longdescRegex.exec(html)) !== null) {
        links.push(match[2]);
    }

    links = links.filter(l => !l.startsWith("data:image"))

    const finalLinks = links.map(link => {
        if (link.startsWith('/') && !link.startsWith('//')) {
            return location.origin + link;
        }
        if (link.startsWith('//')) {
            return "https:" + link;
        }
        return link;
    });
    // حذف تکراری‌ها
    const uniqueLinks = [...new Set(finalLinks)];
    postMessage(uniqueLinks)
};