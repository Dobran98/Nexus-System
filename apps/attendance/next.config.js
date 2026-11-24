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
      { source: '/asistencia', destination: '/' },
      { source: '/asistencia/:path*', destination: '/:path*' },
    ];
  },
};

module.exports = nextConfig;
