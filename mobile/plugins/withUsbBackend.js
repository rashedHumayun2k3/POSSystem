const { withAndroidManifest } = require('@expo/config-plugins');
// This local USB build talks to the developer's computer on loopback HTTP.
module.exports = config => withAndroidManifest(config, result => {
  result.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
  return result;
});
