import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCustomerPurchaseEligibility,
  calculateNewRating,
  validateReviewInput,
} from './productReviews';

test('checkCustomerPurchaseEligibility detects purchase when product is in customer order', () => {
  const customer = { phone: '5512345678', name: 'Carlos Slim' };
  const orders = [
    {
      id: 'ORD-101',
      status: 'paid',
      customer: { phone: '55-1234-5678', name: 'Carlos Slim' },
      items: [
        { productId: 'prod-1', name: 'Taladro', quantity: 1, price: 1850 },
      ],
    },
  ];

  const result = checkCustomerPurchaseEligibility('prod-1', customer, orders);
  assert.equal(result.hasPurchased, true);
  assert.equal(result.orderId, 'ORD-101');
  assert.match(result.reason, /Compra verificada/);
});

test('checkCustomerPurchaseEligibility rejects if product is not in order', () => {
  const customer = { phone: '5512345678', name: 'Carlos Slim' };
  const orders = [
    {
      id: 'ORD-101',
      status: 'paid',
      customer: { phone: '55-1234-5678' },
      items: [{ productId: 'prod-99', name: 'Pintura', quantity: 1 }],
    },
  ];

  const result = checkCustomerPurchaseEligibility('prod-1', customer, orders);
  assert.equal(result.hasPurchased, false);
  assert.match(result.reason, /No encontramos compras/);
});

test('checkCustomerPurchaseEligibility rejects cancelled orders', () => {
  const customer = { phone: '5512345678' };
  const orders = [
    {
      id: 'ORD-102',
      status: 'cancelled',
      customer: { phone: '5512345678' },
      items: [{ productId: 'prod-1' }],
    },
  ];

  const result = checkCustomerPurchaseEligibility('prod-1', customer, orders);
  assert.equal(result.hasPurchased, false);
});

test('checkCustomerPurchaseEligibility requires customer session', () => {
  const result = checkCustomerPurchaseEligibility('prod-1', null, []);
  assert.equal(result.hasPurchased, false);
  assert.match(result.reason, /Debes iniciar sesión/);
});

test('calculateNewRating computes correct average with 1 decimal precision', () => {
  // Inicial: 4.8 con 32 reseñas. Nueva reseña: 5 estrellas.
  // (4.8 * 32 + 5) / 33 = (153.6 + 5) / 33 = 158.6 / 33 = 4.806 -> 4.8
  const res = calculateNewRating(4.8, 32, 5);
  assert.equal(res.reviewCount, 33);
  assert.equal(res.rating, 4.8);

  // De cero: 0 estrellas previas, primer review de 4
  const fresh = calculateNewRating(0, 0, 4);
  assert.equal(fresh.rating, 4);
  assert.equal(fresh.reviewCount, 1);

  // 1 reseña previa de 3, nueva reseña de 5 -> (3 + 5) / 2 = 4.0
  const two = calculateNewRating(3, 1, 5);
  assert.equal(two.rating, 4.0);
  assert.equal(two.reviewCount, 2);
});

test('validateReviewInput checks bounds and length', () => {
  assert.equal(validateReviewInput(5, 'Excelente taladro con gran potencia').valid, true);
  assert.equal(validateReviewInput(0, 'Muy malo').valid, false);
  assert.equal(validateReviewInput(6, 'Demasiado bueno').valid, false);
  assert.equal(validateReviewInput(4, 'Ok').valid, false); // < 3 chars
  assert.equal(validateReviewInput(4, '').valid, true); // rating only is allowed
});
