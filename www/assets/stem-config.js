/**
 * Single source of truth for the STEM ("ניסויים במטבח") package's identifiers.
 * Loaded by stem/access-guard.js and, later, by whatever purchase flow in
 * app/packages.html sells this package — both must require/include this
 * file rather than re-typing the entitlement/product strings, so there is
 * exactly one place to change them.
 *
 * Mirrors assets/protein-config.js (package 3). PRODUCT_ID here is the
 * proposal from the Asana task notes — note it follows protein's bundle
 * scheme (com.michalskurnik.hashefhayarok.*), which differs from italy's
 * older com.michalskurnik.chefapp.italy. Confirm/reconcile before wiring
 * up a real purchase flow or submitting to the stores.
 */
(function () {
  'use strict';

  var STEM_CONFIG = {
    ENTITLEMENT: 'stem',
    PRODUCT_ID: 'com.michalskurnik.hashefhayarok.stem',
    STORAGE_KEY_PREFIX: 'stem'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = STEM_CONFIG;
  } else {
    window.STEM_CONFIG = STEM_CONFIG;
  }
})();
