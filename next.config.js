/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["openai"],
  webpack: (config, { dev, isServer }) => {
    // Avoid dev-only "./chunks/undefined" when new API routes + lib/ imports hot-reload
    if (dev && isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
