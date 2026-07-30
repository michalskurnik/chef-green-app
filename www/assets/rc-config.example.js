/**
 * RevenueCat public API keys — template, one per platform.
 *
 * Copy this file to rc-config.js (same folder) and fill in the real
 * production keys before building for release. rc-config.js is
 * gitignored on purpose: production keys must never be committed.
 *
 * Get each key from: RevenueCat dashboard -> Project Settings -> API Keys
 *   - Apple App Store key starts with "appl_"
 *   - Google Play Store key starts with "goog_"
 *
 * RevenueCat issues a separate public SDK key per store, so window.RC_API_KEY
 * below is resolved to whichever key matches the platform actually running
 * the code - a single hardcoded key would be wrong on whichever platform
 * it wasn't issued for.
 */
(function () {
  var KEYS = {
    ios: 'REPLACE_ME',
    android: 'REPLACE_ME'
  };
  var platform = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
    ? window.Capacitor.getPlatform()
    : null;
  window.RC_API_KEY = KEYS[platform] || null;
})();
