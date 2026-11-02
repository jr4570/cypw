/**
 * Global API Fetch Interceptor & Resilience Guard
 * Prevents HTML 404/200 SPA page hijacking of /api/* calls on static hosts
 * like Cloudflare Pages, Netlify, and GitHub Pages.
 * Completely eliminates Safari/WebKit DOMException: "The string did not match the expected pattern."
 */

import { handleMockApiRequest } from './mockServer';

declare global {
  interface Window {
    __originalFetch?: typeof window.fetch;
    __apiInterceptorInstalled?: boolean;
  }
}

/**
 * Robust API fetch handler that calls the backend first,
 * and gracefully falls back to the client-side mock engine if
 * the host responds with HTML (e.g. Cloudflare Pages / Netlify SPA fallback) or fails.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlString = typeof input === 'string' 
    ? input 
    : (input instanceof URL ? input.toString() : (input as Request).url);

  const nativeFetch = (typeof window !== 'undefined' && window.__originalFetch) || 
                      (typeof fetch !== 'undefined' ? fetch : null);

  const isApiRequest = urlString.startsWith('/api/') || 
                       urlString.startsWith('api/') || 
                       (urlString.includes('://') && new URL(urlString, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').pathname.startsWith('/api/'));

  if (!isApiRequest || !nativeFetch) {
    return nativeFetch ? nativeFetch(input, init) : new Response(null, { status: 404 });
  }

  const isCsv = urlString.includes('export-csv');

  try {
    const response = await nativeFetch(input, init);
    const backendHeader = response.headers.get('X-StarPass-Backend');
    const contentType = response.headers.get('content-type') || '';

    // Only use network response directly if it came from the stateful Node.js Express server
    if (
      backendHeader === 'express-server' &&
      (contentType.includes('application/json') || (isCsv && contentType.includes('text/csv')))
    ) {
      return response;
    }

    // For Cloudflare Pages, Netlify, static hosts, or edge stubs, use the stateful client engine
    const mockResult = await handleMockApiRequest(urlString, init);
    const isStringBody = typeof mockResult.body === 'string';
    const responseBody = isStringBody ? mockResult.body : JSON.stringify(mockResult.body);
    const mimeType = isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';

    return new Response(responseBody, {
      status: mockResult.status,
      headers: {
        'Content-Type': mimeType,
        'X-StarPass-Engine': 'Client-Stateful-Engine'
      }
    });
  } catch (_err) {
    // Network failure (offline / server unreachable)
    const mockResult = await handleMockApiRequest(urlString, init);
    const isStringBody = typeof mockResult.body === 'string';
    const responseBody = isStringBody ? mockResult.body : JSON.stringify(mockResult.body);
    const mimeType = isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';

    return new Response(responseBody, {
      status: mockResult.status,
      headers: {
        'Content-Type': mimeType,
        'X-StarPass-Engine': 'Client-Stateful-Engine'
      }
    });
  }
}

/**
 * Safely installs interceptor without throwing if window.fetch is readonly
 */
export function installApiInterceptor() {
  if (typeof window === 'undefined' || window.__apiInterceptorInstalled) {
    return;
  }

  try {
    if (typeof window.fetch === 'function') {
      window.__originalFetch = window.fetch.bind(window);
      
      try {
        // Attempt defining property with Object.defineProperty (handles some environments)
        Object.defineProperty(window, 'fetch', {
          value: apiFetch,
          writable: true,
          configurable: true
        });
        window.__apiInterceptorInstalled = true;
      } catch (_e) {
        // If window.fetch is strictly readonly in iframe / WebKit, ignore gracefully
        console.warn("[StarPass Resilience] window.fetch is readonly in this environment, using apiFetch directly.");
      }
    }
  } catch (err) {
    console.warn("[StarPass Resilience] Could not patch global fetch:", err);
  }
}
