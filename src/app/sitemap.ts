import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id') || 'default';
  
  // En producción, el host real vendrá de la petición
  const host = headersList.get('host') || 'admin.com';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Rutas base que todos los tenants tienen
  const routes = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/catalogo`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/nosotros`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/ofertas`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/servicios`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/registro`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cuenta`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }
  ];

  // Si es el tenant principal (admin.com), agregar rutas del sistema
  if (tenantId === 'default' || tenantId === 'admin.com') {
    routes.push({
      url: `${baseUrl}/sys-admin`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    });
  }

  // APROVISIONAMIENTO DINÁMICO DE CATEGORÍAS PARA INDEXADO DE GOOGLE
  try {
    const products = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
      where: {
        category: { not: null }
      }
    });
    
    for (const p of products) {
      if (p.category) {
        const catSlug = encodeURIComponent(p.category.toLowerCase());
        routes.push({
          url: `${baseUrl}/catalogo/${catSlug}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.8,
        });
      }
    }
  } catch (e) {
    console.error("Error generating dynamic category sitemap:", e);
  }

  return routes;
}
