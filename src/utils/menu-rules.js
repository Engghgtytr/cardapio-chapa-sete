// Validação dos formulários do painel. As mesmas regras existem no banco
// (supabase/migrations/001_cardapio.sql); aqui elas servem para mostrar o erro
// no campo certo antes de enviar.
import { clean, parseMoney } from './order.js';

export const ITEM_LIMITS = { name: 60, description: 160 };
export const MAX_PRICE_CENTS = 100000; // R$ 1.000,00
export const MAX_FEE_CENTS = 10000; // R$ 100,00

// Devolve { errors, value }. errors vazio = pode salvar.
export function validateItem(form, categories) {
  const errors = {};
  const name = clean(form.name, ITEM_LIMITS.name + 1);
  const description = clean(form.description, ITEM_LIMITS.description + 1);
  const price = parseMoney(form.price);

  if (!name) errors.name = 'Informe o nome do prato.';
  else if (name.length > ITEM_LIMITS.name) errors.name = `Use até ${ITEM_LIMITS.name} caracteres.`;
  if (description.length > ITEM_LIMITS.description) errors.description = `Use até ${ITEM_LIMITS.description} caracteres.`;
  if (price === null) errors.price = 'Use um valor como 29,90.';
  else if (price < 1 || price > MAX_PRICE_CENTS) errors.price = 'O preço precisa ficar entre R$ 0,01 e R$ 1.000,00.';
  if (!categories.some((c) => c.id === form.category_id)) errors.category_id = 'Escolha a categoria.';

  return {
    errors,
    value: {
      name,
      description,
      price_cents: price,
      category_id: form.category_id,
      active: Boolean(form.active),
      available: Boolean(form.available),
    },
  };
}

// "(11) 91234-5678" → "5511912345678". Vazio = sem WhatsApp (null).
export function normalizeWhatsapp(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  if (!digits) return { value: null };
  const full = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  if (!/^55\d{10,11}$/.test(full)) return { error: 'Use DDD + número, como (11) 91234-5678.' };
  return { value: full };
}

// "5511912345678" → "(11) 91234-5678", para mostrar no campo.
export function formatWhatsapp(value) {
  const m = String(value ?? '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : '';
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// form.hours: { 0: { open, from, to }, ... } → { 0: ['18:00', '23:30'] | null, ... }
export function validateStore(form) {
  const errors = {};
  const whatsapp = normalizeWhatsapp(form.whatsapp);
  if (whatsapp.error) errors.whatsapp = whatsapp.error;

  let fee = 0;
  if (String(form.fee ?? '').trim()) {
    fee = parseMoney(form.fee);
    if (fee === null) errors.fee = 'Use um valor como 6,00 (ou deixe 0).';
    else if (fee > MAX_FEE_CENTS) errors.fee = 'A taxa pode ser de até R$ 100,00.';
  }

  const address = clean(form.address, 161);
  if (address.length > 160) errors.address = 'Use até 160 caracteres.';

  const hours = {};
  for (let day = 0; day < 7; day++) {
    const h = form.hours?.[day] ?? {};
    if (!h.open) {
      hours[day] = null;
      continue;
    }
    if (!TIME.test(h.from ?? '') || !TIME.test(h.to ?? '')) errors[`hours-${day}`] = 'Preencha a abertura e o fechamento.';
    else if (h.from >= h.to) errors[`hours-${day}`] = 'O fechamento precisa ser depois da abertura.';
    hours[day] = [h.from, h.to];
  }

  return { errors, value: { whatsapp: whatsapp.value ?? null, delivery_fee_cents: fee, address, hours } };
}

// "Clássico Smash!" → "classico-smash-k3f9". O final aleatório evita repetir um id.
export function slugify(name) {
  const base = String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const tail = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${base || 'prato'}-${tail}`;
}
