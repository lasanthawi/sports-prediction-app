import type { MetadataRoute } from 'next'
import { BRAND, LEGAL_LINKS } from '@/lib/brand'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = BRAND.appUrl.replace(/\/$/, '')
  const staticPaths = ['/', '/login', '/admin', '/player/dashboard', ...LEGAL_LINKS.map((link) => link.href)]

  return staticPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }))
}
