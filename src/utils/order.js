// Pedido: validação do formulário da sacola e montagem da mensagem do WhatsApp.
// Nada disso é salvo: o nome e o endereço vão direto na mensagem.
import { formatCents } from './money.js';

export const PAYMENTS = { pix: 'Pix', cartao: 'Cartão (na entrega ou retirada)', dinheiro: 'Dinheiro' };
export const LIMITS = { name: 60, address: 160 };

// Tira quebras de linha e caracteres de controle: cada campo vira uma linha só na mensagem.
export const clean = (value, max = 200) =>
  String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// "100", "100,50", "R$ 1.000,00" → centavos. Texto inválido → null.
export function parseMoney(text) {
  const raw = String(text ?? '').replace(/R\$|\s/g, '');
  if (!raw) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(raw)) return null;
  const [int, dec = ''] = raw.replace(/\./g, '').split(',');
  return Number(int) * 100 + Number(dec.padEnd(2, '0'));
}

export function orderTotals(lines, mode, deliveryFeeCents) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.subtotalCents, 0);
  const feeCents = mode === 'entrega' ? deliveryFeeCents : 0;
  return { subtotalCents, feeCents, totalCents: subtotalCents + feeCents };
}

// Devolve { campo: mensagem }. Objeto vazio = pode enviar.
export function validateOrder(form, lines, totalCents) {
  const errors = {};
  if (lines.length === 0) errors.cart = 'Adicione pelo menos um item.';
  if (!clean(form.name)) errors.name = 'Informe seu nome.';
  if (form.mode === 'entrega' && !clean(form.address)) errors.address = 'Informe o endereço de entrega.';
  if (!PAYMENTS[form.payment]) errors.payment = 'Escolha a forma de pagamento.';
  if (form.payment === 'dinheiro' && String(form.change ?? '').trim()) {
    const change = parseMoney(form.change);
    if (change === null) errors.change = 'Use um valor como 100 ou 100,00.';
    else if (change < totalCents) errors.change = `O troco precisa ser para ${formatCents(totalCents)} ou mais.`;
  }
  return errors;
}

export function buildOrderMessage({ storeName, lines, form, deliveryFeeCents }) {
  const { subtotalCents, feeCents, totalCents } = orderTotals(lines, form.mode, deliveryFeeCents);
  const out = [`*Novo pedido · ${storeName}*`, ''];

  for (const l of lines) {
    out.push(`${l.qty}x ${l.item.name} · ${formatCents(l.subtotalCents)}`);
    const note = clean(l.note, 140);
    if (note) out.push(`   Obs.: ${note}`);
  }

  out.push('', `Subtotal: ${formatCents(subtotalCents)}`);
  if (form.mode === 'entrega') out.push(`Taxa de entrega: ${formatCents(feeCents)}`);
  out.push(`*Total: ${formatCents(totalCents)}*`, '');

  out.push(`Nome: ${clean(form.name, LIMITS.name)}`);
  out.push(form.mode === 'entrega' ? `Entrega em: ${clean(form.address, LIMITS.address)}` : 'Retirada no balcão');

  let payment = PAYMENTS[form.payment];
  const change = form.payment === 'dinheiro' ? parseMoney(form.change) : null;
  if (change) payment += ` (troco para ${formatCents(change)})`;
  out.push(`Pagamento: ${payment}`);

  return out.join('\n');
}

// Link do WhatsApp com a mensagem pronta. O texto passa por encodeURIComponent para
// acentos, quebras de linha, "&" e "#" chegarem certos.
export function whatsappUrl(phone, message) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 12) return null; // 55 + DDD + número
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
