const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
// allowOptionalDependencies lets src/native/push.js load Firebase inside a try/catch even when Firebase is not installed yet.
module.exports = mergeConfig(getDefaultConfig(__dirname), { transformer: { allowOptionalDependencies: true } });
