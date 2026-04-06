/*!
 * TapShift language switcher
 * Supports DE / EN. Language is detected from browser settings, stored in
 * localStorage, and can be toggled via setLang(lang).
 *
 * Inline detection snippet (put in <head> BEFORE any CSS to prevent flicker):
 *   <script>(function(){var l=localStorage.getItem('ts-lang')||((navigator.language||'').startsWith('de')?'de':'en');document.documentElement.classList.add('lang-'+l);document.documentElement.lang=l;})();</script>
 */
(function () {
  'use strict';

  var KEY = 'ts-lang';

  function apply(lang) {
    var html = document.documentElement;
    html.lang = lang;
    html.classList.remove('lang-en', 'lang-de');
    html.classList.add('lang-' + lang);
    localStorage.setItem(KEY, lang);

    // Sync button active states
    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.classList.toggle('lang-active', btn.getAttribute('data-lang-btn') === lang);
    });
  }

  // Global toggle used by onclick handlers in HTML
  window.setLang = function (lang) { apply(lang); };

  // Ensure buttons reflect the current language once DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var current = localStorage.getItem(KEY)
      || ((navigator.language || navigator.userLanguage || 'en').startsWith('de') ? 'de' : 'en');
    apply(current);
  });
}());
