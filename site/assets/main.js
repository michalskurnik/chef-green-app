// Green Chef landing pages: device-aware store buttons, sticky CTA, reveal on scroll.
(function () {
  'use strict';

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var os = isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop');
  document.documentElement.setAttribute('data-os', os);

  // Google Analytics 4: page views plus clicks on store and WhatsApp buttons.
  var GA_ID = 'G-2KMDQX2WND';
  var gtag = function () {};
  if (!/X{6}/.test(GA_ID)) {
    window.dataLayer = window.dataLayer || [];
    gtag = window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(ga);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var where = a.closest('.sticky-cta') ? 'sticky' : (a.closest('.hero, .ws-hero') ? 'top' : 'page');
    if (/apps\.apple\.com|play\.google\.com/.test(a.href)) {
      gtag('event', 'store_click', { store: /apple/.test(a.href) ? 'app_store' : 'google_play', button_location: where, transport_type: 'beacon' });
    } else if (/wa\.me\//.test(a.href)) {
      var text = decodeURIComponent((a.href.split('text=')[1] || '').replace(/\+/g, ' '));
      gtag('event', 'whatsapp_click', { topic: text.replace(/^היי, אשמח (לשמוע פרטים על |לתאם )?/, '').slice(0, 80) || 'general', button_location: where, transport_type: 'beacon' });
    }
  });

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

  // Party clips: load and play only while on screen; respect reduced motion.
  var clips = document.querySelectorAll('video[data-src]');
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (clips.length && !still && 'IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.src) v.src = v.getAttribute('data-src');
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else if (v.src) {
          v.pause();
        }
      });
    }, { rootMargin: '200px 0px' });
    clips.forEach(function (v) { vo.observe(v); });
  }

  // Characters: tap to hop and say the next line in a comic bubble.
  document.querySelectorAll('.char[data-lines]').forEach(function (btn) {
    var lines = JSON.parse(btn.getAttribute('data-lines'));
    var bubble = btn.querySelector('.bubble');
    var i = 0, timer;
    btn.addEventListener('click', function () {
      bubble.textContent = lines[i++ % lines.length];
      btn.classList.remove('hop');
      void btn.offsetWidth;
      btn.classList.add('hop', 'talk');
      clearTimeout(timer);
      timer = setTimeout(function () { btn.classList.remove('talk'); }, 2800);
    });
  });

  // End-of-adventure flip-through: swipe, arrows, dots and a label per slide.
  document.querySelectorAll('.flip').forEach(function (fig) {
    var track = fig.querySelector('.flip-track');
    var slides = track.querySelectorAll('img');
    var dots = fig.querySelectorAll('.flip-dots span');
    var label = fig.querySelector('.flip-label');
    var current = 0;
    function index() { return Math.round(Math.abs(track.scrollLeft) / track.clientWidth); }
    function show(i) {
      current = (i + slides.length) % slides.length;
      dots.forEach(function (d, n) { d.classList.toggle('on', n === current); });
      if (label) label.textContent = slides[current].getAttribute('data-label');
    }
    function go(i) {
      i = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: 'smooth' });
      show(i);
    }
    var t;
    track.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(function () { show(index()); }, 80); });
    fig.querySelector('.flip-btn.next').addEventListener('click', function () { go(current + 1); });
    fig.querySelector('.flip-btn.prev').addEventListener('click', function () { go(current - 1); });
  });

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
