// Preço do pedido na demonstração (igual ao banco) e validação da sacola na mesa.
import { describe, it, expect } from 'vitest';
import { priceDemoOrder } from '../src/services/orders.js';
import { validateOrder } from '../src/utils/order.js';

const menu = {
  store: { delivery_fee_cents: 600 },
  items: [
    { id: 'a', name: 'A', price_cents: 1000, active: true, available: true },
    { id: 'b', name: 'B', price_cents: 500, active: true, available: false },
  ],
};

describe('priceDemoOrder', () => {
  it('usa o preço do cardápio e soma a taxa só na entrega', () => {
    const r = priceDemoOrder({ mode: 'entrega', items: [{ id: 'a', qty: 2, price_cents: 1 }] }, menu);
    expect(r.subtotal).toBe(2000);
    expect(r.fee).toBe(600);
    expect(priceDemoOrder({ mode: 'mesa', items: [{ id: 'a', qty: 1 }] }, menu).fee).toBe(0);
  });

  it('recusa esgotado, quantidade inválida e sacola vazia', () => {
    expect(() => priceDemoOrder({ mode: 'mesa', items: [{ id: 'b', qty: 1 }] }, menu)).toThrow(/esgotar/);
    expect(() => priceDemoOrder({ mode: 'mesa', items: [{ id: 'a', qty: 0 }] }, menu)).toThrow(/quantidades/);
    expect(() => priceDemoOrder({ mode: 'mesa', items: [] }, menu)).toThrow(/quantidades/);
  });
});

describe('validateOrder na mesa', () => {
  const lines = [{ subtotalCents: 1000 }];
  it('não pede pagamento nem endereço, só o nome', () => {
    expect(validateOrder({ mode: 'mesa', name: 'Ana', payment: '' }, lines, 1000)).toEqual({});
    expect(validateOrder({ mode: 'mesa', name: '', payment: '' }, lines, 1000)).toHaveProperty('name');
  });
  it('fora da mesa, continua pedindo pagamento', () => {
    expect(validateOrder({ mode: 'retirada', name: 'Ana', payment: '' }, lines, 1000)).toHaveProperty('payment');
  });
});
