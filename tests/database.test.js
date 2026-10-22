// Testes do banco: roda as migrations reais num PostgreSQL embutido (PGlite)
// e confere quem pode ler e alterar o quê (RLS) e as regras de validação.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const DONO = '00000000-0000-0000-0000-0000000000d0';
const CLIENTE = '00000000-0000-0000-0000-0000000000c1';

let db;

// Executa uma consulta "como" um usuário (ou como visitante anônimo),
// do mesmo jeito que o Supabase faz a cada requisição.
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

// Como o dono do banco (equivale ao SQL Editor do Supabase).
const asOwner = async (query, params = []) => {
  await db.exec('reset role');
  return (await db.query(query, params)).rows;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql('../supabase/tests/supabase-stub.sql'));
  await db.exec(sql('../supabase/migrations/001_cardapio.sql'));
  await db.exec(sql('../supabase/migrations/003_seed.sql'));
  await asOwner(`insert into auth.users (id, email) values ($1, 'dono@exemplo.com'), ($2, 'cliente@exemplo.com')`, [DONO, CLIENTE]);
  await asOwner('insert into public.admins (user_id) values ($1)', [DONO]);
  await asOwner(`update public.menu_items set active = false where id = 'refrigerante'`);
}, 30000);

describe('visitante (sem login)', () => {
  it('lê a loja, as categorias e só os pratos ativos', async () => {
    const [store] = await as(null, 'select name, delivery_fee_cents from public.store_settings');
    expect(store).toEqual({ name: 'Chapa Sete', delivery_fee_cents: 600 });
    expect(await as(null, 'select id from public.categories')).toHaveLength(4);
    const items = await as(null, 'select id from public.menu_items');
    expect(items).toHaveLength(13);
    expect(items.map((i) => i.id)).not.toContain('refrigerante');
  });

  it('não altera preço, não cria prato e não muda a loja', async () => {
    await expect(as(null, `update public.menu_items set price_cents = 1 where id = 'burger-classico'`)).rejects.toThrow(/permission denied/);
    await expect(as(null, `insert into public.menu_items (id, category_id, name, price_cents) values ('x', 'burgers', 'X', 100)`)).rejects.toThrow(/permission denied/);
    await expect(as(null, `update public.store_settings set delivery_fee_cents = 0`)).rejects.toThrow(/permission denied/);
    const [item] = await asOwner(`select price_cents from public.menu_items where id = 'burger-classico'`);
    expect(item.price_cents).toBe(2990);
  });

  it('não lê a lista de admins', async () => {
    await expect(as(null, 'select * from public.admins')).rejects.toThrow(/permission denied/);
  });
});

describe('conta logada que não é admin', () => {
  it('não altera nada (as linhas simplesmente não mudam)', async () => {
    const updated = await as(CLIENTE, `update public.menu_items set price_cents = 1 where id = 'burger-classico' returning id`);
    const deleted = await as(CLIENTE, `delete from public.menu_items where id = 'burger-bacon' returning id`);
    const store = await as(CLIENTE, `update public.store_settings set whatsapp = '5511999999999' returning id`);
    expect(updated).toEqual([]);
    expect(deleted).toEqual([]);
    expect(store).toEqual([]);
  });

  it('não consegue criar prato nem categoria', async () => {
    await expect(as(CLIENTE, `insert into public.menu_items (id, category_id, name, price_cents) values ('x', 'burgers', 'X', 100)`)).rejects.toThrow(/row-level security/);
    await expect(as(CLIENTE, `insert into public.categories (id, name) values ('x', 'X')`)).rejects.toThrow(/row-level security/);
  });

  it('não consegue se colocar como admin', async () => {
    await expect(as(CLIENTE, 'insert into public.admins (user_id) values ($1)', [CLIENTE])).rejects.toThrow(/permission denied/);
    expect(await as(CLIENTE, 'select public.is_admin() as ok')).toEqual([{ ok: false }]);
  });

  it('não vê pratos fora do cardápio', async () => {
    expect(await as(CLIENTE, `select id from public.menu_items where id = 'refrigerante'`)).toEqual([]);
  });
});

