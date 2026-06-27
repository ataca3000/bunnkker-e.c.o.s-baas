import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') || 'admin.com';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/pos', '/tienda'],
      disallow: ['/sys-admin/', '/api/', '/private/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
