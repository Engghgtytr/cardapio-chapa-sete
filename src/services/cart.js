// Sacola em memória: id do prato → { qty, note }.
const lines = new Map();
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

export const NOTE_MAX = 140;

export function addItem(id) {
  const line = lines.get(id);
  lines.set(id, { qty: (line?.qty ?? 0) + 1, note: line?.note ?? '' });
  notify();
}

// Quantidade 0 (ou menos) tira o prato da sacola.
export function setQty(id, qty) {
  const line = lines.get(id);
  if (!line) return;
  if (qty <= 0) lines.delete(id);
  else lines.set(id, { ...line, qty });
  notify();
}

export function setNote(id, note) {
  const line = lines.get(id);
  if (line) lines.set(id, { ...line, note: String(note).slice(0, NOTE_MAX) });
}

export function clearCart() {
  lines.clear();
  notify();
}

export function onCartChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Linhas com os dados do prato. Pratos que saíram do cardápio ou esgotaram ficam de fora.
export function cartLines(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const result = [];
  for (const [id, { qty, note }] of lines) {
    const item = byId.get(id);
    if (!item || !item.available) continue;
    result.push({ item, qty, note, subtotalCents: item.price_cents * qty });
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
