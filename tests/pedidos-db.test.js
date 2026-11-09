// Pedidos pelo site (004_pedidos.sql) num PostgreSQL embutido: preço vem do banco,
// visitante não lê pedidos dos outros e a cozinha só avança o status.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DONO = '00000000-0000-0000-0000-0000000000d0';
const CLIENTE = '00000000-0000-0000-0000-0000000000c1';

let db;

async function as(userId, query, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query(query, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}
const asOwner = async (query, params = []) => {
  await db.exec('reset role');
  return (await db.query(query, params)).rows;
};

const FAZER = 'select * from public.fazer_pedido($1, $2, $3, $4, $5, $6, $7::jsonb)';
// Cada pedido vem de um "aparelho" diferente, a não ser no teste do freio contra spam.
let n = 0;
let fixo = false;
const pedido = async (who, { mode = 'retirada', table = null, name = 'Ana', address = null, payment = 'pix', change = null, items }) => {
  if (!fixo) await asOwner(`select set_config('request.headers', $1, false)`, [JSON.stringify({ 'cf-connecting-ip': `10.0.0.${++n}` })]);
  return as(who, FAZER, [mode, table, name, address, payment, change, JSON.stringify(items)]);
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql('../supabase/tests/supabase-stub.sql'));
  await db.exec(sql('../supabase/migrations/001_cardapio.sql'));
  await db.exec(sql('../supabase/migrations/003_seed.sql'));
  await db.exec(sql('../supabase/migrations/004_pedidos.sql'));
  await asOwner(`insert into auth.users (id, email) values ($1, 'dono@exemplo.com'), ($2, 'cliente@exemplo.com')`, [DONO, CLIENTE]);
  await asOwner('insert into public.admins (user_id) values ($1)', [DONO]);
}, 30000);

describe('pedidos desligados', () => {
  it('não aceita pedido enquanto a loja não liga os pedidos pelo site', async () => {
    await expect(pedido(null, { items: [{ id: 'burger-classico', qty: 1 }] })).rejects.toThrow(/pedidos_desligados/);
  });
});

describe('fazer pedido (visitante)', () => {
  beforeAll(() => asOwner('update public.store_settings set online_orders = true'));

  it('calcula o preço pelo banco e ignora preço mandado pelo navegador', async () => {
    const [{ id, code }] = await pedido(null, { items: [{ id: 'burger-classico', qty: 2, price_cents: 1, note: 'sem cebola' }] });
    expect(code).toBe(1);
    const [o] = await asOwner('select * from public.orders where id = $1', [id]);
    expect(o.subtotal_cents).toBe(2990 * 2);
    expect(o.total_cents).toBe(2990 * 2);
    expect(o.items[0]).toMatchObject({ id: 'burger-classico', qty: 2, price_cents: 2990, note: 'sem cebola' });
  });

  it('entrega soma a taxa da loja; mesa não guarda pagamento', async () => {
    const [entrega] = await pedido(null, { mode: 'entrega', address: 'Rua A, 1', payment: 'dinheiro', change: 10000, items: [{ id: 'batata-frita', qty: 1 }] });
    const [e] = await asOwner('select fee_cents, total_cents, subtotal_cents, change_cents, code from public.orders where id = $1', [entrega.id]);
    expect(e.fee_cents).toBe(600);
    expect(e.total_cents).toBe(e.subtotal_cents + 600);
    expect(e.change_cents).toBe(10000);
    expect(e.code).toBe(2);

    const [mesa] = await pedido(null, { mode: 'mesa', table: '7', payment: 'pix', items: [{ id: 'batata-frita', qty: 1 }] });
    const [m] = await asOwner('select table_label, payment from public.orders where id = $1', [mesa.id]);
    expect(m).toEqual({ table_label: '7', payment: null });
  });

  it('recusa prato esgotado, fora do cardápio, quantidade absurda e mesa sem número', async () => {
    await asOwner(`update public.menu_items set available = false where id = 'brownie'`);
    await expect(pedido(null, { items: [{ id: 'brownie', qty: 1 }] })).rejects.toThrow(/item_indisponivel/);
    await expect(pedido(null, { items: [{ id: 'nao-existe', qty: 1 }] })).rejects.toThrow(/item_indisponivel/);
    await expect(pedido(null, { items: [{ id: 'burger-classico', qty: 999 }] })).rejects.toThrow(/itens_invalidos/);
    await expect(pedido(null, { items: [] })).rejects.toThrow(/itens_invalidos/);
    await expect(pedido(null, { mode: 'mesa', table: '<x>', items: [{ id: 'burger-classico', qty: 1 }] })).rejects.toThrow();
    await expect(pedido(null, { mode: 'entrega', address: '', items: [{ id: 'burger-classico', qty: 1 }] })).rejects.toThrow();
  });

  it('visitante não lê a tabela de pedidos, mas acompanha o próprio pelo id', async () => {
    await expect(as(null, 'select * from public.orders')).rejects.toThrow(/permission denied/);
    const [{ id }] = await pedido(null, { items: [{ id: 'burger-classico', qty: 1 }] });
    const [visto] = await as(null, 'select * from public.ver_pedido($1)', [id]);
    expect(visto.status).toBe('novo');
    expect(visto).not.toHaveProperty('customer_name');
    expect(visto).not.toHaveProperty('address');
  });

  it('visitante não cria pedido direto na tabela (só pela função)', async () => {
    await expect(as(null, `insert into public.orders (code, mode, customer_name, items, subtotal_cents, total_cents) values (1, 'retirada', 'x', '[]', 1, 1)`)).rejects.toThrow(/permission denied/);
  });
});

