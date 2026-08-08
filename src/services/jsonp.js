// Generic JSONP loader.
//
// Some external services used by Land Master (the Census Geocoder, and the
// ArcGIS "callback" fallback for TIGERweb/FEMA) do not send CORS headers,
// so a browser fetch() cannot read their responses. JSONP works around
// this by injecting a <script> tag whose URL asks the server to wrap its
// JSON payload in a call to a uniquely-named global callback function.
// This keeps the whole app static/client-only — no proxy is involved.
let counter = 0;

function nextCallbackName() {
  counter += 1;
  return `landMasterJsonp_${Date.now()}_${counter}`;
}

/**
 * Fetch `url` via JSONP.
 * @param {string} url - Base URL, without the callback parameter.
 * @param {object} [options]
 * @param {string} [options.callbackParam='callback'] - Query param name the server expects.
 * @param {number} [options.timeoutMs=12000] - Time to wait before rejecting.
 * @returns {Promise<any>} Resolves with the JSON payload passed to the callback.
 */
export function jsonp(url, { callbackParam = 'callback', timeoutMs = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = nextCallbackName();
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`JSONP request timed out: ${url}`));
    }, timeoutMs);

    window[callbackName] = (data) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`JSONP request failed to load: ${url}`));
    };

    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}${callbackParam}=${callbackName}`;
    script.async = true;
    document.head.appendChild(script);
  });
}
