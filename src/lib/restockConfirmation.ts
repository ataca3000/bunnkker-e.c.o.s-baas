export interface RestockValidationSuccess {
    valid: true;
    qty: number;
    previousStock: number;
    resultingStock: number;
}

export interface RestockValidationError {
    valid: false;
    reason: 'EMPTY' | 'INVALID_NUMBER' | 'DECIMAL_NOT_ALLOWED' | 'MISMATCH';
    message: string;
}

export type RestockValidationResult = RestockValidationSuccess | RestockValidationError;

export interface RestockAuditEntry {
    id: string;
    timestamp: string;
    productId: string;
    productName: string;
    unitType: string;
    previousStock: number | null;
    addedQty: number | null;
    newStock: number | null;
    minStock: number | null;
    estante: string;
    fila: string;
    operatorUid: string;
    operatorName: string;
    operatorRole: string;
    notes: string;
    doubleConfirmed: boolean;
}

export function validateRestockPiecesInput(
    qtyInput: string | number,
    confirmQtyInput: string | number,
    options?: { allowDecimal?: boolean; currentStock?: number }
): RestockValidationResult {
    const rawQty = String(qtyInput ?? '').trim();
    const rawConfirm = String(confirmQtyInput ?? '').trim();
    const currentStock = Number(options?.currentStock ?? 0) || 0;
    const allowDecimal = Boolean(options?.allowDecimal);

    if (!rawQty) {
        return {
            valid: false,
            reason: 'EMPTY',
            message: 'Ingresa el número de piezas a agregar.',
        };
    }

    const qty = Number(rawQty);
    if (!Number.isFinite(qty) || qty <= 0) {
        return {
            valid: false,
            reason: 'INVALID_NUMBER',
            message: 'La cantidad a agregar debe ser mayor a 0.',
        };
    }

    if (!allowDecimal && !Number.isInteger(qty)) {
        return {
            valid: false,
            reason: 'DECIMAL_NOT_ALLOWED',
            message: 'Este producto se maneja por piezas enteras. Ingresa un número entero.',
        };
    }

    if (!rawConfirm) {
        return {
            valid: false,
            reason: 'MISMATCH',
            message: 'Confirma el número de piezas a agregar escribiéndolo nuevamente.',
        };
    }

    const confirmQty = Number(rawConfirm);
    if (!Number.isFinite(confirmQty) || Math.abs(qty - confirmQty) > 0.0001) {
        return {
            valid: false,
            reason: 'MISMATCH',
            message: `Las cantidades no coinciden (${rawQty} vs ${rawConfirm}). Deben ser idénticas.`,
        };
    }

    const resultingStock = Number((currentStock + qty).toFixed(allowDecimal ? 3 : 0));
    return {
        valid: true,
        qty,
        previousStock: currentStock,
        resultingStock,
    };
}

export function getRestockMismatchFeedback(
    mismatchCount: number,
    qtyInput: string,
    confirmQtyInput: string
): string {
    const q = qtyInput.trim() || '0';
    const c = confirmQtyInput.trim() || '0';
    if (mismatchCount <= 1) {
        return `Error 1: Las piezas no coinciden (${q} vs ${c}). Escríbelo idéntico dos veces.`;
    }
    if (mismatchCount === 2) {
        return `Error 2: Siguen sin coincidir (${q} vs ${c}). Verifica el conteo físico antes de guardar.`;
    }
    return `Intento fallido (${q} vs ${c}). Cuando ambos números sean idénticos se guardará la recarga.`;
}

export function parseRestockAuditRow(row: {
    id: string;
    timestamp?: Date | string;
    userId?: string;
    action?: string;
    details?: string | null;
}): RestockAuditEntry {
    const ts = row.timestamp instanceof Date
        ? row.timestamp.toISOString()
        : String(row.timestamp || new Date().toISOString());

    const rawDetails = String(row.details || '').trim();
    if (rawDetails.startsWith('{')) {
        try {
            const parsed = JSON.parse(rawDetails);
            return {
                id: String(row.id),
                timestamp: ts,
                productId: String(parsed.productId || ''),
                productName: String(parsed.productName || 'Producto'),
                unitType: String(parsed.unitType || 'PZA'),
                previousStock: typeof parsed.previousStock === 'number' ? parsed.previousStock : null,
                addedQty: typeof parsed.addedQty === 'number' ? parsed.addedQty : null,
                newStock: typeof parsed.newStock === 'number' ? parsed.newStock : null,
                minStock: typeof parsed.minStock === 'number' ? parsed.minStock : null,
                estante: String(parsed.estante || ''),
                fila: String(parsed.fila || ''),
                operatorUid: String(parsed.operatorUid || row.userId || 'SYSTEM'),
                operatorName: String(parsed.operatorName || row.userId || 'Operador'),
                operatorRole: String(parsed.operatorRole || 'inventory'),
                notes: String(parsed.notes || ''),
                doubleConfirmed: Boolean(parsed.doubleConfirmed),
            };
        } catch {
            // Fallback below for non-JSON descriptions
        }
    }

    return {
        id: String(row.id),
        timestamp: ts,
        productId: '',
        productName: rawDetails || 'Movimiento de stock',
        unitType: 'PZA',
        previousStock: null,
        addedQty: null,
        newStock: null,
        minStock: null,
        estante: '',
        fila: '',
        operatorUid: String(row.userId || 'SYSTEM'),
        operatorName: String(row.userId || 'Operador'),
        operatorRole: 'inventory',
        notes: rawDetails,
        doubleConfirmed: false,
    };
}
