/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/brands/:path*', destination: '/api/brands/:path*' },
    ];
  },
};
export default nextConfig;
