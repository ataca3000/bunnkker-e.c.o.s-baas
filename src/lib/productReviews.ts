/**
 * productReviews.ts — Módulo desacoplado de lógica pura para reseñas de clientes
 * Maneja la verificación de compra para poder calificar, cálculo de promedios
 * y persistencia dual (local-first + cloud) con distintivo de comprador verificado.
 */

export interface ProductReview {
  id: string;
  productId: string;
  customerName: string;
  customerPhone?: string;
  rating: number; // 1 to 5
  comment: string;
  date: string; // ISO
  verifiedPurchase: boolean;
  orderId?: string;
}

export interface PurchaseEligibilityResult {
  hasPurchased: boolean;
  orderId?: string;
  reason: string;
}

/**
 * Normaliza teléfonos o identificadores para comparación robusta.
 */
function cleanIdentifier(id?: string | null): string {
  if (!id) return '';
  return String(id).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Comprueba si un cliente ha comprado previamente un producto específico
 * a partir de su perfil y el listado de órdenes del sistema.
 */
export function checkCustomerPurchaseEligibility(
  productId: string,
  customer: { phone?: string; id?: string; email?: string; name?: string } | null,
  orders: any[] = []
): PurchaseEligibilityResult {
  if (!productId) {
    return {
      hasPurchased: false,
      reason: 'ID de producto inválido.',
    };
  }

  // Si no hay cliente autenticado ni perfil
  if (!customer || (!customer.phone && !customer.id && !customer.email)) {
    return {
      hasPurchased: false,
      reason: 'Debes iniciar sesión con tu cuenta de cliente para verificar tus compras.',
    };
  }

  const cleanPhone = cleanIdentifier(customer.phone);
  const cleanId = cleanIdentifier(customer.id);
  const cleanEmail = cleanIdentifier(customer.email);

  // Estados de orden que confirman una compra efectiva o en proceso
  const VALID_PURCHASE_STATUSES = [
    'paid',
    'COMPLETED',
    'DELIVERED',
    'READY_FOR_PICKUP_PAID',
    'OUT_FOR_DELIVERY',
    'claimed',
    'pending_payment',
    'READY_TO_SHIP',
    'READY_FOR_PICKUP',
    'PREPARANDO',
  ];

  for (const order of orders) {
    if (!order) continue;

    // Verificar si el estado de la orden es válido (no cancelada ni rechazada)
    if (order.status === 'cancelled' || order.status === 'rejected') {
      continue;
    }

    // Verificar si la orden pertenece a este cliente
    const orderPhone = cleanIdentifier(order.customer?.phone || order.customerEmail || order.phone);
    const orderCustomerId = cleanIdentifier(order.customerId || order.customer?.id);
    const orderEmail = cleanIdentifier(order.customerEmail || order.customer?.email);

    const matchesClient =
      (cleanPhone && orderPhone && (orderPhone.includes(cleanPhone) || cleanPhone.includes(orderPhone))) ||
      (cleanId && orderCustomerId && cleanId === orderCustomerId) ||
      (cleanEmail && orderEmail && cleanEmail === orderEmail);

    if (!matchesClient) continue;

    // Verificar si el producto está en los items de la orden
    const items = order.items || [];
    const hasItem = items.some((it: any) => {
      const itId = it.productId || it.id;
      return itId === productId;
    });

    if (hasItem) {
      return {
        hasPurchased: true,
        orderId: order.id,
        reason: '¡Compra verificada! Tu orden anterior califica para opinar sobre este producto.',
      };
    }
  }

  return {
    hasPurchased: false,
    reason: 'No encontramos compras previas de este producto en tu cuenta. Solo clientes con compra verificada pueden calificar.',
  };
}

/**
 * Calcula el nuevo promedio de calificación (rating) y el nuevo recuento de opiniones.
 */
export function calculateNewRating(
  currentRating: number = 0,
  currentCount: number = 0,
  newScore: number
): { rating: number; reviewCount: number } {
  const validScore = Math.max(1, Math.min(5, Math.round(newScore)));
  const count = Math.max(0, currentCount);

  if (count === 0 || currentRating <= 0) {
    return {
      rating: validScore,
      reviewCount: 1,
    };
  }

  const totalPoints = currentRating * count + validScore;
  const newCount = count + 1;
  const rawAverage = totalPoints / newCount;
  // Redondear a 1 decimal
  const rounded = Math.round(rawAverage * 10) / 10;

  return {
    rating: rounded,
    reviewCount: newCount,
  };
}

/**
 * Valida los datos de entrada para publicar una reseña.
 */
export function validateReviewInput(
  rating: number,
  comment: string
): { valid: boolean; error?: string } {
  if (typeof rating !== 'number' || isNaN(rating) || rating < 1 || rating > 5) {
    return {
      valid: false,
      error: 'Por favor selecciona una puntuación entre 1 y 5 estrellas.',
    };
  }

  const trimmed = (comment || '').trim();
  if (trimmed.length > 0 && trimmed.length < 3) {
    return {
      valid: false,
      error: 'La reseña debe tener al menos 3 caracteres.',
    };
  }

  if (trimmed.length > 500) {
    return {
      valid: false,
      error: 'La reseña no debe exceder los 500 caracteres.',
    };
  }

  return { valid: true };
}

/**
 * Obtiene las reseñas locales guardadas en el almacenamiento del navegador.
 */
export function getStoredLocalReviews(productId: string): ProductReview[] {
  if (typeof window === 'undefined' || !productId) return [];
  try {
    const raw = localStorage.getItem(`_bunkker_reviews_${productId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Guarda una nueva reseña localmente y la añade a la lista existente.
 */
export function saveStoredLocalReview(review: ProductReview): ProductReview[] {
  if (typeof window === 'undefined' || !review || !review.productId) return [];
  try {
    const current = getStoredLocalReviews(review.productId);
    const updated = [review, ...current.filter((r) => r.id !== review.id)];
    localStorage.setItem(`_bunkker_reviews_${review.productId}`, JSON.stringify(updated));
    return updated;
  } catch {
    return [review];
  }
}
