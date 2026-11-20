import { describe, expect, it } from 'vitest';
import { validateLocalProductInput, validateLocalStaffInput } from '../lib/standaloneLocalStore';

describe('validaciones del modo autónomo local', () => {
  it('acepta producto con precio y existencia válidos', () => {
    expect(() => validateLocalProductInput({ name: 'Tornillo', price: 2.5, stock: 12 })).not.toThrow();
  });

  it.each([
    { name: '   ', price: 1, stock: 1 },
    { name: 'Tornillo', price: Number.NaN, stock: 1 },
    { name: 'Tornillo', price: -1, stock: 1 },
    { name: 'Tornillo', price: 1, stock: -1 },
    { name: 'Tornillo', price: 1, stock: 1.5 },
  ])('rechaza producto inválido: $name / $price / $stock', input => {
    expect(() => validateLocalProductInput(input)).toThrow('Revisa nombre, precio y existencia del producto.');
  });

  it('exige nombre y PIN numérico de 4 a 8 dígitos para el personal', () => {
    expect(() => validateLocalStaffInput('Alex', '1234')).not.toThrow();
    expect(() => validateLocalStaffInput('Alex', '12ab')).toThrow();
    expect(() => validateLocalStaffInput('Alex', '123')).toThrow();
    expect(() => validateLocalStaffInput(' ', '1234')).toThrow();
  });
});
