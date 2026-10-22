-- Cardápio digital da Chapa Sete: tabelas, regras de validação e permissões (RLS).
-- Rode no SQL Editor do Supabase (ou com `supabase db push`). Depois rode 002 e 003.
--
-- Quem pode o quê:
--   visitante (anon):        lê a loja, as categorias e os pratos ativos. Não altera nada.
--   conta logada, sem admin: o mesmo que o visitante.
--   admin (tabela admins):   lê tudo e altera loja, categorias e pratos.
-- Ninguém vira admin pelo site: a linha em `admins` só é criada pelo SQL Editor.

-- ---------- Funções de apoio ----------

-- Horário de funcionamento: { "0": ["18:00","23:30"], "1": null, ... } (0 = domingo).
create or replace function public.valid_hours(h jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  if jsonb_typeof(h) <> 'object' then
    return false;
  end if;
  for k, v in select * from jsonb_each(h) loop
    if k !~ '^[0-6]$' then
      return false;
    end if;
    if jsonb_typeof(v) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> 2 then
      return false;
    end if;
    if (v->>0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v->>1) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      return false;
    end if;
    if (v->>0) >= (v->>1) then
      return false; -- fecha depois de abrir, no mesmo dia
    end if;
  end loop;
  return true;
end;
$$;

-- Foto de um prato: nome de uma foto que vem com o site ("burger-classico")
-- ou endereço público do bucket menu-images deste Supabase.
create or replace function public.valid_image(ref text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select ref = ''
      or ref ~ '^[a-z0-9-]{1,60}$'
      or ref ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/menu-images/[A-Za-z0-9/_.-]{1,200}$'
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Tabelas ----------

create table public.store_settings (
  id                 smallint primary key default 1 check (id = 1), -- uma loja só
  name               text not null check (char_length(name) between 1 and 60),
  tagline            text not null default '' check (char_length(tagline) <= 60),
  address            text not null default '' check (char_length(address) <= 160),
  -- 55 + DDD + número, só dígitos. Vazio (null) = modo demonstração, sem WhatsApp.
  whatsapp           text check (whatsapp ~ '^55[0-9]{10,11}$'),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents between 0 and 10000),
  hours              jsonb not null default '{}'::jsonb check (public.valid_hours(hours)),
  updated_at         timestamptz not null default now()
);

create table public.categories (
  id       text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name     text not null check (char_length(name) between 1 and 40),
  position integer not null default 0
);

create table public.menu_items (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  category_id text not null references public.categories (id) on update cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 160),
  price_cents integer not null check (price_cents between 1 and 100000), -- até R$ 1.000,00
  position    integer not null default 0,
  image       text not null default '' check (public.valid_image(image)),
  available   boolean not null default true,  -- false = esgotado hoje
  active      boolean not null default true,  -- false = fora do cardápio
  featured    boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index menu_items_category_idx on public.menu_items (category_id, position);

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create trigger store_settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.touch_updated_at();

-- ---------- Quem é admin ----------

-- security definer: lê a tabela admins mesmo sem permissão direta sobre ela.
-- search_path vazio impede que alguém "troque" a tabela por outra com o mesmo nome.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ---------- Permissões ----------

-- Começa do zero e libera só o necessário.
revoke all on public.store_settings, public.categories, public.menu_items, public.admins from anon, authenticated;
revoke all on function public.is_admin() from public;

grant select on public.store_settings, public.categories, public.menu_items to anon, authenticated;
grant update on public.store_settings to authenticated;
grant insert, update, delete on public.categories, public.menu_items to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.admins enable row level security;

create policy "loja: todos leem" on public.store_settings
  for select to anon, authenticated using (true);
create policy "loja: admin altera" on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "categorias: todos leem" on public.categories
  for select to anon, authenticated using (true);
create policy "categorias: admin cria" on public.categories
  for insert to authenticated with check (public.is_admin());
create policy "categorias: admin altera" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categorias: admin apaga" on public.categories
  for delete to authenticated using (public.is_admin());

-- Prato fora do cardápio (active = false) só aparece para o admin.
create policy "pratos: leem os ativos" on public.menu_items
  for select to anon, authenticated using (active or public.is_admin());
create policy "pratos: admin cria" on public.menu_items
  for insert to authenticated with check (public.is_admin());
create policy "pratos: admin altera" on public.menu_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pratos: admin apaga" on public.menu_items
  for delete to authenticated using (public.is_admin());

-- Cada conta só consegue ver se ELA é admin. Não há política de escrita:
-- pelo site, ninguém se coloca na tabela.
create policy "admins: cada um vê a própria linha" on public.admins
  for select to authenticated using (user_id = auth.uid());
