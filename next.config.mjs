/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warnings não bloqueiam o deploy (apenas erros reais)
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
