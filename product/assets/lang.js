/*!
 * LogFizz language switcher
 * Language is determined from the URL path: /de/... → German, everything else → English.
 * Switching language updates the URL via history.pushState (adds/removes the /de prefix)
 * and rewrites all same-site <a> links on the page to keep the current language.
 *
 * Inline detection snippet (put in <head> BEFORE any CSS to prevent flicker):
 *   <script>(function(){var l=location.pathname.startsWith('/de')?'de':(localStorage.getItem('ts-lang')||((navigator.language||'').startsWith('de')?'de':'en'));document.documentElement.classList.add('lang-'+l);document.documentElement.lang=l;})();</script>
 */
(function () {
  'use strict';

  var KEY = 'ts-lang';

  /** Return the canonical (language-neutral) path, e.g. /de/pricing.html → /pricing.html */
  function canonicalPath(path) {
    return path.replace(/^\/de(\/|$)/, '/') || '/';
  }

  /** Return the language-prefixed path for DE, or the canonical path for EN. */
  function localizedPath(lang, path) {
    var base = canonicalPath(path);
    if (lang === 'de') {
      return '/de' + (base === '/' ? '/' : base);
    }
    return base;
  }

  function apply(lang, pushState) {
    var html = document.documentElement;
    html.lang = lang;
    // Add new class before removing the old one to prevent a one-frame gap
    // where neither class is present (which would briefly show both languages).
    html.classList.add('lang-' + lang);
    html.classList.remove(lang === 'de' ? 'lang-en' : 'lang-de');
    localStorage.setItem(KEY, lang);

    // Update the URL to reflect the selected language
    if (pushState) {
      var newPath = localizedPath(lang, location.pathname);
      if (newPath !== location.pathname) {
        history.pushState(null, '', newPath + location.search + location.hash);
      }
    }

    // Rewrite all internal nav/footer links so they stay in the correct language
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      // Only rewrite root-relative links (skip absolute URLs, anchors, app.html)
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
      a.setAttribute('href', localizedPath(lang, href));
    });

    // Sync button active states
    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.classList.toggle('lang-active', btn.getAttribute('data-lang-btn') === lang);
    });
  }

  // Global toggle used by onclick handlers in HTML
  window.setLang = function (lang) { apply(lang, true); };

  // Detect language from URL path first, then localStorage, then browser preference
  document.addEventListener('DOMContentLoaded', function () {
    var fromUrl = location.pathname.startsWith('/de') ? 'de' : null;
    var current = fromUrl
      || localStorage.getItem(KEY)
      || ((navigator.language || navigator.userLanguage || 'en').startsWith('de') ? 'de' : 'en');
    apply(current, false);
  });
}());