describe('admin (dono da loja)', () => {
  it('é reconhecido como admin e vê só a própria linha em admins', async () => {
    expect(await as(DONO, 'select public.is_admin() as ok')).toEqual([{ ok: true }]);
    expect(await as(DONO, 'select user_id from public.admins')).toEqual([{ user_id: DONO }]);
  });

  it('vê também os pratos fora do cardápio', async () => {
    expect(await as(DONO, 'select id from public.menu_items')).toHaveLength(14);
  });

  it('muda preço, marca esgotado e muda a loja', async () => {
    const [item] = await as(DONO, `update public.menu_items set price_cents = 3190, available = false where id = 'burger-classico' returning price_cents, available`);
    expect(item).toEqual({ price_cents: 3190, available: false });
    const [store] = await as(DONO, `update public.store_settings set whatsapp = '5511912345678', delivery_fee_cents = 500 returning whatsapp, delivery_fee_cents`);
    expect(store).toEqual({ whatsapp: '5511912345678', delivery_fee_cents: 500 });
  });

  it('cria um prato novo', async () => {
    const [item] = await as(DONO, `insert into public.menu_items (id, category_id, name, price_cents, position) values ('burger-duplo', 'burgers', 'Duplo', 3990, 7) returning id`);
    expect(item.id).toBe('burger-duplo');
  });
});

describe('validações do banco (valem até para o admin)', () => {
  const rejects = (query) => expect(as(DONO, query)).rejects.toThrow(/check constraint|violates/);

  it('preço precisa ser positivo e no máximo R$ 1.000', async () => {
    await rejects(`update public.menu_items set price_cents = 0 where id = 'burger-bacon'`);
    await rejects(`update public.menu_items set price_cents = 100001 where id = 'burger-bacon'`);
  });

  it('nome e descrição têm tamanho máximo', async () => {
    await rejects(`update public.menu_items set name = '' where id = 'burger-bacon'`);
    await rejects(`update public.menu_items set description = repeat('a', 161) where id = 'burger-bacon'`);
  });

  it('foto só pode ser do site ou do bucket menu-images', async () => {
    await rejects(`update public.menu_items set image = 'javascript:alert(1)' where id = 'burger-bacon'`);
    await rejects(`update public.menu_items set image = 'https://site-qualquer.com/foto.webp' where id = 'burger-bacon'`);
    const ok = 'https://abcxyz.supabase.co/storage/v1/object/public/menu-images/itens/burger-bacon-1.webp';
    const [item] = await as(DONO, `update public.menu_items set image = $1 where id = 'burger-bacon' returning image`, [ok]);
    expect(item.image).toBe(ok);
  });

  it('WhatsApp precisa ser 55 + DDD + número', async () => {
    await rejects(`update public.store_settings set whatsapp = '11912345678'`);
    await rejects(`update public.store_settings set whatsapp = '55 11 91234-5678'`);
  });

  it('horário precisa estar no formato certo e fechar depois de abrir', async () => {
    await rejects(`update public.store_settings set hours = '{"0": ["23:00", "18:00"]}'`);
    await rejects(`update public.store_settings set hours = '{"7": ["18:00", "23:00"]}'`);
    await rejects(`update public.store_settings set hours = '{"1": ["6pm", "11pm"]}'`);
    const [row] = await as(DONO, `update public.store_settings set hours = '{"1": null, "2": ["11:00", "15:00"]}' returning hours`);
    expect(row.hours).toEqual({ 1: null, 2: ['11:00', '15:00'] });
  });

  it('só existe uma linha de loja', async () => {
    await expect(asOwner(`insert into public.store_settings (id, name) values (2, 'Outra')`)).rejects.toThrow(/check constraint/);
  });
});
