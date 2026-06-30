const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const products = [
  {
    id: 'FERR-CEM-01', name: 'Cemento Cruz Azul Gris 50kg', price: 185, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 128, barcode: '7501020304050', description: 'Cemento gris de alta resistencia para todo tipo de construcciones.'
  },
  {
    id: 'FERR-TLD-02', name: 'Taladro Percutor DeWalt 20V Max', price: 2499, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 84, barcode: '0885911432561', description: 'Taladro inalámbrico profesional con 2 baterías de litio incluidas.'
  },
  {
    id: 'FERR-PNT-03', name: 'Pintura Vinílica Comex Pro 1000 Blanco 19L', price: 1150, stock: 10, category: 'Liquidación', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 45, barcode: '7501234567890', description: 'Pintura vinil acrílica para interiores y exteriores. Alto rendimiento.'
  },
  {
    id: 'FERR-MRT-04', name: 'Martillo Truper de Uña Curva 16oz', price: 145, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 230, barcode: '7509876543210', description: 'Martillo forjado en acero con mango de madera de encino.'
  },
  {
    id: 'FERR-CBL-05', name: 'Cable THW Calibre 12 AWG Indiana (Caja 100m)', price: 980, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 312, barcode: '7504445556667', description: 'Cable de cobre con aislamiento termoplástico para instalaciones domésticas.'
  },
  {
    id: 'FERR-SRR-06', name: 'Sierra Circular Makita 7-1/4"', price: 1850, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 67, barcode: '088381001234', description: 'Potente motor de 1,050W para cortes precisos en madera.'
  },
  {
    id: 'FERR-CLV-07', name: 'Caja de Clavos Standard 2.5" 1Kg', price: 45, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1510166089176-b57564a5b7d5?w=800&auto=format&fit=crop', rating: 4.5, reviewCount: 32, barcode: '7509998887776', description: 'Clavo de acero standard con cabeza plana.'
  },
  {
    id: 'FERR-PLM-08', name: 'Tubo CPVC 1/2" Tramo de 3 Metros', price: 68, stock: 10, category: 'Plomería', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 55, barcode: '7502223334445', description: 'Tubería para agua fría y caliente de alta resistencia.'
  },
  {
    id: 'FERR-FOCO-09', name: 'Foco LED Philips 9W Luz Blanca', price: 35, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 420, barcode: '8718696577395', description: 'Foco LED ahorrador, equivalente a 60W tradicionales.'
  },
  {
    id: 'FERR-ESM-10', name: 'Esmeriladora Angular Bosch 4-1/2"', price: 1299, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1586864387789-228f4277bc79?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 112, barcode: '3165140823223', description: 'Herramienta profesional con disco de corte incluido.'
  },
  {
    id: 'FERR-IMP-11', name: 'Impermeabilizante Fester Acriton 5 Años 19L', price: 1450, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 88, barcode: '7501112223334', description: 'Impermeabilizante acrílico rojo, de secado rápido.'
  },
  {
    id: 'FERR-PIN-12', name: 'Brocha de Cerdas Naturales 4" Éxito', price: 85, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&auto=format&fit=crop', rating: 4.4, reviewCount: 22, barcode: '7500001112223', description: 'Brocha profesional ideal para vinílica y esmalte.'
  },
  {
    id: 'FERR-LAV-13', name: 'Mezcladora para Fregadero Dica', price: 420, stock: 10, category: 'Plomería', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 54, barcode: '7505554443332', description: 'Acabado cromado, fácil instalación, cuello flexible.'
  },
  {
    id: 'FERR-CFL-14', name: 'Cinta Teflón Truper 1/2"x13m', price: 12, stock: 10, category: 'Plomería', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 1100, barcode: '7501206677889', description: 'Sella roscas en tuberías de agua y gas.'
  },
  {
    id: 'FERR-CAL-15', name: 'Bulto de Calhidra 25kg', price: 65, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 95, barcode: '7504443332221', description: 'Cal hidratada para albañilería general.'
  },
  {
    id: 'FERR-MET-16', name: 'Flexómetro Milwaukee 8 Metros Magnético', price: 340, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 76, barcode: '045242330832', description: 'Cinta métrica ultra resistente con punta magnética.'
  },
  {
    id: 'FERR-BRO-17', name: 'Juego de Brocas para Concreto Bosch 5 Pzas', price: 180, stock: 10, category: 'Herramientas', image: 'https://images.unsplash.com/photo-1586864387789-228f4277bc79?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 45, barcode: '3165140416173', description: 'Brocas de tungsteno para perforar piedra y mampostería.'
  },
  {
    id: 'FERR-LJA-18', name: 'Lija de Agua Fandeli Grano 220', price: 8, stock: 10, category: 'Liquidación', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&auto=format&fit=crop', rating: 4.5, reviewCount: 205, barcode: '7507778889990', description: 'Para acabados finos en metales y madera.'
  },
  {
    id: 'FERR-SEG-19', name: 'Arco con Segueta Truper Bimetálica', price: 135, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 88, barcode: '7501206680230', description: 'Corte rápido en metales duros y plásticos.'
  },
  {
    id: 'FERR-CCT-20', name: 'Cinta de Aislar Nitto Negra 18m', price: 28, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 650, barcode: '4953871100222', description: 'Retardante a la llama, uso profesional eléctrico.'
  },
  {
    id: 'FERR-YES-21', name: 'Bulto de Yeso Supremo 40kg', price: 110, stock: 10, category: 'Materiales', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 56, barcode: '7503332221110', description: 'Yeso blanco para recubrimiento de muros interiores.'
  },
  {
    id: 'FERR-PEG-22', name: 'Pegazulejo Niasa Blanco 20kg', price: 125, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 89, barcode: '7508889990001', description: 'Adhesivo cerámico reforzado para interiores.'
  },
  {
    id: 'FERR-DES-23', name: 'Desarmador Phillips #2 Klein Tools', price: 195, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 134, barcode: '092644322158', description: 'Punta de precisión, mango ergonómico cushion-grip.'
  },
  {
    id: 'FERR-TNB-24', name: 'Tinaco Rotoplas 1100 Lts Tricapa', price: 2450, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 42, barcode: '7504445558889', description: 'Incluye accesorios. Garantía de por vida, protección UV.'
  }
];

async function main() {
  console.log('Seeding products to SQLite...');
  
  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        image: p.image,
        rating: p.rating,
        reviewCount: p.reviewCount,
        barcode: p.barcode,
        description: p.description
      },
      create: {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        image: p.image,
        rating: p.rating,
        reviewCount: p.reviewCount,
        barcode: p.barcode,
        description: p.description
      }
    });
  }

  console.log('Product seeding completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
