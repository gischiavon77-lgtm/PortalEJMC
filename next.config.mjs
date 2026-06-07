/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  // Gera o Prisma Client durante o build na Vercel
  // (o postinstall hook do Prisma cuida disso automaticamente,
  //  mas manter explícito evita edge-cases em monorepos)
  output: undefined, // 'standalone' se quiser Docker no futuro
  images: {
    // Permitir imagens de avatares (base64 data URLs não precisam config,
    // mas se migrar para storage externo, adicionar domínios aqui)
    unoptimized: false,
  },
};

export default nextConfig;