describe('freio contra spam', () => {
  it('o mesmo aparelho só faz 5 pedidos em 10 minutos; outro aparelho continua pedindo', async () => {
    const ip = (addr) => asOwner(`select set_config('request.headers', $1, false)`, [JSON.stringify({ 'cf-connecting-ip': addr, 'x-forwarded-for': '1.1.1.1' })]);
    fixo = true;
    await ip('203.0.113.9');
    for (let i = 0; i < 5; i++) await pedido(null, { items: [{ id: 'burger-classico', qty: 1 }] });
    await expect(pedido(null, { items: [{ id: 'burger-classico', qty: 1 }] })).rejects.toThrow(/muitos_pedidos/);
    await ip('198.51.100.7');
    const [ok] = await pedido(null, { items: [{ id: 'burger-classico', qty: 1 }] });
    expect(ok.code).toBeGreaterThan(0);
    await asOwner(`select set_config('request.headers', '', false)`);
    fixo = false;
  });

  it('ninguém lê o sal nem a contagem por aparelho, nem o admin', async () => {
    await expect(as(null, 'select * from public.order_rate')).rejects.toThrow(/permission denied/);
    await expect(as(DONO, 'select * from public.app_secret')).rejects.toThrow(/permission denied/);
    const [col] = await asOwner(`select count(*)::int n from information_schema.columns where table_name = 'orders' and column_name = 'client_key'`);
    expect(col.n).toBe(0);
  });
});

describe('cozinha (admin) e outras contas', () => {
  it('conta logada sem admin não vê nem muda pedidos', async () => {
    expect(await as(CLIENTE, 'select id from public.orders')).toHaveLength(0);
    expect(await as(CLIENTE, `update public.orders set status = 'preparando' returning id`)).toHaveLength(0);
  });

  it('admin vê os pedidos e avança o status na ordem certa', async () => {
    const lista = await as(DONO, 'select id, status from public.orders order by code');
    expect(lista.length).toBeGreaterThan(0);
    const id = lista[0].id;
    await as(DONO, `update public.orders set status = 'preparando' where id = $1`, [id]);
    await as(DONO, `update public.orders set status = 'pronto' where id = $1`, [id]);
    await expect(as(DONO, `update public.orders set status = 'novo' where id = $1`, [id])).rejects.toThrow(/status inválida/);
    await as(DONO, `update public.orders set status = 'entregue' where id = $1`, [id]);
    const [o] = await asOwner('select status from public.orders where id = $1', [id]);
    expect(o.status).toBe('entregue');
  });

  it('admin não consegue mudar o valor nem os itens de um pedido', async () => {
    const [{ id }] = await as(DONO, `select id from public.orders where status = 'novo' limit 1`);
    await expect(as(DONO, `update public.orders set total_cents = 1 where id = $1`, [id])).rejects.toThrow(/permission denied/);
  });
});
