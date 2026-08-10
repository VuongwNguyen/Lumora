(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LumoraActivityApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  // Capture the native fetch before a future global tracked-fetch wrapper is
  // installed. Activity transport must never recursively track itself.
  const nativeFetch = typeof root.fetch === 'function' ? root.fetch.bind(root) : null;

  function readToken() {
    try {
      return root.localStorage ? root.localStorage.getItem('token') : null;
    } catch {
      return null;
    }
  }

  async function parseResponse(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function send(body, options) {
    options = options || {};
    if (!nativeFetch) throw new Error('Fetch API is unavailable');

    const headers = { 'Content-Type': 'application/json' };
    const token = readToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    const controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    const timeoutId = controller && typeof root.setTimeout === 'function'
      ? root.setTimeout(function () { controller.abort(); }, 10000)
      : null;

    try {
      const response = await nativeFetch('/activity/add', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        keepalive: options.keepalive === true,
        signal: controller ? controller.signal : undefined,
      });
      const data = await parseResponse(response);
      if (!response.ok || (data && data.ok === false)) {
        const error = new Error((data && data.error) || ('Activity API ' + response.status));
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } finally {
      if (timeoutId != null && typeof root.clearTimeout === 'function') root.clearTimeout(timeoutId);
    }
  }

  return { send: send };
});
