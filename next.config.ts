import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  // IMPORTANT: no rewrites to /proxy/auth
};

export default nextConfig;
