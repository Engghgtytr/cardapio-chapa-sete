// Pedidos pelo site. Mesma interface nos dois modos:
//   - Supabase: o pedido passa pela função fazer_pedido (o preço é calculado no banco)
//     e a cozinha recebe em tempo real.
//   - Demonstração: os pedidos ficam no navegador (localStorage) e outras abas do mesmo
//     aparelho (ex.: a "cozinha" aberta ao lado) recebem na hora.
import { supabase } from './supabase.js';
import { readDemoData } from './demo-data.js';

export const STATUS = {
  novo: 'Recebido',
  preparando: 'Preparando',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
export const NEXT = { novo: 'preparando', preparando: 'pronto', pronto: 'entregue' };
export const OPEN = ['novo', 'preparando', 'pronto'];

const ERRORS = {
  pedidos_desligados: 'Esta loja não está recebendo pedidos pelo site agora. Fale com o atendente.',
  item_indisponivel: 'Algum item acabou de esgotar. Confira a sacola e tente de novo.',
  itens_invalidos: 'Algo na sacola ficou inválido. Confira as quantidades e tente de novo.',
  muitos_pedidos: 'Você fez muitos pedidos em pouco tempo. Espere alguns minutos ou fale com o atendente.',
};

function toOrderError(error) {
  console.error(error);
  const key = Object.keys(ERRORS).find((k) => String(error?.message).includes(k));
  if (key) return new Error(ERRORS[key]);
  if (String(error?.message).includes('fetch')) return new Error('Sem conexão. Verifique a internet e tente de novo.');
  return new Error('Não foi possível enviar o pedido. Tente de novo.');
}

// ---------- Demonstração (localStorage) ----------

const DEMO_KEY = 'chapa7:demo-orders';
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('chapa7-orders') : null;

function readDemo() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY)) ?? [];
  } catch {
    return [];
  }
}

function writeDemo(orders) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(orders.slice(-100)));
  } catch {
    throw new Error('O navegador não deixou salvar o pedido. Saia da aba anônima e tente de novo.');
  }
  channel?.postMessage('mudou');
}

// Igual à função fazer_pedido do banco: o preço sai do cardápio, não do que a tela mandou.
export function priceDemoOrder(input, { store, items }) {
  const byId = new Map(items.filter((i) => i.active && i.available).map((i) => [i.id, i]));
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) throw new Error(ERRORS.itens_invalidos);
  const lines = input.items.map(({ id, qty, note }) => {
    const item = byId.get(id);
    if (!item) throw new Error(ERRORS.item_indisponivel);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error(ERRORS.itens_invalidos);
    return { id, name: item.name, qty, price_cents: item.price_cents, note: String(note ?? '').trim().slice(0, 140) || null };
  });
  const subtotal = lines.reduce((s, l) => s + l.price_cents * l.qty, 0);
  const fee = input.mode === 'entrega' ? store.delivery_fee_cents : 0;
  return { lines, subtotal, fee };
}

function placeDemo(input) {
  const menu = readDemoData();
  const { lines, subtotal, fee } = priceDemoOrder(input, menu);
  const orders = readDemo();
  const today = new Date().toDateString();
  const code = orders.filter((o) => new Date(o.created_at).toDateString() === today).length + 1;
  const order = {
    id: crypto.randomUUID(),
    code,
    mode: input.mode,
    table_label: input.mode === 'mesa' ? input.table : null,
    customer_name: input.name,
    address: input.mode === 'entrega' ? input.address : null,
    payment: input.mode === 'mesa' ? null : input.payment,
    change_cents: input.mode !== 'mesa' && input.payment === 'dinheiro' ? input.change_cents : null,
    items: lines,
    subtotal_cents: subtotal,
    fee_cents: fee,
    total_cents: subtotal + fee,
    status: 'novo',
    created_at: new Date().toISOString(),
  };
  writeDemo([...orders, order]);
  return { id: order.id, code };
}

// ---------- Cliente ----------

// input: { mode, table, name, address, payment, change_cents, items: [{ id, qty, note }] }
export async function placeOrder(input) {
  if (!supabase) return placeDemo(input);
  const { data, error } = await supabase.rpc('fazer_pedido', {
    p_mode: input.mode,
    p_table: input.table ?? null,
    p_name: input.name,
    p_address: input.address ?? null,
    p_payment: input.payment ?? null,
    p_change_cents: input.change_cents ?? null,
    p_items: input.items,
  });
  if (error) throw toOrderError(error);
  return data[0];
}

// O que o cliente vê do próprio pedido (sem nome nem endereço). null = não achou.
export async function getOrderStatus(id) {
  if (!supabase) return readDemo().find((o) => o.id === id) ?? null;
  const { data, error } = await supabase.rpc('ver_pedido', { p_id: id });
  if (error) throw toOrderError(error);
  return data[0] ?? null;
}

// ---------- Cozinha ----------

// Pedidos de hoje que ainda não saíram, mais antigos primeiro.
export async function listOpenOrders() {
  if (!supabase) return readDemo().filter((o) => OPEN.includes(o.status));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', OPEN)
    .gte('created_at', since.toISOString())
    .order('created_at');
  if (error) throw toOrderError(error);
  return data;
}

// Resumo do dia: quantos pedidos e quanto vendeu (cancelados fora).
export async function todaySummary() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  let rows;
  if (!supabase) rows = readDemo().filter((o) => new Date(o.created_at) >= since);
  else {
    const { data, error } = await supabase.from('orders').select('total_cents, status').gte('created_at', since.toISOString());
    if (error) throw toOrderError(error);
    rows = data;
  }
  const valid = rows.filter((o) => o.status !== 'cancelado');
  return { count: valid.length, totalCents: valid.reduce((s, o) => s + o.total_cents, 0) };
}

export async function setOrderStatus(id, status) {
  if (!supabase) {
    const orders = readDemo();
    const order = orders.find((o) => o.id === id);
    if (!order) throw new Error('Este pedido não existe mais.');
    order.status = status;
    writeDemo(orders);
    return;
  }
  const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select('id');
  if (error) throw toOrderError(error);
  if (!data.length) throw new Error('Sua sessão expirou ou esta conta não tem permissão. Entre de novo.');
}

// Avisa quando algum pedido muda. Devolve a função para parar de ouvir.
export function onOrdersChange(fn) {
  if (!supabase) {
    const onStorage = (e) => e.key === DEMO_KEY && fn();
    const onMessage = () => fn();
    window.addEventListener('storage', onStorage);
    channel?.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.removeEventListener('message', onMessage);
    };
  }
  const sub = supabase
    .channel('pedidos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fn())
    .subscribe();
  return () => supabase.removeChannel(sub);
}

export function clearDemoOrders() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    // nada a fazer
  }
  channel?.postMessage('mudou');
}
