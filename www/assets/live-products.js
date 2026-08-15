/**
 * The single, canonical list of IAP product IDs that are Ready to Submit /
 * Approved in App Store Connect right now.
 *
 * app/packages.html reads this to decide, per package card, whether to show
 * a real price and allow purchase, or a muted "בקרוב" (Coming Soon) badge
 * with purchasing disabled entirely. This exists because Apple rejected the
 * app under Guideline 2.1(b) (App Completeness) for showing price tags on
 * packages that don't have a matching IAP product submitted for review.
 *
 * ── When a new IAP moves to Ready to Submit / Approved in App Store
 *    Connect, add its product ID to LIVE_PRODUCT_IDS below. That package's
 *    card switches back to a real price + purchase automatically - no other
 *    code needs to change. ──
 */
(function () {
  'use strict';

  var LIVE_PRODUCT_IDS = [
    'com.michalskurnik.chefapp.italy'
  ];

  var api = { LIVE_PRODUCT_IDS: LIVE_PRODUCT_IDS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.LIVE_PRODUCT_IDS = LIVE_PRODUCT_IDS;
  }
})();
