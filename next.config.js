/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['storage.googleapis.com', 'composio-uploads.s3.amazonaws.com'],
  },
  // Ensure bundled font is included when API routes are traced (Vercel serverless)
  experimental: {
    outputFileTracingIncludes: {
      '/api/assets/[id]': ['./public/fonts/**', './lib/fonts/**'],
    },
  },
};

module.exports = nextConfig;
