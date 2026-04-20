import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
const RAW_API_ORIGIN =
  process.env.API_PROXY_ORIGIN ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  '';

function normalizeConnectOrigin(raw?: string | null): string {
  if (!raw || !raw.trim()) return '';

  let value = raw.trim().replace(/\/+$/, '');

  // Allow env values like https://api.example.com/api/v1 and normalize to origin.
  if (value.endsWith('/api/v1')) value = value.slice(0, -'/api/v1'.length);

  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

const CONNECT_ORIGIN = normalizeConnectOrigin(RAW_API_ORIGIN);

function buildCsp() {
  const connectSrc = ["'self'"];

  if (CONNECT_ORIGIN) {
    connectSrc.push(CONNECT_ORIGIN);
  }

  if (!isProd) {
    connectSrc.push('ws:', 'wss:');
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
    `connect-src ${connectSrc.join(' ')}`,
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Required for Dockerfile COPY .next/standalone and server.js
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
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

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildCsp(),
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          ...(isProd
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
