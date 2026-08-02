import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

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
        const tenantId = request.headers.get('x-tenant-id') || 'default';
        
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            return NextResponse.json({ success: false, error: 'CSV must contain headers and at least one row' }, { status: 400 });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const getColumnIndex = (possibleNames: string[]) => {
            return headers.findIndex(h => possibleNames.includes(h));
        };

        const nameIdx = getColumnIndex(['nombre', 'name', 'producto']);
        const priceIdx = getColumnIndex(['precio', 'price', 'costo']);
        const stockIdx = getColumnIndex(['stock', 'cantidad', 'qty']);
        const catIdx = getColumnIndex(['categoria', 'category', 'cat']);
        const skuIdx = getColumnIndex(['sku', 'codigo', 'code']);

        if (nameIdx === -1) {
            return NextResponse.json({ success: false, error: 'CSV must contain a name column (nombre/name/producto)' }, { status: 400 });
        }

        const productsToCreate = [];
        const errors = [];
        let imported = 0;
        let skipped = 0;

        for (let i = 1; i < lines.length; i++) {
            // Split line by comma
            const row = lines[i].split(',').map(c => c.trim());
            
            const rawName = row[nameIdx];
            const rawPrice = priceIdx !== -1 ? row[priceIdx] : '0';
            const rawStock = stockIdx !== -1 ? row[stockIdx] : '0';
            const rawCategory = catIdx !== -1 ? row[catIdx] : '';
            const rawSku = skuIdx !== -1 ? row[skuIdx] : crypto.randomUUID();

            if (!rawName) {
                errors.push({ row: i + 1, reason: 'Name is required' });
                skipped++;
                continue;
            }

            const price = parseFloat(rawPrice);
            if (isNaN(price) || price < 0) {
                errors.push({ row: i + 1, reason: 'Invalid price (must be >= 0)' });
                skipped++;
                continue;
            }

            const stock = parseInt(rawStock, 10);
            if (isNaN(stock) || stock < 0) {
                errors.push({ row: i + 1, reason: 'Invalid stock (must be integer >= 0)' });
                skipped++;
                continue;
            }

            productsToCreate.push({
                id: rawSku || crypto.randomUUID(),
                tenantId: tenantId,
                name: rawName,
                price: price,
                stock: stock,
                category: rawCategory || null,
                barcode: rawSku || null,
            });
        }

        const BATCH_SIZE = 100;
        for (let i = 0; i < productsToCreate.length; i += BATCH_SIZE) {
            const batch = productsToCreate.slice(i, i + BATCH_SIZE);
            try {
                // SQLite in Prisma 5+ supports skipDuplicates
                await prisma.product.createMany({
                    data: batch,
                    skipDuplicates: true
                });
                imported += batch.length;
            } catch (e: any) {
                // Fallback loop if createMany fails (e.g. SQLite version mismatch for skipDuplicates)
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
