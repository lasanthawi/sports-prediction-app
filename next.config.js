/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['storage.googleapis.com', 'composio-uploads.s3.amazonaws.com'],
  },
}

module.exports = nextConfig