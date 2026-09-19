import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPinSha256 } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const INITIAL_PINS = [
  { pin: '0000', role: 'superadmin', name: 'Dueño (Superadmin)' },
  { pin: '1111', role: 'admin', name: 'Gerente (Admin)' },
  { pin: '2222', role: 'sales', name: 'Cajero / Ventas' },
  { pin: '3333', role: 'inventory', name: 'Bodeguero / Inventario' },
  { pin: '4444', role: 'marketing', name: 'Diseñador / Marketing' },
  { pin: '5555', role: 'driver', name: 'Chofer / Repartidor' },
  { pin: '6666', role: 'carga_descarga', name: 'Patio / Carga y Descarga' },
  { pin: '7777', role: 'pickup', name: 'Mostrador / Pick Up' },
  { pin: 'A0000', role: 'superadmin', name: 'Dueño (Superadmin A0000)' },
  { pin: 'A1111', role: 'admin', name: 'Gerente (Admin A1111)' },
];

const MOCK_PRODUCTS = [
  {
    id: 'prod-001',
    name: 'Taladro Inalámbrico Rotomartillo 20V MAX',
    price: 1850.00,
    stock: 28,
    reservedStock: 2,
    category: 'Herramientas',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop',
    rating: 4.8,
    reviewCount: 34,
    barcode: '750100010001',
    description: 'Taladro percutor 20V con 2 baterías de litio y cargador rápido en maletín rígido.',
    estante: 'A-1',
    fila: '2',
    orderIndex: 0,
  },
  {
    id: 'prod-002',
    name: 'Cemento Gris Tolteca 50kg Extra',
    price: 245.00,
    stock: 150,
    reservedStock: 10,
    category: 'Construcción',
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 112,
    barcode: '750100010002',
    description: 'Cemento Portland de alta resistencia para colados y fraguado rápido.',
    estante: 'PATIO-1',
    fila: '1',
    orderIndex: 1,
  },
  {
    id: 'prod-003',
    name: 'Varilla Corrugada 3/8" (9.5mm) 12m',
    price: 185.00,
    stock: 240,
    reservedStock: 0,
    category: 'Construcción',
    image: 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=600&auto=format&fit=crop',
    rating: 4.7,
    reviewCount: 45,
    barcode: '750100010003',
    description: 'Varilla de acero de grado 42 para estructuras y losas.',
    estante: 'PATIO-2',
    fila: '1',
    orderIndex: 2,
  },
  {
    id: 'prod-004',
    name: 'Cable Eléctrico de Cobre Calibre 12 AWG (Roll 100m)',
    price: 1290.00,
    stock: 18,
    reservedStock: 1,
    category: 'Electricidad',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 28,
    barcode: '750100010004',
    description: 'Cable THW-LS anti-flama para instalaciones residenciales e industriales.',
    estante: 'B-3',
    fila: '4',
    orderIndex: 3,
  },
  {
    id: 'prod-005',
    name: 'Pintura Vinílica Lavable Blanco Mate 19L',
    price: 1420.00,
    stock: 35,
    reservedStock: 3,
    category: 'Pinturas',
    image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600&auto=format&fit=crop',
    rating: 4.6,
    reviewCount: 19,
    barcode: '750100010005',
    description: 'Pintura acrílica de cubrimiento total para interiores y exteriores.',
    estante: 'C-1',
    fila: '1',
    orderIndex: 4,
  },
  {
    id: 'prod-006',
    name: 'Juego de Desarmadores de Precisión 24 en 1',
    price: 380.00,
    stock: 45,
    reservedStock: 0,
    category: 'Herramientas',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop',
    rating: 4.8,
    reviewCount: 52,
    barcode: '750100010006',
    description: 'Puntas magnéticas de aleación S2 para electrónica y cerrajería fina.',
    estante: 'A-2',
    fila: '3',
    orderIndex: 5,
  },
  {
    id: 'prod-007',
    name: 'Manguera Reforzada 3 Capas 1/2" 15 Metros',
    price: 290.00,
    stock: 60,
    reservedStock: 0,
    category: 'Jardinería',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&auto=format&fit=crop',
    rating: 4.5,
    reviewCount: 14,
    barcode: '750100010007',
    description: 'Manguera de alta presión con conexiones de latón sólido.',
    estante: 'D-1',
    fila: '2',
    orderIndex: 6,
  },
  {
    id: 'prod-008',
    name: 'Foco LED A19 9W Luz Fría (Paquete 6 Piezas)',
    price: 195.00,
    stock: 90,
    reservedStock: 5,
    category: 'Electricidad',
    image: 'https://images.unsplash.com/photo-1550525811-e5869dd03032?w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 88,
    barcode: '750100010008',
    description: 'Ahorro del 85% de energía, vida útil 25,000 hrs.',
    estante: 'B-1',
    fila: '1',
    orderIndex: 7,
  },
  {
    id: 'prod-009',
    name: 'Esmeriladora Angular 4-1/2" 800W Profesional',
    price: 990.00,
    stock: 16,
    reservedStock: 1,
    category: 'Herramientas',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop',
    rating: 4.7,
    reviewCount: 31,
    barcode: '750100010009',
    description: 'Motor potente con mango auxiliar de 2 posiciones y guarda de ajuste rápido.',
    estante: 'A-1',
    fila: '4',
    orderIndex: 8,
  },
  {
    id: 'prod-010',
    name: 'Cinta Canela Embalaje 48mm x 50m (Paquete 6)',
    price: 180.00,
    stock: 120,
    reservedStock: 0,
    category: 'Papelería y Empaque',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop',
    rating: 4.6,
    reviewCount: 40,
    barcode: '750100010010',
    description: 'Adhesivo acrílico de alta fijación para cerrado de cajas de cartón.',
    estante: 'A-3',
    fila: '5',
    orderIndex: 9,
  }
];

