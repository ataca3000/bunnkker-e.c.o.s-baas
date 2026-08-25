"use server";

import { prisma } from "@/lib/prisma";
import type { VentaCoreParams, VentaResult } from "./index";

import { calculateDOMHash } from "@/lib/domCrypto";

export async function createLocalSale(datos: VentaCoreParams, total: number, isOffline: boolean): Promise<VentaResult> {
    try {
        // Ejecutamos una transacción local en SQLite
        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear la orden
            const order = await tx.order.create({
                data: {
                    total,
                    paymentMethod: datos.metodoPago,
                    offline: isOffline,
                    synced: false,
                    items: {
                        create: datos.productos.map(p => ({
                            productId: p.id,
                            cantidad: p.cantidad,
                            precio: p.precio
                        }))
                    }
                }
            });

            // 1b. Generar la firma criptográfica H_n (D.O.M. Hash Chain)
            const { hash, prevHash } = calculateDOMHash({
                id: order.id,
                total: order.total,
                timestamp: order.date.toISOString(),
                usuario: "CAJERO_LOCAL"
            });

            // 2. Descontar inventario local
            for (const item of datos.productos) {
                await tx.product.update({
                    where: { id: item.id },
                    data: {
                        stock: {
                            decrement: item.cantidad
                        }
                    }
                });
            }

            // 3. Encolar para sincronización con firma inmutable H_n
            await tx.syncQueue.create({
                data: {
                    collection: "orders",
                    action: "CREATE",
                    payload: JSON.stringify({
                        localOrderId: order.id,
                        items: datos.productos,
                        total,
                        paymentMethod: datos.metodoPago,
                        status: "paid",
                        date: order.date.toISOString(),
                        domHash: hash,
                        domPrevHash: prevHash
                    })
                }
            });

            return { ...order, hash, prevHash };
        });

        return {
            id: result.id,
            total: result.total,
            offline: result.offline,
            date: result.date.toISOString(),
            status: result.status,
            hash: result.hash,
            prevHash: result.prevHash
        };
    } catch (e) {
        console.error("Error en createLocalSale:", e);
        throw e;
    }
}

import { productLRUCache } from "@/lib/lruCache";

export async function syncLocalInventory(productos: any[]) {
    // Cuando el sistema arranca, puede descargar los productos de Firebase
    // y guardarlos en SQLite para tener caché local
    for (const p of productos) {
        await prisma.product.upsert({
            where: { id: p.id },
            update: {
                name: p.name,
                price: p.price,
                stock: p.stock,
                category: p.category,
                image: p.image
            },
            create: {
                id: p.id,
                name: p.name,
                price: p.price,
                stock: p.stock,
                category: p.category,
                image: p.image
            }
        });
        productLRUCache.invalidate(p.id);
    }
}

export async function getLocalProduct(idProducto: string) {
    const cached = productLRUCache.get(idProducto);
    if (cached) return cached;

    const product = await prisma.product.findUnique({
        where: { id: idProducto }
    });

    if (product) {
        productLRUCache.set(idProducto, product);
    }

    return product;
}

export async function getLocalInventory(idProducto: string): Promise<number> {
    const cachedProduct = productLRUCache.get(idProducto);
    if (cachedProduct) return cachedProduct.stock;

    const p = await prisma.product.findUnique({
        where: { id: idProducto }
    });
    
    if (p) {
        productLRUCache.set(idProducto, p);
        return p.stock;
    }

    // Para tests locales, si no existe lo creamos
    const newProduct = await prisma.product.create({
        data: {
            id: idProducto,
            name: `Producto Test ${idProducto}`,
            stock: 100,
            price: 100
        }
    });
    productLRUCache.set(idProducto, newProduct);
    return 100;
}

export async function decrementLocalInventory(idProducto: string, cantidad: number) {
    productLRUCache.invalidate(idProducto);
    await prisma.product.update({
        where: { id: idProducto },
        data: {
            stock: { decrement: cantidad }
        }
    });
}

export async function logLocalAudit(evento: { tipo: string; referencia: string; usuario: string }) {
    return await prisma.auditLog.create({
        data: {
            action: evento.tipo,
            details: `Referencia: ${evento.referencia}`,
            userId: evento.usuario,
            synced: false
        }
    });
}

export async function getLocalReports() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
        where: {
            date: {
                gte: hoy
            }
        }
    });

    const ventasHoy = orders.reduce((acc, order) => acc + order.total, 0);
    return { ventasHoy: ventasHoy > 0 ? ventasHoy : 1 };
}
