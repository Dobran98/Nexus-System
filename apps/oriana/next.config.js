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
      { source: '/oriana', destination: '/' },
      { source: '/oriana/:path*', destination: '/:path*' },
    ];
  },
};

module.exports = nextConfig;