const MOCK_CUSTOMERS = [
  {
    id: 'cust-001',
    tenantId: 'default-local',
    name: 'Constructora Martínez S.A. de C.V.',
    phone: '5551234567',
    email: 'compras@martinezconst.com',
    address: 'Av. de las Industrias #1200, Parque Industrial',
    references: 'Bodega verde frente a caseta de seguridad',
    rfc: 'CMA180512AB3',
    razonSocial: 'Constructora Martínez S.A. de C.V.',
    regimenFiscal: '601',
    usoCFDI: 'G03',
    codigoPostal: '06600',
    pin: '1234'
  },
  {
    id: 'cust-002',
    tenantId: 'default-local',
    name: 'María Elena Torres',
    phone: '5559876543',
    email: 'elena.torres@gmail.com',
    address: 'Calle Insurgentes Sur #402, Apt 3B, Col. Roma',
    references: 'Edificio de ladrillo rojo con portón negro',
    rfc: 'TORE850412H34',
    pin: '4321'
  },
  {
    id: 'cust-003',
    tenantId: 'default-local',
    name: 'Taller Mecánico El Rayo',
    phone: '5554567890',
    email: 'taller.elrayo@hotmail.com',
    address: 'Av. Juárez #88, Col. Centro',
    references: 'Junto a la gasolinera PEMEX',
    rfc: 'TMR920101KL9',
    pin: '5555'
  }
];

export async function GET(req: NextRequest) {
  return seedDatabase();
}

export async function POST(req: NextRequest) {
  return seedDatabase();
}

