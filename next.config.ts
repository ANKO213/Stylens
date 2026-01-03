import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
      },
      {
        protocol: 'https',
        hostname: 'replicate.com',
      },
      {
        protocol: 'https',
        hostname: 'dgsvyelmvhybhphdxnvk.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'pub-7910916370d44ba2875c0c6122ac584f.r2.dev',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Support multiple photo uploads
    },
  },
};

export default nextConfig;
