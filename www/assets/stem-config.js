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
 * older com.michalskurnik.chefapp.italy. ENTITLEMENT/PRODUCT_ID match what is
 * configured in App Store Connect, Google Play and RevenueCat ('science').
 * STORAGE_KEY_PREFIX stays 'stem' so existing localStorage unlock flags
 * (stem_unlocked) and the pages that read them keep working.
 */
(function () {
  'use strict';

  var STEM_CONFIG = {
    ENTITLEMENT: 'science',
    PRODUCT_ID: 'com.michalskurnik.hashefhayarok.science',
    STORAGE_KEY_PREFIX: 'stem'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = STEM_CONFIG;
  } else {
    window.STEM_CONFIG = STEM_CONFIG;
  }
})();
