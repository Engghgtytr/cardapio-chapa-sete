-- Dados iniciais da loja fictícia. Gerado por `npm run seed`: não edite à mão.
-- Pode rodar de novo sem duplicar, mas ATENÇÃO: volta preços e fotos aos valores de
-- exemplo, desfazendo o que foi mudado no painel. Rode só na primeira vez.

insert into public.store_settings (id, name, tagline, address, whatsapp, delivery_fee_cents, hours)
values (1, 'Chapa Sete', 'Smash Burger', 'Rua dos Exemplos, 77 · Centro', null, 600, '{"0":["18:00","23:30"],"1":null,"2":["18:00","23:30"],"3":["18:00","23:30"],"4":["18:00","23:30"],"5":["18:00","23:30"],"6":["18:00","23:30"]}'::jsonb)
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, address = excluded.address,
  whatsapp = excluded.whatsapp, delivery_fee_cents = excluded.delivery_fee_cents, hours = excluded.hours;

insert into public.categories (id, name, position) values
  ('burgers', 'Burgers', 1),
  ('acompanhamentos', 'Acompanhamentos', 2),
  ('bebidas', 'Bebidas', 3),
  ('sobremesas', 'Sobremesas', 4)
on conflict (id) do update set name = excluded.name, position = excluded.position;

insert into public.menu_items (id, category_id, name, description, price_cents, position, image, available, active, featured) values
  ('burger-classico', 'burgers', 'Clássico Smash', 'Dois smash de 90 g, cheddar, picles, cebola e molho da casa no brioche.', 2990, 1, 'burger-classico', true, true, true),
  ('burger-bacon', 'burgers', 'Bacon Smash', 'Dois smash de 90 g, cheddar em dobro e bacon crocante.', 3490, 2, 'burger-bacon', true, true, true),
  ('burger-salada', 'burgers', 'Salada Smash', 'Um smash de 120 g, cheddar, alface, tomate e cebola roxa.', 3190, 3, 'burger-salada', true, true, false),
  ('burger-onion', 'burgers', 'Onion Smash', 'Dois smash de 90 g, cheddar e cebola crispy por dentro.', 3390, 4, 'burger-onion', true, true, true),
  ('burger-frango', 'burgers', 'Frango Crispy', 'Sobrecoxa empanada, salada de repolho e maionese de alho.', 3290, 5, 'burger-frango', true, true, false),
  ('burger-veggie', 'burgers', 'Veggie Smash', 'Burger de grão-de-bico, cheddar, rúcula e tomate.', 3290, 6, 'burger-veggie', true, true, false),
  ('batata-frita', 'acompanhamentos', 'Batata frita', 'Porção de 200 g, com sal e páprica.', 1690, 1, 'batata-frita', true, true, false),
  ('batata-cheddar-bacon', 'acompanhamentos', 'Batata cheddar e bacon', 'A batata da casa coberta com cheddar cremoso e bacon.', 2490, 2, 'batata-cheddar-bacon', true, true, false),
  ('onion-rings', 'acompanhamentos', 'Onion rings', 'Oito anéis de cebola empanados, com maionese da casa.', 1990, 3, 'onion-rings', true, true, false),
  ('refrigerante', 'bebidas', 'Refrigerante lata', 'Lata de 350 ml. Pergunte os sabores no WhatsApp.', 790, 1, 'refrigerante', true, true, false),
  ('limonada', 'bebidas', 'Limonada com hortelã', 'Copo de 400 ml, feita na hora.', 1190, 2, 'limonada', true, true, false),
  ('milkshake', 'sobremesas', 'Milkshake de chocolate', 'Copo de 400 ml, com chantilly e calda.', 1990, 3, 'milkshake', true, true, false),
  ('brownie', 'sobremesas', 'Brownie com sorvete', 'Brownie de chocolate meio amargo e bola de creme.', 1790, 1, 'brownie', true, true, false),
  ('cookie', 'sobremesas', 'Cookie', 'Cookie com gotas de chocolate, assado no dia.', 990, 2, 'cookie', false, true, false)
on conflict (id) do update set category_id = excluded.category_id, name = excluded.name,
  description = excluded.description, price_cents = excluded.price_cents, position = excluded.position,
  image = excluded.image, available = excluded.available, active = excluded.active, featured = excluded.featured;
