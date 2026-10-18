/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Report-Key, X-Brand-Key, X-Agency-Key, Content-Type, Authorization' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/brands/:path*', destination: '/api/brands/:path*' },
    ];
  },
};
export default nextConfig;
