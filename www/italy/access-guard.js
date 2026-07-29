/**
 * Italy paid-content access gate.
 *
 * Loaded as the first classic <script> (after rc-config.js) by every italy
 * page - index.html, game1-8.html, final_screen.html, completion.html,
 * parents.html - so a direct URL to any of them re-checks access before the
 * page is allowed to render, instead of relying on the caller (packages.html)
 * to have gated the link.
 *
 * Pure decision functions are exported for Node (`require`-able from tests,
 * same pattern as unlock-logic.js). The browser-only wrapper below them does
 * the actual DOM/localStorage/RevenueCat wiring.
 */
(function () {
  'use strict';

  var ITALY_ENTITLEMENT   = 'italy';
  var REDIRECT_TARGET     = '../app/packages.html';
  var VERIFY_TIMEOUT_MS   = 5000;
  var SESSION_RECHECK_KEY = 'italy_access_rechecked';

  // ── Pure decision logic (no DOM, no RevenueCat, no timers) ──────────

  // Cache miss on native can't be assumed "never purchased" - localStorage
  // is wiped on reinstall, so a cold cache there means "go ask RevenueCat"
  // rather than "deny". Everywhere else the cached flag is trusted outright.
  function decideInitialAccess(opts) {
    if (!opts.isNative) return opts.cachedUnlocked ? 'reveal' : 'redirect';
    return opts.cachedUnlocked ? 'reveal' : 'verify';
  }

  // Used for the cache-miss "verify" path. There's no cached flag to fall
  // back on here, so an unknown result (RC error/timeout -> null) is
  // treated the same as "not entitled": deny by default, and let the
  // player use the restore-purchases button on packages.html if this was
  // a false negative.
  function decideAfterVerify(opts) {
    return opts.entitlementActive === true ? 'reveal' : 'redirect';
  }

  // Runs at most once per session, and only when the page already revealed
  // optimistically from a cache hit (native) - not on every one of the 8
  // game pages in a playthrough.
  function shouldRunBackgroundRecheck(opts) {
    return !!(opts.isNative && opts.cachedUnlocked && !opts.alreadyCheckedThisSession);
  }

  // Opposite default from decideAfterVerify: this player is already in and
  // playing, so an unknown result (RC error/timeout -> null) must NOT revoke
  // access - only an explicit, confirmed "not active" (a real refund/
  // cancellation) does. A flaky background network call should never kick
  // a paying kid out mid-game.
  function decideBackgroundRecheckOutcome(opts) {
    return opts.entitlementActive === false ? 'revoke' : 'keep';
  }

  var api = {
    decideInitialAccess: decideInitialAccess,
    decideAfterVerify: decideAfterVerify,
    shouldRunBackgroundRecheck: shouldRunBackgroundRecheck,
    decideBackgroundRecheckOutcome: decideBackgroundRecheckOutcome
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return; // Node/test context - stop before touching document/window below.
  }

  window.ItalyAccessGuard = api;

  // ── Browser wrapper: DOM, localStorage/sessionStorage, RevenueCat ───

  // Hide immediately, synchronously, before anything else in <head> can
  // paint - this is the only part of the guard that must run before render.
  document.documentElement.style.visibility = 'hidden';

  function reveal() {
    document.documentElement.style.visibility = '';
  }
  function redirect() {
    window.location.replace(REDIRECT_TARGET);
  }
  function getCachedUnlocked() {
    return localStorage.getItem('italy_unlocked') === 'true';
  }
  function setCachedUnlocked(v) {
    if (v) localStorage.setItem('italy_unlocked', 'true');
    else localStorage.removeItem('italy_unlocked');
  }
  function isNativePlatform() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  // Resolves true / false / null (null = couldn't tell - no plugin, no key,
  // RC error, or the safety timeout fired). Never rejects.
  function checkEntitlement() {
    var rcPurchases = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases;
    if (!rcPurchases || !window.RC_API_KEY || window.RC_API_KEY === 'REPLACE_ME') {
      return Promise.resolve(null);
    }

    var rcCall = rcPurchases.configure({ apiKey: window.RC_API_KEY })
      .then(function () { return rcPurchases.getCustomerInfo(); })
      .then(function (res) {
        return !!(res && res.customerInfo && res.customerInfo.entitlements &&
          res.customerInfo.entitlements.active[ITALY_ENTITLEMENT]);
      })
      .catch(function () { return null; });

    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, VERIFY_TIMEOUT_MS);
    });

    return Promise.race([rcCall, timeout]);
  }

  function maybeRunBackgroundRecheck(isNative, cachedUnlocked) {
    var alreadyCheckedThisSession = sessionStorage.getItem(SESSION_RECHECK_KEY) === 'true';
    if (!shouldRunBackgroundRecheck({
      isNative: isNative,
      cachedUnlocked: cachedUnlocked,
      alreadyCheckedThisSession: alreadyCheckedThisSession
    })) {
      return;
    }
    sessionStorage.setItem(SESSION_RECHECK_KEY, 'true');
    checkEntitlement().then(function (entitlementActive) {
      var outcome = decideBackgroundRecheckOutcome({ entitlementActive: entitlementActive });
      if (outcome === 'revoke') setCachedUnlocked(false);
    });
  }

  function boot() {
    var isNative = isNativePlatform();
    var cachedUnlocked = getCachedUnlocked();
    var initial = decideInitialAccess({ isNative: isNative, cachedUnlocked: cachedUnlocked });

    if (initial === 'reveal') {
      reveal();
      maybeRunBackgroundRecheck(isNative, cachedUnlocked);
      return;
    }
    if (initial === 'redirect') {
      redirect();
      return;
    }

    // initial === 'verify': native, cold cache - ask RevenueCat before deciding.
    checkEntitlement().then(function (entitlementActive) {
      var outcome = decideAfterVerify({ entitlementActive: entitlementActive });
      if (outcome === 'reveal') {
        setCachedUnlocked(true);
        reveal();
      } else {
        redirect();
      }
    });
  }

  boot();
})();
