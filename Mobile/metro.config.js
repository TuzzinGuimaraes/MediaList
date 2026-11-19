const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// Os tokens de design (design/tokens.js), os tipos da API (contrato/api.d.ts, ADR 0011) e o
// domínio compartilhado com o web (dominio/, importado como @dominio/*) ficam na raiz do repo,
// fora do projeto Expo.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../design'),
  path.resolve(__dirname, '../contrato'),
  path.resolve(__dirname, '../dominio'),
];

module.exports = withNativeWind(config, { input: './global.css' });
