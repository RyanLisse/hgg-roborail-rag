import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Build optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  serverExternalPackages: ['drizzle-orm', 'postgres'],
  typescript: {
    ignoreBuildErrors: false,
    // Ensure TypeScript compilation uses correct module resolution
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Build performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Output configuration for deployment
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  // Webpack configuration for module resolution
  webpack: (config, { isServer }) => {
    // Ensure proper module resolution for both client and server
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Handle server-only modules properly
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'server-only': false,
      };
    }

    return config;
  },
  // Ensure proper transpilation of ES modules
  transpilePackages: [
    'ai',
    '@ai-sdk/openai',
    '@ai-sdk/anthropic',
    '@ai-sdk/google',
    '@ai-sdk/cohere',
    '@ai-sdk/groq',
    '@ai-sdk/xai',
  ],
};

export default nextConfig;
