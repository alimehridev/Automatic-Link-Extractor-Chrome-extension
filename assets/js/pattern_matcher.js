/**
 * Pattern Matcher for Automatic Link Extractor
 * Supports exact origins, subdomain wildcards (e.g. https://*.google.com),
 * and path wildcards (e.g. https://google.com/*, https://google.com/search/*).
 */

function escapeRegex(str) {
  return str.replace(/[.+?^${}()|[\]\\\/]/g, '\\$&');
}

/**
 * Converts a wildcard pattern into a RegExp matching complete URLs.
 *
 * Examples:
 * - https://*.google.com -> matches google.com and any subdomain (*.google.com)
 * - https://google.com/* -> matches anything starting with https://google.com/
 * - https://google.com/search/* -> matches paths under /search
 * - http://localhost:3000 -> matches http://localhost:3000
 */
function patternToRegex(pattern) {
  if (!pattern || typeof pattern !== 'string') return null;
  let p = pattern.trim();
  if (!p) return null;

  // 1. Protocol part
  let protocolPart = '';
  let rest = p;
  if (p.includes('://')) {
    const parts = p.split('://');
    protocolPart = parts[0];
    rest = parts.slice(1).join('://');
  }

  // 2. Separate host and path
  let hostPart = '';
  let pathPart = '';
  const firstSlash = rest.indexOf('/');
  if (firstSlash !== -1) {
    hostPart = rest.slice(0, firstSlash);
    pathPart = rest.slice(firstSlash);
  } else {
    hostPart = rest;
    pathPart = '';
  }

  // 3. Protocol regex
  let protoRegex = '';
  if (!protocolPart || protocolPart === '*') {
    protoRegex = 'https?:\\/\\/';
  } else if (protocolPart === 'http*') {
    protoRegex = 'https?:\\/\\/';
  } else {
    protoRegex = escapeRegex(protocolPart).replace(/\*/g, '.*') + ':\\/\\/';
  }

  // 4. Host & port regex
  let hostRegex = '';
  let portRegex = '';
  let hostWithoutPort = hostPart;
  const colonIdx = hostPart.indexOf(':');
  if (colonIdx !== -1) {
    hostWithoutPort = hostPart.slice(0, colonIdx);
    const portPart = hostPart.slice(colonIdx + 1);
    if (portPart === '*') {
      portRegex = '(?::\\d+)?';
    } else {
      portRegex = ':' + escapeRegex(portPart).replace(/\*/g, '\\d*');
    }
  } else {
    portRegex = '(?::\\d+)?';
  }

  if (hostWithoutPort.startsWith('*.')) {
    // Matches root domain as well as any subdomain:
    // e.g. *.google.com matches google.com, mail.google.com, sub.mail.google.com
    const rootDomain = hostWithoutPort.slice(2);
    const escapedRoot = escapeRegex(rootDomain).replace(/\*/g, '[^.:/]+');
    hostRegex = '(?:[^/:]+\\.)?' + escapedRoot;
  } else if (hostWithoutPort.includes('*')) {
    hostRegex = escapeRegex(hostWithoutPort).replace(/\*/g, '[^/:]*');
  } else {
    hostRegex = escapeRegex(hostWithoutPort);
  }

  // 5. Path regex
  let pathRegex = '';
  if (!pathPart || pathPart === '/*' || pathPart === '/') {
    pathRegex = '(?:[/?#].*)?$';
  } else if (pathPart.endsWith('/*')) {
    const base = pathPart.slice(0, -2);
    pathRegex = '(?:' + escapeRegex(base) + ')(?:[/?#].*)?$';
  } else if (pathPart.includes('*')) {
    pathRegex = escapeRegex(pathPart).replace(/\*/g, '.*') + '$';
  } else {
    pathRegex = '(?:' + escapeRegex(pathPart) + ')(?:[/?#].*)?$';
  }

  return new RegExp('^' + protoRegex + hostRegex + portRegex + pathRegex, 'i');
}

/**
 * Checks whether a given URL matches a pattern.
 */
function matchPattern(pattern, url) {
  if (!pattern || !url) return false;
  if (pattern === url) return true;
  try {
    const re = patternToRegex(pattern);
    return re ? re.test(url) : false;
  } catch (e) {
    return false;
  }
}

/**
 * Finds all patterns in an array that match a given URL.
 */
function findMatchingPatterns(patterns, url) {
  if (!Array.isArray(patterns) || !url) return [];
  return patterns.filter(p => matchPattern(p, url));
}

// Export for Node.js / CommonJS environments if tested outside browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeRegex,
    patternToRegex,
    matchPattern,
    findMatchingPatterns
  };
}

