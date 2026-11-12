-- Pedidos pelo site: o cliente monta a sacola (na mesa, pelo QR, ou para retirada/entrega)
-- e o pedido aparece na tela da cozinha na hora. Rode depois de 001, 002 e 003.
--
-- Quem pode o quê:
--   visitante (anon): cria pedido SÓ pela função fazer_pedido (o preço é calculado aqui,
--                     a partir do cardápio, nunca pelo navegador) e acompanha um pedido
--                     pela função ver_pedido, se souber o id (uuid impossível de adivinhar).
--   admin:            lê todos os pedidos e muda só o status (novo → preparando → pronto → entregue).
-- Ninguém lê a lista de pedidos de outras pessoas sem ser admin.

-- Liga/desliga os pedidos pelo site. Desligado = a sacola manda a mensagem pelo WhatsApp, como antes.
alter table public.store_settings add column if not exists online_orders boolean not null default false;

-- ---------- Opções dos pratos (tamanho, sabores, ponto, adicionais, borda) ----------
-- Mesmo formato e mesma regra de src/utils/options.js:
-- [{ id, name, min, max, pricing: 'soma'|'maior', choices: [{ id, name, price_cents }] }]
create or replace function public.valid_options(o jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  g jsonb;
  c jsonb;
  n integer;
begin
  if jsonb_typeof(o) <> 'array' or jsonb_array_length(o) > 6 then
    return false;
  end if;
  for g in select value from jsonb_array_elements(o) loop
    if jsonb_typeof(g) <> 'object'
       or coalesce(g->>'id', '') !~ '^[a-z0-9-]{1,40}$'
       or char_length(coalesce(g->>'name', '')) not between 1 and 40
       or coalesce(g->>'pricing', '') not in ('soma', 'maior')
       or jsonb_typeof(g->'min') <> 'number' or jsonb_typeof(g->'max') <> 'number'
       or jsonb_typeof(g->'choices') <> 'array' then
      return false;
    end if;
    n := jsonb_array_length(g->'choices');
    if n not between 1 and 30 or (g->>'min')::numeric < 0 or (g->>'max')::numeric < 1
       or (g->>'min')::numeric > (g->>'max')::numeric or (g->>'max')::numeric > n then
      return false;
    end if;
    for c in select value from jsonb_array_elements(g->'choices') loop
      if jsonb_typeof(c) <> 'object'
         or coalesce(c->>'id', '') !~ '^[a-z0-9-]{1,40}$'
         or char_length(coalesce(c->>'name', '')) not between 1 and 40
         or jsonb_typeof(c->'price_cents') <> 'number'
         or (c->>'price_cents')::numeric not between 0 and 100000 then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

alter table public.menu_items add column if not exists options jsonb not null default '[]'::jsonb
  check (public.valid_options(options));

-- Preço extra de UMA unidade + resumo das escolhas. Lança itens_invalidos se a escolha não vale.
create or replace function public.preco_opcoes(p_options jsonb, p_sel jsonb, out extra integer, out resumo jsonb)
language plpgsql
immutable
set search_path = ''
as $$
declare
  g jsonb;
  ch jsonb;
  picked jsonb;
  k text;
  v_id text;
  cnt integer;
  prices integer[];
  names text[];
begin
  extra := 0;
  resumo := '[]'::jsonb;
  if p_sel is null or jsonb_typeof(p_sel) = 'null' then
    p_sel := '{}'::jsonb;
  end if;
  if jsonb_typeof(p_sel) <> 'object' then
    raise exception 'itens_invalidos' using errcode = 'P0001';
  end if;
  for k in select jsonb_object_keys(p_sel) loop
    if not exists (select 1 from jsonb_array_elements(p_options) x where x.value->>'id' = k) then
      raise exception 'itens_invalidos' using errcode = 'P0001';
    end if;
  end loop;
  for g in select value from jsonb_array_elements(p_options) loop
    picked := coalesce(p_sel->(g->>'id'), '[]'::jsonb);
    if jsonb_typeof(picked) <> 'array' then
      raise exception 'itens_invalidos' using errcode = 'P0001';
    end if;
    cnt := jsonb_array_length(picked);
    if cnt < (g->>'min')::integer or cnt > (g->>'max')::integer
       or (select count(distinct value) from jsonb_array_elements_text(picked)) <> cnt then
      raise exception 'itens_invalidos' using errcode = 'P0001';
    end if;
    prices := '{}';
    names := '{}';
    for v_id in select value from jsonb_array_elements_text(picked) loop
      ch := (select value from jsonb_array_elements(g->'choices') where value->>'id' = v_id limit 1);
      if ch is null then
        raise exception 'itens_invalidos' using errcode = 'P0001';
      end if;
      prices := prices || (ch->>'price_cents')::integer;
      names := names || (ch->>'name');
    end loop;
    if cnt > 0 then
      -- 'maior': meio a meio cobra o sabor mais caro; 'soma': cada adicional soma
      extra := extra + case when g->>'pricing' = 'maior'
                            then (select max(x) from unnest(prices) x)
                            else (select sum(x) from unnest(prices) x)::integer end;
      resumo := resumo || jsonb_build_array(jsonb_build_object('group', g->>'name', 'choices', to_jsonb(names)));
    end if;
  end loop;
end;
$$;

revoke all on function public.preco_opcoes(jsonb, jsonb) from public;

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  code           integer not null,                       -- número curto do dia (#1, #2…) que a cozinha chama
  mode           text not null check (mode in ('mesa', 'retirada', 'entrega')),
  table_label    text check (table_label ~ '^[A-Za-z0-9-]{1,10}$'),
  customer_name  text not null check (char_length(customer_name) between 1 and 60),
  address        text check (char_length(address) between 1 and 160),
  payment        text check (payment in ('pix', 'cartao', 'dinheiro')),
  change_cents   integer check (change_cents between 1 and 1000000),
  items          jsonb not null,                         -- [{ id, name, qty, price_cents, note, options }] com o preço do banco
  subtotal_cents integer not null check (subtotal_cents > 0),
  fee_cents      integer not null default 0 check (fee_cents >= 0),
  total_cents    integer not null check (total_cents > 0),
  status         text not null default 'novo' check (status in ('novo', 'preparando', 'pronto', 'entregue', 'cancelado')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((mode = 'mesa') = (table_label is not null)),
  check ((mode = 'entrega') = (address is not null)),
  check ((mode = 'mesa') = (payment is null))            -- na mesa, paga no fim, no caixa
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_open_idx on public.orders (status) where status in ('novo', 'preparando', 'pronto');

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- A cozinha só muda o status, e só para a frente (ou cancela um pedido que ainda não ficou pronto).
create or replace function public.orders_status_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.code, new.mode, new.table_label, new.customer_name, new.address, new.payment, new.change_cents,
      new.items, new.subtotal_cents, new.fee_cents, new.total_cents, new.created_at)
     is distinct from
     (old.id, old.code, old.mode, old.table_label, old.customer_name, old.address, old.payment, old.change_cents,
      old.items, old.subtotal_cents, old.fee_cents, old.total_cents, old.created_at) then
    raise exception 'Só o status do pedido pode mudar' using errcode = '42501';
  end if;
  if not (
       (old.status = 'novo' and new.status in ('preparando', 'cancelado'))
    or (old.status = 'preparando' and new.status in ('pronto', 'cancelado'))
    or (old.status = 'pronto' and new.status = 'entregue')
    or old.status = new.status
  ) then
    raise exception 'Mudança de status inválida: % → %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger orders_status_rules before update on public.orders
  for each row execute function public.orders_status_rules();

-- ---------- Freio contra spam (tabelas privadas) ----------

-- Um "sal" secreto, criado aqui e que ninguém lê (só a função fazer_pedido): sem ele,
-- o código guardado não dá para ser revertido no IP.
create table public.app_secret (
  id   smallint primary key default 1 check (id = 1),
  salt text not null default (gen_random_uuid()::text || gen_random_uuid()::text)
);
insert into public.app_secret default values;

-- Pedidos recentes por aparelho. Só existe para contar os últimos 10 minutos; o mais velho é apagado.
create table public.order_rate (
  client_key text not null,
  created_at timestamptz not null default now()
);
create index order_rate_idx on public.order_rate (client_key, created_at);

revoke all on public.app_secret, public.order_rate from anon, authenticated;
alter table public.app_secret enable row level security;
alter table public.order_rate enable row level security;
-- Sem políticas: nem visitante nem admin leem essas tabelas pelo site.

-- ---------- Fazer pedido (visitante) ----------

-- p_items: [{ "id": "burger-classico", "qty": 2, "note": "sem cebola" }, …]
-- Devolve o id (para acompanhar) e o número do dia.
create or replace function public.fazer_pedido(
  p_mode text,
  p_table text,
  p_name text,
  p_address text,
  p_payment text,
  p_change_cents integer,
  p_items jsonb
)
returns table (id uuid, code integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.store_settings;
  v_items jsonb := '[]'::jsonb;
  v_subtotal integer := 0;
  v_fee integer := 0;
  v_code integer;
  v_line jsonb;
  v_item public.menu_items;
  v_qty integer;
  v_note text;
  v_id uuid;
  v_client text;
  v_ip text;
  v_extra integer;
  v_resumo jsonb;
  v_unit integer;
begin
  select * into v_store from public.store_settings where store_settings.id = 1;
  if not coalesce(v_store.online_orders, false) then
    raise exception 'pedidos_desligados' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'itens_invalidos' using errcode = 'P0001';
  end if;

  -- Uma fila só: trava ANTES de contar, para dois pedidos ao mesmo tempo não furarem o limite
  -- nem pegarem o mesmo número do dia. (Volume de restaurante: a fila é instantânea.)
  perform pg_advisory_xact_lock(hashtext('orders_code'));

  -- Freio contra spam: até 5 pedidos a cada 10 minutos por aparelho. O IP vem do cabeçalho que a
  -- Cloudflare/Supabase grava e sobrescreve (cf-connecting-ip); o x-forwarded-for do cliente não é
  -- usado, porque dá para falsificar. Sem IP, cai no balde 'sem-ip' (e no teto geral).
  -- shortcut: IP pode ser compartilhado (Wi-Fi da loja) ou trocado (4G); se virar problema, pôr captcha (Turnstile).
  v_ip := coalesce(nullif(current_setting('request.headers', true), '')::json->>'cf-connecting-ip',
                   nullif(current_setting('request.headers', true), '')::json->>'x-real-ip', 'sem-ip');
  select encode(sha256(convert_to(a.salt || v_ip, 'UTF8')), 'hex') into v_client from public.app_secret a;
  delete from public.order_rate r where r.created_at < now() - interval '10 minutes';
  if (select count(*) from public.order_rate r where r.client_key = v_client) >= 5 then
    raise exception 'muitos_pedidos' using errcode = 'P0001';
  end if;
  if (select count(*) from public.order_rate) >= 300 then
    raise exception 'muitos_pedidos' using errcode = 'P0001';
  end if;

  for v_line in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_line->'qty') <> 'number' then
      raise exception 'itens_invalidos' using errcode = 'P0001';
    end if;
    v_qty := (v_line->>'qty')::integer;
    if v_qty not between 1 and 20 then
      raise exception 'itens_invalidos' using errcode = 'P0001';
    end if;
    select * into v_item from public.menu_items m
      where m.id = v_line->>'id' and m.active and m.available;
    if not found then
      raise exception 'item_indisponivel' using errcode = 'P0001';
    end if;
    v_note := nullif(btrim(regexp_replace(coalesce(v_line->>'note', ''), '[[:cntrl:]]+', ' ', 'g')), '');
    if char_length(v_note) > 140 then
      raise exception 'itens_invalidos' using errcode = 'P0001';
    end if;
    -- Opções (tamanho, sabores, adicionais): o preço de cada uma vem do cardápio, não do navegador
    select o.extra, o.resumo into v_extra, v_resumo from public.preco_opcoes(v_item.options, v_line->'options') o;
    v_unit := v_item.price_cents + v_extra;
    v_items := v_items || jsonb_build_object('id', v_item.id, 'name', v_item.name, 'qty', v_qty,
                                            'price_cents', v_unit, 'note', v_note, 'options', v_resumo);
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  if p_mode = 'entrega' then
    v_fee := v_store.delivery_fee_cents;
  end if;

  -- Número do dia (a trava lá de cima garante que não repete).
  select coalesce(max(o.code), 0) + 1 into v_code from public.orders o
    where o.created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  insert into public.orders (code, mode, table_label, customer_name, address, payment, change_cents,
                             items, subtotal_cents, fee_cents, total_cents)
  values (v_code, p_mode,
          case when p_mode = 'mesa' then p_table end,
          btrim(p_name),
          case when p_mode = 'entrega' then nullif(btrim(p_address), '') end,
          case when p_mode <> 'mesa' then p_payment end,
          case when p_mode <> 'mesa' and p_payment = 'dinheiro' then p_change_cents end,
          v_items, v_subtotal, v_fee, v_subtotal + v_fee)
  returning orders.id into v_id;
  insert into public.order_rate (client_key) values (v_client);

  -- Guardar só o necessário (LGPD): pedidos com nome e endereço somem depois de 90 dias.
  delete from public.orders o where o.created_at < now() - interval '90 days';

  return query select v_id, v_code;
end;
$$;

-- ---------- Acompanhar pedido (visitante, com o id) ----------

create or replace function public.ver_pedido(p_id uuid)
returns table (code integer, mode text, table_label text, items jsonb, total_cents integer, status text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.code, o.mode, o.table_label, o.items, o.total_cents, o.status, o.created_at
  from public.orders o
  where o.id = p_id and o.created_at > now() - interval '1 day'
$$;

-- ---------- Permissões ----------

revoke all on public.orders from anon, authenticated;
revoke all on function public.fazer_pedido(text, text, text, text, text, integer, jsonb) from public;
revoke all on function public.ver_pedido(uuid) from public;

grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;
grant execute on function public.fazer_pedido(text, text, text, text, text, integer, jsonb) to anon, authenticated;
grant execute on function public.ver_pedido(uuid) to anon, authenticated;

alter table public.orders enable row level security;

create policy "pedidos: admin lê" on public.orders
  for select to authenticated using (public.is_admin());
create policy "pedidos: admin muda status" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tempo real: a tela da cozinha recebe cada pedido novo na hora (o Realtime respeita o RLS acima).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
