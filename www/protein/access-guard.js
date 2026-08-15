/**
 * Protein paid-content access gate.
 *
 * Same model as italy/access-guard.js (paid package -> RevenueCat entitlement
 * check), not dinner's (dinner is free and has no guard at all). Load this
 * as the first classic <script> (after rc-config.js and protein-config.js)
 * by every protein page - index.html, game*.html, final_screen.html,
 * completion.html, parents.html - so a direct URL to any of them re-checks
 * access before the page renders.
 *
 * Unlike italy/access-guard.js, the entitlement name and product id are not
 * hardcoded here - they come from assets/protein-config.js, the one place
 * those strings are defined. If a purchase flow for this package is added
 * to app/packages.html later, it must require/include the same config file
 * instead of retyping the strings there.
 *
 * Pure decision functions are exported for Node (`require`-able from tests,
 * same pattern as italy/unlock-logic.js). The browser-only wrapper below them
 * does the actual DOM/localStorage/RevenueCat wiring.
 */
(function () {
  'use strict';

  var CONFIG = (typeof module !== 'undefined' && module.exports)
    ? require('../assets/protein-config.js')
    : window.PROTEIN_CONFIG;

  var ENTITLEMENT         = CONFIG.ENTITLEMENT;
  var UNLOCKED_KEY        = CONFIG.STORAGE_KEY_PREFIX + '_unlocked';
  var SESSION_RECHECK_KEY = CONFIG.STORAGE_KEY_PREFIX + '_access_rechecked';
  var REDIRECT_TARGET     = '../app/packages.html';
  var VERIFY_TIMEOUT_MS   = 5000;

  // ── Pure decision logic (no DOM, no RevenueCat, no timers) ──────────
  // Identical contract to italy/access-guard.js - see that file's comments
  // for the reasoning behind each branch. Duplicated here rather than
  // shared because factoring it out would mean touching italy/access-guard.js,
  // which is out of scope while italy/ is frozen pre-App-Store-approval.

  function decideInitialAccess(opts) {
    if (!opts.isNative) return opts.cachedUnlocked ? 'reveal' : 'redirect';
    return opts.cachedUnlocked ? 'reveal' : 'verify';
  }

  function decideAfterVerify(opts) {
    return opts.entitlementActive === true ? 'reveal' : 'redirect';
  }

  function shouldRunBackgroundRecheck(opts) {
    return !!(opts.isNative && opts.cachedUnlocked && !opts.alreadyCheckedThisSession);
  }

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

  window.ProteinAccessGuard = api;

  // ── Browser wrapper: DOM, localStorage/sessionStorage, RevenueCat ───

  document.documentElement.style.visibility = 'hidden';

  function reveal() {
    document.documentElement.style.visibility = '';
  }
  function redirect() {
    window.location.replace(REDIRECT_TARGET);
  }
  function getCachedUnlocked() {
    return localStorage.getItem(UNLOCKED_KEY) === 'true';
  }
  function setCachedUnlocked(v) {
    if (v) localStorage.setItem(UNLOCKED_KEY, 'true');
    else localStorage.removeItem(UNLOCKED_KEY);
  }
  function isNativePlatform() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function checkEntitlement() {
    var rcPurchases = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases;
    if (!rcPurchases || !window.RC_API_KEY || window.RC_API_KEY === 'REPLACE_ME') {
      return Promise.resolve(null);
    }

    var rcCall = rcPurchases.configure({ apiKey: window.RC_API_KEY })
      .then(function () { return rcPurchases.getCustomerInfo(); })
      .then(function (res) {
        return !!(res && res.customerInfo && res.customerInfo.entitlements &&
          res.customerInfo.entitlements.active[ENTITLEMENT]);
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
