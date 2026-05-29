import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import store from './store';
import { ThemeContextProvider } from './contexts/ThemeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeContextProvider>
        <App />
      </ThemeContextProvider>
    </Provider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Service worker — production only. The SW caches static assets cache-first
// and HTML network-first; API calls are never cached. See
// crm-frontend/public/service-worker.js. In dev we'd fight the CRA HMR.
//
// SW_VERSION is appended as a query string on the registration URL so any
// CDN cache (HCDN/Cloudflare/etc.) treats each deploy as a fresh resource
// — defends against the trap we hit on 2026-05-29 where Hostinger's CDN
// cached the SW file with `max-age=31536000, immutable` for hours after
// the new build went out. Bump this string on every deploy; the build
// script could derive it from the git SHA later.
const SW_VERSION = '20260529-1';

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Unregister any SW registered under the old URL (no version query
      // string), otherwise it'd live on alongside the new one and might
      // intercept fetches before the new SW activates.
      const existing = await navigator.serviceWorker.getRegistrations();
      const newScriptURL = new URL(
        `/service-worker.js?v=${SW_VERSION}`,
        window.location.origin
      ).href;
      for (const reg of existing) {
        const active = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
        if (active && active !== newScriptURL) {
          await reg.unregister();
        }
      }
      await navigator.serviceWorker.register(`/service-worker.js?v=${SW_VERSION}`);
    } catch (err) {
      console.warn('SW registration failed:', err);
    }
  });
}
