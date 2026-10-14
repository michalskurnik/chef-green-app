// Green Chef landing pages: device-aware store buttons, sticky CTA, reveal on scroll.
(function () {
  'use strict';

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var os = isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop');
  document.documentElement.setAttribute('data-os', os);

  // The sticky button goes straight to the matching store on phones.
  var sticky = document.querySelector('.sticky-cta');
  if (sticky) {
    var link = sticky.querySelector('a[data-auto-store]');
    if (link && os !== 'desktop') {
      var target = document.querySelector('.store[data-store="' + os + '"]');
      if (target) link.href = target.href;
    }
    var hero = document.querySelector('.hero, .ws-hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        sticky.classList.toggle('show', !entries[0].isIntersecting);
      }).observe(hero);
    } else {
      sticky.classList.add('show');
    }
  }

  // Reveal sections as they scroll into view.
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }
  // Safety net: never leave content hidden (slow devices, crawlers, screenshots).
  setTimeout(function () { items.forEach(function (el) { el.classList.add('in'); }); }, 2500);

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
