/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@intranet/database',
    '@intranet/ui',
    '@intranet/auth',
    '@intranet/telemetry',
    '@intranet/utils',
  ],
};

module.exports = nextConfig;

