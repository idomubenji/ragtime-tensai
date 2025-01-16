/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Note: we provide webpack above so you should not `require` it
    // Perform customizations to webpack config
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': new URL('./src', import.meta.url).pathname,
    };

    // Important: return the modified config
    return config;
  },
  // Add production optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
}

export default nextConfig; 