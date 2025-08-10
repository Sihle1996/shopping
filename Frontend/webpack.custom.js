// webpack.config.js
const webpack = require('webpack');

module.exports = {
  resolve: {
    fallback: {
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify'),
      assert: require.resolve('assert'),
      buffer: require.resolve('buffer'),
      util: require.resolve('util'),
      process: require.resolve('process/browser'),
      vm: require.resolve('vm-browserify'),
      fs: false,
      net: false,
      tls: false,
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.DefinePlugin({
      global: 'globalThis', // ✅ from the first config
    }),
  ],
};
