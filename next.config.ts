import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ✅ Required for Dockerfile COPY .next/standalone and server.js
  output: 'standalone',

  // Optional: leave turbopack config if you want, but it's not required for production builds
  turbopack: {},

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: '**.digitaloceanspaces.com' },
      { protocol: 'https', hostname: '**.cdn.digitaloceanspaces.com' },
    ],
  },

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
