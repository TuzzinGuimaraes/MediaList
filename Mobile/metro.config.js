const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// Os tokens de design ficam na raiz do repo (design/tokens.js), fora do projeto Expo.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../design')];

module.exports = withNativeWind(config, { input: './global.css' });
