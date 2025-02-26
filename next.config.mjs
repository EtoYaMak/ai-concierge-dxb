/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@neondatabase/serverless"],
  },
  // Add this to help with environment loading
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};

export default nextConfig;
