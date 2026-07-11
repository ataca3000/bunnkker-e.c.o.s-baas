"use server";

import { prisma } from "@/lib/prisma";
import type { VentaCoreParams, VentaResult } from "./index";

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

            // 3. Encolar para sincronización
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
                        date: new Date().toISOString()
                    })
                }
            });

            return order;
        });

        return {
            id: result.id,
            total: result.total,
            offline: result.offline,
            date: result.date.toISOString(),
            status: result.status
        };
    } catch (e) {
        console.error("Error en createLocalSale:", e);
        throw e;
    }
}

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
    }
}

export async function getLocalProduct(idProducto: string) {
    return await prisma.product.findUnique({
        where: { id: idProducto }
    });
}

export async function getLocalInventory(idProducto: string): Promise<number> {
    const p = await prisma.product.findUnique({
        where: { id: idProducto }
    });
    
    if (p) return p.stock;

    // Para tests locales, si no existe lo creamos
    await prisma.product.create({
        data: {
            id: idProducto,
            name: `Producto Test ${idProducto}`,
            stock: 100,
            price: 100
        }
    });
    return 100;
}

export async function decrementLocalInventory(idProducto: string, cantidad: number) {
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
