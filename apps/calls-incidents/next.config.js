/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@intranet/database',
    '@intranet/ui',
    '@intranet/auth',
    '@intranet/telemetry',
    '@intranet/utils',
  ],
  async rewrites() {
    return [
      { source: '/llamadas', destination: '/' },
      { source: '/llamadas/dialer', destination: '/dialer' },
      { source: '/llamadas/:path*', destination: '/:path*' },
    ];
  },
};

module.exports = nextConfig;
