// Preço das opções do prato: soma (adicionais), maior (meio a meio) e limites de escolha.
import { describe, it, expect } from 'vitest';
import { priceWithOptions, selectionKey, summaryText } from '../src/utils/options.js';

const pizza = {
  id: 'pizza', name: 'Pizza', price_cents: 3000,
  options: [
    { id: 'tamanho', name: 'Tamanho', min: 1, max: 1, pricing: 'soma', choices: [
      { id: 'media', name: 'Média', price_cents: 0 }, { id: 'grande', name: 'Grande', price_cents: 1500 }] },
    { id: 'sabores', name: 'Sabores', min: 1, max: 2, pricing: 'maior', choices: [
      { id: 'mussarela', name: 'Mussarela', price_cents: 0 }, { id: 'calabresa', name: 'Calabresa', price_cents: 500 },
      { id: 'camarao', name: 'Camarão', price_cents: 2000 }] },
    { id: 'borda', name: 'Borda', min: 0, max: 1, pricing: 'soma', choices: [{ id: 'catupiry', name: 'Catupiry', price_cents: 800 }] },
  ],
};

describe('priceWithOptions', () => {
  it('soma tamanho e borda; meio a meio cobra o sabor mais caro', () => {
    const r = priceWithOptions(pizza, { tamanho: ['grande'], sabores: ['mussarela', 'camarao'], borda: ['catupiry'] });
    expect(r.unitCents).toBe(3000 + 1500 + 2000 + 800);
    expect(summaryText(r.summary)).toBe('Tamanho: Grande · Sabores: Mussarela, Camarão · Borda: Catupiry');
  });

  it('opcional pode ficar vazio', () => {
    expect(priceWithOptions(pizza, { tamanho: ['media'], sabores: ['calabresa'] }).unitCents).toBe(3500);
  });

  it('recusa obrigatório faltando, escolha a mais, repetida ou inventada', () => {
    expect(() => priceWithOptions(pizza, { sabores: ['mussarela'] })).toThrow();
    expect(() => priceWithOptions(pizza, { tamanho: ['media'], sabores: ['mussarela', 'calabresa', 'camarao'] })).toThrow();
    expect(() => priceWithOptions(pizza, { tamanho: ['media'], sabores: ['mussarela', 'mussarela'] })).toThrow();
    expect(() => priceWithOptions(pizza, { tamanho: ['gigante'], sabores: ['mussarela'] })).toThrow();
    expect(() => priceWithOptions(pizza, { tamanho: ['media'], sabores: ['mussarela'], hack: ['x'] })).toThrow();
  });

  it('prato sem opções custa o preço dele', () => {
    expect(priceWithOptions({ price_cents: 1000 }).unitCents).toBe(1000);
  });
});

describe('selectionKey', () => {
  it('não depende da ordem e ignora grupo vazio', () => {
    expect(selectionKey({ b: ['y', 'x'], a: ['z'], c: [] })).toBe(selectionKey({ a: ['z'], b: ['x', 'y'] }));
    expect(selectionKey({})).toBe('');
  });
});
