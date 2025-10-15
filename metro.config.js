const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuración optimizada para JSC
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;