async function seedDatabase() {
  try {
    // 1. Seed Users
    let usersCreated = 0;
    for (const u of INITIAL_PINS) {
      const pinSha = hashPinSha256(u.pin);
      const existing = await prisma.user.findFirst({
        where: { pin: { in: [pinSha, u.pin] } }
      });
      if (!existing) {
        const pinHash = await bcrypt.hash(u.pin, 10);
        await prisma.user.create({
          data: {
            name: u.name,
            role: u.role,
            pin: pinSha,
            pinHash,
            active: true
          }
        });
        usersCreated++;
      }
    }

    // 2. Seed Products
    let productsCreated = 0;
    for (const p of MOCK_PRODUCTS) {
      const existing = await prisma.product.findUnique({ where: { id: p.id } });
      if (!existing) {
        await prisma.product.create({
          data: {
            id: p.id,
            tenantId: 'default-local',
            name: p.name,
            price: p.price,
            stock: p.stock,
            reservedStock: p.reservedStock,
            category: p.category,
            image: p.image,
            rating: p.rating,
            reviewCount: p.reviewCount,
            barcode: p.barcode,
            description: p.description,
            estante: p.estante,
            fila: p.fila,
            orderIndex: p.orderIndex
          }
        });
        productsCreated++;
      }
    }

    // 3. Seed Customers
    let customersCreated = 0;
    for (const c of MOCK_CUSTOMERS) {
      const existing = await prisma.customer.findUnique({ where: { phone: c.phone } });
      if (!existing) {
        await prisma.customer.create({
          data: c
        });
        customersCreated++;
      }
    }

    // 4. Seed Recent Orders
    const existingOrdersCount = await prisma.order.count();
    let ordersCreated = 0;

    if (existingOrdersCount === 0) {
      const now = new Date();
      const mockOrdersData = [
        {
          id: `ORD-98401`,
          tenantId: 'default-local',
          total: 3945.00,
          paymentMethod: 'TRANSFER',
          status: 'DELIVERED',
          deliveryType: 'DELIVERY',
          date: new Date(now.getTime() - 2 * 3600 * 1000), // 2 hours ago
          vendedorName: 'Cajero / Ventas',
          customerId: 'cust-001',
          items: [
            { productId: 'prod-001', cantidad: 1, precio: 1850.00 },
            { productId: 'prod-002', cantidad: 6, precio: 245.00 },
            { productId: 'prod-008', cantidad: 3, precio: 195.00 },
          ]
        },
        {
          id: `ORD-98402`,
          tenantId: 'default-local',
          total: 1420.00,
          paymentMethod: 'CASH',
          status: 'PAID',
          deliveryType: 'LOCAL',
          date: new Date(now.getTime() - 5 * 3600 * 1000), // 5 hours ago
          vendedorName: 'Cajero / Ventas',
          customerId: 'cust-002',
          items: [
            { productId: 'prod-005', cantidad: 1, precio: 1420.00 },
          ]
        },
        {
          id: `ORD-98403`,
          tenantId: 'default-local',
          total: 2280.00,
          paymentMethod: 'CARD',
          status: 'OUT_FOR_DELIVERY',
          deliveryType: 'DELIVERY',
          date: new Date(now.getTime() - 12 * 3600 * 1000), // 12 hours ago
          vendedorName: 'Chofer / Repartidor',
          customerId: 'cust-003',
          items: [
            { productId: 'prod-004', cantidad: 1, precio: 1290.00 },
            { productId: 'prod-009', cantidad: 1, precio: 990.00 },
          ]
        },
        {
          id: `ORD-98404`,
          tenantId: 'default-local',
          total: 570.00,
          paymentMethod: 'CASH',
          status: 'PENDING_PAYMENT',
          deliveryType: 'PICKUP',
          date: new Date(now.getTime() - 24 * 3600 * 1000), // 1 day ago
          vendedorName: 'Mostrador / Pick Up',
          customerId: 'cust-002',
          items: [
            { productId: 'prod-006', cantidad: 1, precio: 380.00 },
            { productId: 'prod-010', cantidad: 1, precio: 180.00 },
          ]
        }
      ];

      for (const ord of mockOrdersData) {
        await prisma.order.create({
          data: {
            id: ord.id,
            tenantId: ord.tenantId,
            total: ord.total,
            paymentMethod: ord.paymentMethod,
            status: ord.status,
            deliveryType: ord.deliveryType,
            date: ord.date,
            vendedorName: ord.vendedorName,
            customerId: ord.customerId,
            items: {
              create: ord.items
            }
          }
        });
        ordersCreated++;
      }
    }

    const totalProducts = await prisma.product.count();
    const totalOrders = await prisma.order.count();
    const totalUsers = await prisma.user.count();

    return NextResponse.json({
      success: true,
      message: 'Base de datos simulada inicializada correctamente.',
      summary: {
        usersCreated,
        productsCreated,
        customersCreated,
        ordersCreated,
        totalsInDatabase: {
          products: totalProducts,
          orders: totalOrders,
          users: totalUsers
        }
      },
      superadminAccessPin: 'A0000'
    });
  } catch (error: any) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
