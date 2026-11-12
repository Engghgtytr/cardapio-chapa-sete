// Sacola em memória: chave da linha → { id, options, qty, note }.
// O mesmo prato com opções diferentes (ex.: um bem passado, outro ao ponto) vira duas linhas.
import { priceWithOptions, selectionKey } from '../utils/options.js';

const lines = new Map();
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

export const NOTE_MAX = 140;

/** Chave da linha: o id do prato, mais as opções escolhidas quando houver. */
export const lineKey = (id, options = {}) => {
  const k = selectionKey(options);
  return k ? `${id}|${k}` : id;
};

export function addItem(id, options = {}) {
  const key = lineKey(id, options);
  const line = lines.get(key);
  lines.set(key, { id, options, qty: (line?.qty ?? 0) + 1, note: line?.note ?? '' });
  notify();
  return key;
}

// Quantidade 0 (ou menos) tira a linha da sacola.
export function setQty(key, qty) {
  const line = lines.get(key);
  if (!line) return;
  if (qty <= 0) lines.delete(key);
  else lines.set(key, { ...line, qty });
  notify();
}

export function setNote(key, note) {
  const line = lines.get(key);
  if (line) lines.set(key, { ...line, note: String(note).slice(0, NOTE_MAX) });
}

export function clearCart() {
  lines.clear();
  notify();
}

export function onCartChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Linhas com os dados do prato e o preço com as opções. Pratos que saíram do cardápio,
// esgotaram ou cujas opções mudaram (a escolha não vale mais) ficam de fora.
export function cartLines(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const result = [];
  for (const [key, { id, options, qty, note }] of lines) {
    const item = byId.get(id);
    if (!item || !item.available) continue;
    let priced;
    try {
      priced = priceWithOptions(item, options);
    } catch {
      continue;
    }
    result.push({ key, item, qty, note, options, summary: priced.summary, unitCents: priced.unitCents, subtotalCents: priced.unitCents * qty });
  }
  return result;
}

export function cartSummary(items) {
  let count = 0;
  let totalCents = 0;
  for (const line of cartLines(items)) {
    count += line.qty;
    totalCents += line.subtotalCents;
  }
  return { count, totalCents };
}
