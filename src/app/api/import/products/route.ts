import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, getTenantId } from '@/lib/apiAuth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * RFC-4180 CSV parser para una línea, soportando comas dentro de comillas dobles
 * (ej. `"Codo PVC 1/2, cédula 40",120,50`) y comillas escapadas (`""`).
 */
export function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin']);
    if (!auth.ok) return auth.response;

    try {
        const formData = await request.formData();
        const csvFile = formData.get('csv') as File;
        
        if (!csvFile) {
            return NextResponse.json({ success: false, error: 'CSV file missing' }, { status: 400 });
        }

        const text = await csvFile.text();
        const tenantId = getTenantId(request);
        
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            return NextResponse.json({ success: false, error: 'CSV must contain headers and at least one row' }, { status: 400 });
        }

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        
        const getColumnIndex = (possibleNames: string[]) => {
            return headers.findIndex(h => possibleNames.includes(h));
        };

        const nameIdx = getColumnIndex(['nombre', 'name', 'producto']);
        const priceIdx = getColumnIndex(['precio', 'price', 'costo']);
        const stockIdx = getColumnIndex(['stock', 'cantidad', 'qty']);
        const catIdx = getColumnIndex(['categoria', 'category', 'cat']);
        const skuIdx = getColumnIndex(['sku', 'codigo', 'code', 'id']);
        const barcodeIdx = getColumnIndex(['codigobarras', 'barcode', 'ean', 'upc']);
        const estanteIdx = getColumnIndex(['estante', 'shelf']);
        const filaIdx = getColumnIndex(['fila', 'row']);

        if (nameIdx === -1) {
            return NextResponse.json({ success: false, error: 'CSV must contain a name column (nombre/name/producto)' }, { status: 400 });
        }

        const productsToCreate: any[] = [];
        const errors: any[] = [];
        let imported = 0;
        let skipped = 0;

        for (let i = 1; i < lines.length; i++) {
            const row = parseCsvLine(lines[i]);
            
            const rawName = row[nameIdx];
            const rawPrice = priceIdx !== -1 ? row[priceIdx] : '0';
            const rawStock = stockIdx !== -1 ? row[stockIdx] : '0';
            const rawCategory = catIdx !== -1 ? row[catIdx] : '';
            const rawSku = skuIdx !== -1 && row[skuIdx] ? row[skuIdx] : crypto.randomUUID();
            const rawBarcode = barcodeIdx !== -1 && row[barcodeIdx] ? row[barcodeIdx] : rawSku;
            const rawEstante = estanteIdx !== -1 && row[estanteIdx] ? row[estanteIdx] : null;
            const rawFila = filaIdx !== -1 && row[filaIdx] ? row[filaIdx] : null;

            if (!rawName) {
                errors.push({ row: i + 1, reason: 'Name is required' });
                skipped++;
                continue;
            }

            const price = parseFloat(String(rawPrice).replace(/[$,\s]/g, ''));
            if (isNaN(price) || price < 0) {
                errors.push({ row: i + 1, reason: 'Invalid price (must be >= 0)' });
                skipped++;
                continue;
            }

            const stock = parseInt(String(rawStock).replace(/,/g, ''), 10);
            if (isNaN(stock) || stock < 0) {
                errors.push({ row: i + 1, reason: 'Invalid stock (must be integer >= 0)' });
                skipped++;
                continue;
            }

            // Aislar el ID primario por tenantId cuando no es 'default' para evitar colisiones entre sucursales
            const scopedId = tenantId === 'default' || rawSku.startsWith(`${tenantId}__`)
                ? rawSku
                : `${tenantId}__${rawSku}`;

            productsToCreate.push({
                id: scopedId,
                tenantId,
                name: rawName,
                price,
                stock,
                category: rawCategory || null,
                barcode: rawBarcode || null,
                estante: rawEstante,
                fila: rawFila,
            });
        }

        const BATCH_SIZE = 100;
        for (let i = 0; i < productsToCreate.length; i += BATCH_SIZE) {
            const batch = productsToCreate.slice(i, i + BATCH_SIZE);
            try {
                await (prisma.product as any).createMany({
                    data: batch,
                    skipDuplicates: true
                });
                imported += batch.length;
            } catch {
                // Fallback a upsert individual si el motor o el mock en memoria no soporta createMany
                for (const item of batch) {
                    try {
                        await prisma.product.upsert({
                            where: { id: item.id },
                            update: item,
                            create: item
                        });
                        imported++;
                    } catch (err: any) {
                        skipped++;
                        errors.push({ row: i + 1, reason: err.message });
                    }
                }
            }
        }

        return NextResponse.json({ 
            success: true,
            imported, 
            skipped, 
            errors 
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
