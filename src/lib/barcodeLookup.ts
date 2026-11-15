export function normalizeBarcodeToken(raw: unknown): string {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  return String(raw)
    .trim()
    .replace(/[\r\n\t\s]+/g, '')
    .toLowerCase();
}

export function expandBarcodeEquivalents(raw: unknown): string[] {
  const token = normalizeBarcodeToken(raw);
  if (!token) return [];

  const variants = new Set<string>([token]);

  // Equivalencia estándar EAN-13 (13 dígitos con 0 inicial) <-> UPC-A (12 dígitos)
  if (/^\d{12}$/.test(token)) {
    variants.add(`0${token}`);
  } else if (/^0\d{12}$/.test(token)) {
    variants.add(token.slice(1));
  }

  // Equivalencia numérica sin ceros iniciales si tiene >= 6 dígitos
  if (/^\d{6,14}$/.test(token)) {
    const stripped = token.replace(/^0+/, '');
    if (stripped.length >= 6) {
      variants.add(stripped);
    }
  }

  return Array.from(variants);
}

export function barcodeMatches(candidate: unknown, query: unknown): boolean {
  const queryVariants = expandBarcodeEquivalents(query);
  if (queryVariants.length === 0) return false;
  const candidateVariants = expandBarcodeEquivalents(candidate);
  if (candidateVariants.length === 0) return false;

  return queryVariants.some((qv) => candidateVariants.includes(qv));
}

export function findProductByBarcodeOrCode<
  T extends { id: string; barcode?: string | null; name?: string | null }
>(products: T[], rawCode: unknown): T | undefined {
  const normalized = normalizeBarcodeToken(rawCode);
  if (!normalized || !Array.isArray(products) || products.length === 0) {
    return undefined;
  }

  // 1. Coincidencia exacta o equivalente EAN-13/UPC-A por código de barras original
  const byBarcode = products.find((p) => barcodeMatches(p.barcode, normalized));
  if (byBarcode) return byBarcode;

  // 2. Coincidencia exacta por ID interno
  const byId = products.find((p) => normalizeBarcodeToken(p.id) === normalized);
  if (byId) return byId;

  return undefined;
}

function normalizeSearchText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesProductSearch(
  product: {
    id: string;
    name?: string | null;
    barcode?: string | null;
    description?: string | null;
    category?: string | null;
    estante?: string | null;
    fila?: string | null;
    location?: { estante?: string; fila?: string } | null;
  },
  rawQuery: string
): boolean {
  const cleanQuery = (rawQuery || '').trim();
  if (!cleanQuery) return true;

  // Coincidencia directa o equivalente EAN-13 / UPC-A por escáner de código de barras
  if (barcodeMatches(product.barcode, cleanQuery) || normalizeBarcodeToken(product.id) === normalizeBarcodeToken(cleanQuery)) {
    return true;
  }

  const tokens = normalizeSearchText(cleanQuery).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const fields = [
    product.id,
    product.name,
    product.category,
    product.barcode,
    product.description,
    product.estante,
    product.fila,
    product.location?.estante,
    product.location?.fila,
  ].map(normalizeSearchText);

  return tokens.every((token) => fields.some((field) => field.includes(token)));
}
