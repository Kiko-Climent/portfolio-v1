/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [256, 384],
    qualities: [50, 75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
