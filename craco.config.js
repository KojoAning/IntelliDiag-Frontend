module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // The @cornerstonejs WASM codec packages reference Node.js built-ins
      // (fs, path) via CJS stubs that are never actually executed in the browser.
      // Tell webpack 5 to stub them out rather than error.
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        fs: false,
        path: false,
      };

      // Suppress missing source map warnings from third-party packages
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /Failed to parse source map/,
      ];

      return webpackConfig;
    },
  },
};
