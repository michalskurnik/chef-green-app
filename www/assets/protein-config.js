/**
 * Single source of truth for the Protein package's identifiers.
 * Loaded by protein/access-guard.js and, later, by whatever purchase flow
 * in app/packages.html sells this package — both must require/include this
 * file rather than re-typing the entitlement/product strings, so there is
 * exactly one place to change them.
 *
 * Mirrors the ITALY_ENTITLEMENT / ITALY_PRODUCT_ID pair in italy/access-guard.js
 * and app/packages.html, which are two separate hardcoded copies of the same
 * strings today — do not repeat that pattern here.
 */
(function () {
  'use strict';

  var PROTEIN_CONFIG = {
    ENTITLEMENT: 'protein',
    PRODUCT_ID: 'com.michalskurnik.hashefhayarok.protein',
    STORAGE_KEY_PREFIX: 'protein'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PROTEIN_CONFIG;
  } else {
    window.PROTEIN_CONFIG = PROTEIN_CONFIG;
  }
})();
