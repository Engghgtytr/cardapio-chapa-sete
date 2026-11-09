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

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  code           integer not null,                       -- número curto do dia (#1, #2…) que a cozinha chama
  mode           text not null check (mode in ('mesa', 'retirada', 'entrega')),
  table_label    text check (table_label ~ '^[A-Za-z0-9-]{1,10}$'),
  customer_name  text not null check (char_length(customer_name) between 1 and 60),
  address        text check (char_length(address) between 1 and 160),
  payment        text check (payment in ('pix', 'cartao', 'dinheiro')),
  change_cents   integer check (change_cents between 1 and 1000000),
  items          jsonb not null,                         -- [{ id, name, qty, price_cents, note }] com o preço do banco
  subtotal_cents integer not null check (subtotal_cents > 0),
  fee_cents      integer not null default 0 check (fee_cents >= 0),
  total_cents    integer not null check (total_cents > 0),
  client_key     text,                                   -- hash do IP de quem pediu (só para frear spam; some com o pedido)
  status         text not null default 'novo' check (status in ('novo', 'preparando', 'pronto', 'entregue', 'cancelado')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((mode = 'mesa') = (table_label is not null)),
  check ((mode = 'entrega') = (address is not null)),
  check ((mode = 'mesa') = (payment is null))            -- na mesa, paga no fim, no caixa
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_client_idx on public.orders (client_key, created_at desc);
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
  if (new.id, new.client_key, new.code, new.mode, new.table_label, new.customer_name, new.address, new.payment, new.change_cents,
      new.items, new.subtotal_cents, new.fee_cents, new.total_cents, new.created_at)
     is distinct from
     (old.id, old.client_key, old.code, old.mode, old.table_label, old.customer_name, old.address, old.payment, old.change_cents,
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
begin
  select * into v_store from public.store_settings where store_settings.id = 1;
  if not coalesce(v_store.online_orders, false) then
    raise exception 'pedidos_desligados' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'itens_invalidos' using errcode = 'P0001';
  end if;

  -- Freio contra spam: até 5 pedidos a cada 10 minutos por aparelho (IP), para um engraçadinho
  -- não lotar a cozinha nem travar os pedidos dos outros. O teto geral alto é só último recurso.
  -- shortcut: IP pode ser compartilhado (Wi-Fi da loja) ou trocado; se virar problema, pôr captcha (Turnstile).
  v_client := encode(sha256(convert_to(coalesce(
    split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''), 'UTF8')), 'hex');
  if (select count(*) from public.orders o
      where o.client_key = v_client and o.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'muitos_pedidos' using errcode = 'P0001';
  end if;
  if (select count(*) from public.orders o where o.created_at > now() - interval '10 minutes') >= 500 then
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
    v_items := v_items || jsonb_build_object('id', v_item.id, 'name', v_item.name, 'qty', v_qty,
                                            'price_cents', v_item.price_cents, 'note', v_note);
    v_subtotal := v_subtotal + v_item.price_cents * v_qty;
  end loop;

  if p_mode = 'entrega' then
    v_fee := v_store.delivery_fee_cents;
  end if;

  -- Número do dia: trava curta para dois pedidos ao mesmo tempo não pegarem o mesmo número.
  perform pg_advisory_xact_lock(hashtext('orders_code'));
  select coalesce(max(o.code), 0) + 1 into v_code from public.orders o
    where o.created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  insert into public.orders (code, mode, table_label, customer_name, address, payment, change_cents,
                             items, subtotal_cents, fee_cents, total_cents, client_key)
  values (v_code, p_mode,
          case when p_mode = 'mesa' then p_table end,
          btrim(p_name),
          case when p_mode = 'entrega' then nullif(btrim(p_address), '') end,
          case when p_mode <> 'mesa' then p_payment end,
          case when p_mode <> 'mesa' and p_payment = 'dinheiro' then p_change_cents end,
          v_items, v_subtotal, v_fee, v_subtotal + v_fee, v_client)
  returning orders.id into v_id;

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
