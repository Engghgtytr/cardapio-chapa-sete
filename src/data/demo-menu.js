// Dados de exemplo da loja fictícia. Seguem o mesmo formato das tabelas do Supabase
// (Etapa 4): preços em centavos, `available` = não esgotado, `position` = ordem.

export const DEMO_STORE = {
  name: 'Chapa Sete',
  tagline: 'Smash Burger',
  address: 'Rua dos Exemplos, 77 · Centro',
  // Sem número = modo demonstração: o pedido é mostrado na tela em vez de abrir o
  // WhatsApp, porque um número inventado pode pertencer a uma pessoa real.
  whatsapp: null,
  delivery_fee_cents: 600,
  // Pedidos pelo site ligados na demonstração: a sacola manda para a tela da cozinha (#/cozinha).
  online_orders: true,
  // Dia da semana: 0 = domingo … 6 = sábado. Horários no formato "HH:MM".
  // Fechado na segunda; aberto de terça a domingo, das 18h às 23h30.
  hours: {
    0: ['18:00', '23:30'],
    1: null,
    2: ['18:00', '23:30'],
    3: ['18:00', '23:30'],
    4: ['18:00', '23:30'],
    5: ['18:00', '23:30'],
    6: ['18:00', '23:30'],
  },
};

export const DEMO_CATEGORIES = [
  { id: 'burgers', name: 'Burgers', position: 1 },
  { id: 'acompanhamentos', name: 'Acompanhamentos', position: 2 },
  { id: 'bebidas', name: 'Bebidas', position: 3 },
  { id: 'sobremesas', name: 'Sobremesas', position: 4 },
];

const item = (id, category_id, name, description, price_cents, position, extra = {}) => ({
  id, category_id, name, description, price_cents, position,
  image: id, available: true, active: true, featured: false, options: [], ...extra,
});

// Opções de exemplo (mesmo formato de src/utils/options.js e da coluna options do banco)
const PONTO = { id: 'ponto', name: 'Ponto da carne', min: 1, max: 1, pricing: 'soma', choices: [
  { id: 'ao-ponto', name: 'Ao ponto', price_cents: 0 }, { id: 'bem-passado', name: 'Bem passado', price_cents: 0 }] };
const ADICIONAIS = { id: 'adicionais', name: 'Adicionais', min: 0, max: 3, pricing: 'soma', choices: [
  { id: 'bacon', name: 'Bacon', price_cents: 400 }, { id: 'cheddar-extra', name: 'Cheddar extra', price_cents: 300 },
  { id: 'ovo', name: 'Ovo', price_cents: 300 }, { id: 'cebola-caramelizada', name: 'Cebola caramelizada', price_cents: 300 }] };
const TAMANHO_BATATA = { id: 'tamanho', name: 'Tamanho', min: 1, max: 1, pricing: 'soma', choices: [
  { id: 'media', name: 'Média (200 g)', price_cents: 0 }, { id: 'grande', name: 'Grande (400 g)', price_cents: 1200 }] };

export const DEMO_ITEMS = [
  item('burger-classico', 'burgers', 'Clássico Smash', 'Dois smash de 90 g, cheddar, picles, cebola e molho da casa no brioche.', 2990, 1, { featured: true, options: [ADICIONAIS] }),
  item('burger-bacon', 'burgers', 'Bacon Smash', 'Dois smash de 90 g, cheddar em dobro e bacon crocante.', 3490, 2, { featured: true, options: [PONTO, ADICIONAIS] }),
  item('burger-salada', 'burgers', 'Salada Smash', 'Um smash de 120 g, cheddar, alface, tomate e cebola roxa.', 3190, 3, { options: [PONTO, ADICIONAIS] }),
  item('burger-onion', 'burgers', 'Onion Smash', 'Dois smash de 90 g, cheddar e cebola crispy por dentro.', 3390, 4, { featured: true, options: [PONTO, ADICIONAIS] }),
  item('burger-frango', 'burgers', 'Frango Crispy', 'Sobrecoxa empanada, salada de repolho e maionese de alho.', 3290, 5),
  item('burger-veggie', 'burgers', 'Veggie Smash', 'Burger de grão-de-bico, cheddar, rúcula e tomate.', 3290, 6),
  item('batata-frita', 'acompanhamentos', 'Batata frita', 'Porção de 200 g, com sal e páprica.', 1690, 1, { options: [TAMANHO_BATATA] }),
  item('batata-cheddar-bacon', 'acompanhamentos', 'Batata cheddar e bacon', 'A batata da casa coberta com cheddar cremoso e bacon.', 2490, 2),
  item('onion-rings', 'acompanhamentos', 'Onion rings', 'Oito anéis de cebola empanados, com maionese da casa.', 1990, 3),
  item('refrigerante', 'bebidas', 'Refrigerante lata', 'Lata de 350 ml. Pergunte os sabores no WhatsApp.', 790, 1),
  item('limonada', 'bebidas', 'Limonada com hortelã', 'Copo de 400 ml, feita na hora.', 1190, 2),
  item('milkshake', 'sobremesas', 'Milkshake de chocolate', 'Copo de 400 ml, com chantilly e calda.', 1990, 3),
  item('brownie', 'sobremesas', 'Brownie com sorvete', 'Brownie de chocolate meio amargo e bola de creme.', 1790, 1),
  item('cookie', 'sobremesas', 'Cookie', 'Cookie com gotas de chocolate, assado no dia.', 990, 2, { available: false }),
];
