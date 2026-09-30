/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared Zod contract is published as TypeScript source.
  transpilePackages: ['@cb/contracts'],
};

export default nextConfig;
