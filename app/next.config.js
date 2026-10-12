const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // snarkjs and argon2-browser ship as CommonJS bundles that pull node-only
  // shims; tell Next not to try to bundle them server-side.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    // argon2-browser pulls in argon2.wasm; snarkjs/circomlibjs also use wasm.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    // argon2-browser does `require('argon2.wasm')` to dodge bundlers; we
    // shim it out and serve the wasm from /public instead.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /\.wasm$/,
        contextRegExp: /argon2-browser/,
      }),
    );
    return config;
  },
  // The frontend never serves user content, so a strict CSP is fine.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
