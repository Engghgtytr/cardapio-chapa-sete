import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem, cartSummary, clearCart, onCartChange } from '../src/services/cart.js';
import { DEMO_ITEMS } from '../src/data/demo-menu.js';
import { formatCents } from '../src/utils/money.js';

describe('sacola', () => {
  beforeEach(() => clearCart());

  it('começa vazia', () => {
    expect(cartSummary(DEMO_ITEMS)).toEqual({ count: 0, totalCents: 0 });
  });

  it('soma quantidade e total em centavos', () => {
    addItem('burger-classico'); // 29,90
    addItem('burger-classico');
    addItem('refrigerante'); // 7,90
    expect(cartSummary(DEMO_ITEMS)).toEqual({ count: 3, totalCents: 6770 });
  });

  it('ignora prato que saiu do cardápio', () => {
    addItem('nao-existe');
    expect(cartSummary(DEMO_ITEMS).count).toBe(0);
  });

  it('avisa quem está ouvindo', () => {
    const fn = vi.fn();
    const off = onCartChange(fn);
    addItem('cookie');
    off();
    addItem('cookie');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('formatCents', () => {
  it('formata em reais', () => {
    expect(formatCents(6770).replace(/\s/g, ' ')).toBe('R$ 67,70');
  });
});
