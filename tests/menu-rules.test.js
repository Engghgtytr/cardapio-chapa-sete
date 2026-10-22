import { describe, it, expect } from 'vitest';
import { formatWhatsapp, normalizeWhatsapp, slugify, validateItem, validateStore } from '../src/utils/menu-rules.js';

const CATS = [{ id: 'burgers' }, { id: 'bebidas' }];
const item = (over = {}) => ({ name: 'Duplo', description: '', price: '39,90', category_id: 'burgers', active: true, available: true, ...over });

describe('validateItem', () => {
  it('aceita um prato válido e converte o preço para centavos', () => {
    const { errors, value } = validateItem(item(), CATS);
    expect(errors).toEqual({});
    expect(value).toMatchObject({ name: 'Duplo', price_cents: 3990, category_id: 'burgers' });
  });

  it('aponta o campo certo em cada erro', () => {
    expect(validateItem(item({ name: '  ' }), CATS).errors).toHaveProperty('name');
    expect(validateItem(item({ name: 'a'.repeat(61) }), CATS).errors).toHaveProperty('name');
    expect(validateItem(item({ description: 'a'.repeat(161) }), CATS).errors).toHaveProperty('description');
    expect(validateItem(item({ price: 'abc' }), CATS).errors).toHaveProperty('price');
    expect(validateItem(item({ price: '0' }), CATS).errors).toHaveProperty('price');
    expect(validateItem(item({ price: '1.000,01' }), CATS).errors).toHaveProperty('price');
    expect(validateItem(item({ category_id: 'nao-existe' }), CATS).errors).toHaveProperty('category_id');
  });

  it('limpa quebras de linha e espaços extras do nome', () => {
    expect(validateItem(item({ name: ' Duplo\n  Smash ' }), CATS).value.name).toBe('Duplo Smash');
  });
});

describe('WhatsApp', () => {
  it('aceita o número como a pessoa digita e guarda só os dígitos com 55', () => {
    expect(normalizeWhatsapp('(11) 91234-5678')).toEqual({ value: '5511912345678' });
    expect(normalizeWhatsapp('+55 11 91234-5678')).toEqual({ value: '5511912345678' });
    expect(normalizeWhatsapp('(55) 91234-5678')).toEqual({ value: '5555912345678' }); // DDD 55 (RS)
    expect(normalizeWhatsapp('')).toEqual({ value: null });
  });

  it('recusa número curto demais', () => {
    expect(normalizeWhatsapp('91234-5678').error).toBeTruthy();
  });

  it('mostra o número salvo de volta no formato do campo', () => {
    expect(formatWhatsapp('5511912345678')).toBe('(11) 91234-5678');
    expect(formatWhatsapp(null)).toBe('');
  });
});

describe('validateStore', () => {
  const week = (over = {}) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { open: d !== 1, from: '18:00', to: '23:30', ...over[d] }]));

  it('monta o horário no formato do banco', () => {
    const { errors, value } = validateStore({ whatsapp: '', fee: '6,00', address: 'Rua A', hours: week() });
    expect(errors).toEqual({});
    expect(value).toMatchObject({ whatsapp: null, delivery_fee_cents: 600 });
    expect(value.hours[1]).toBeNull();
    expect(value.hours[2]).toEqual(['18:00', '23:30']);
  });

  it('taxa vazia vira zero', () => {
    expect(validateStore({ fee: '', hours: week() }).value.delivery_fee_cents).toBe(0);
  });

  it('recusa fechar antes de abrir e taxa inválida', () => {
    const { errors } = validateStore({ fee: 'muito', hours: week({ 3: { from: '23:00', to: '18:00' } }) });
    expect(errors).toHaveProperty('fee');
    expect(errors).toHaveProperty('hours-3');
  });
});

describe('slugify', () => {
  it('gera um id seguro para o banco a partir do nome', () => {
    const id = slugify('Clássico Smash à Moda!');
    expect(id).toMatch(/^classico-smash-a-moda-[a-z0-9]{4}$/);
    expect(slugify('***')).toMatch(/^prato-[a-z0-9]{4}$/);
  });
});
