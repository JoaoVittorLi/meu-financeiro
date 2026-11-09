/* Shared presentation preference. No financial data or network access. */
(function () {
  'use strict';
  const key = 'mf-appearance-v1';
  const valid = value => ['light', 'dark', 'system'].includes(value);
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch (_) {}
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.querySelectorAll('[data-appearance]').forEach(control => {
      if (control.tagName === 'SELECT') control.value = preference;
      else control.setAttribute('aria-pressed', String(control.dataset.appearance === preference));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#141414' : '#f4f4f6');
  }
  window.MFAppearance = Object.freeze({
    get: () => preference,
    set(value) {
      if (!valid(value)) return;
      preference = value;
      try { localStorage.setItem(key, preference); } catch (_) {}
      apply();
    }
  });
  media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
