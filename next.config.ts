import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  // IMPORTANT: no rewrites to /proxy/auth
  async rewrites() {
    return [
      {
        source: '/admin/:path*',
        destination: '/dashboard/:path*',
      },
      {
        source: '/super/:path*',
        destination: '/dashboard/super/:path*',
      },
    ];
  },
};

export default nextConfig;
