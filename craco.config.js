module.exports = {
  // Dev overlay: Cornerstone loads slices through internal promises it never awaits, so a
  // slice that fails to download (e.g. a 502 from the backend) surfaces as an unhandled
  // rejection of a plain object — "[object Object]" — and takes over the screen. The app
  // already handles and reports those; real Errors still show.
  devServer: (devServerConfig) => {
    const client = devServerConfig.client || {};
    const overlay = typeof client.overlay === "object" ? client.overlay : { errors: true, warnings: false };
    devServerConfig.client = {
      ...client,
      overlay: { ...overlay, runtimeErrors: (error) => error?.message !== "[object Object]" },
    };
    return devServerConfig;
  },
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
