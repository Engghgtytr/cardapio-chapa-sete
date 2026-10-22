// Gera supabase/migrations/003_seed.sql a partir dos dados de exemplo (src/data/demo-menu.js),
// para o banco começar igual ao modo demonstração. Rode com: npm run seed
import fs from 'node:fs';
import { DEMO_CATEGORIES, DEMO_ITEMS, DEMO_STORE } from '../src/data/demo-menu.js';

const OUT = 'supabase/migrations/003_seed.sql';

// Texto SQL: aspas simples dobradas. Só dados do próprio projeto passam por aqui.
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`);

const hours = Object.fromEntries(Object.entries(DEMO_STORE.hours).map(([d, h]) => [d, h]));

const lines = [
  '-- Dados iniciais da loja fictícia. Gerado por `npm run seed`: não edite à mão.',
  '-- Pode rodar de novo sem duplicar, mas ATENÇÃO: volta preços e fotos aos valores de',
  '-- exemplo, desfazendo o que foi mudado no painel. Rode só na primeira vez.',
  '',
  `insert into public.store_settings (id, name, tagline, address, whatsapp, delivery_fee_cents, hours)
values (1, ${q(DEMO_STORE.name)}, ${q(DEMO_STORE.tagline)}, ${q(DEMO_STORE.address)}, ${q(DEMO_STORE.whatsapp)}, ${DEMO_STORE.delivery_fee_cents}, ${q(JSON.stringify(hours))}::jsonb)
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, address = excluded.address,
  whatsapp = excluded.whatsapp, delivery_fee_cents = excluded.delivery_fee_cents, hours = excluded.hours;`,
  '',
  'insert into public.categories (id, name, position) values',
  DEMO_CATEGORIES.map((c) => `  (${q(c.id)}, ${q(c.name)}, ${c.position})`).join(',\n'),
  'on conflict (id) do update set name = excluded.name, position = excluded.position;',
  '',
  'insert into public.menu_items (id, category_id, name, description, price_cents, position, image, available, active, featured) values',
  DEMO_ITEMS.map(
    (i) =>
      `  (${q(i.id)}, ${q(i.category_id)}, ${q(i.name)}, ${q(i.description)}, ${i.price_cents}, ${i.position}, ${q(i.image)}, ${i.available}, ${i.active}, ${i.featured})`,
  ).join(',\n'),
  `on conflict (id) do update set category_id = excluded.category_id, name = excluded.name,
  description = excluded.description, price_cents = excluded.price_cents, position = excluded.position,
  image = excluded.image, available = excluded.available, active = excluded.active, featured = excluded.featured;`,
  '',
];

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Gerado', OUT);
