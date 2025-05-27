const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [],
  server: {
    useGlobalHotkey: false,
  },
  watcher: {
    watchman: false,
    usePolling: true,
    interval: 1000,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
