// Fonte dos dados do cardápio: Supabase quando configurado; senão, o modo
// demonstração. As duas fontes devolvem o mesmo formato (o das tabelas do banco).
import { supabase } from './supabase.js';
import { readDemoData } from './demo-data.js';

const byPosition = (a, b) => a.position - b.position;

export const LOAD_ERROR = 'Não foi possível carregar o cardápio. Verifique a internet e tente de novo.';

// Uma busca por visita. O painel limpa a memória depois de salvar algo.
let cache = null;

export function getMenu() {
  if (!cache) {
    cache = load().catch((err) => {
      cache = null; // a próxima tentativa busca de novo
      throw err;
    });
  }
  return cache;
}

export const clearMenuCache = () => {
  cache = null;
};

async function load() {
  return shapeMenu(supabase ? await loadRemote() : readDemoData());
}

// Lê as três tabelas. O RLS já esconde os pratos fora do cardápio de quem não é admin.
export async function loadRemote() {
  const [store, categories, items] = await Promise.all([
    supabase.from('store_settings').select('*').single(),
    supabase.from('categories').select('*'),
    supabase.from('menu_items').select('*'),
  ]);
  const error = store.error ?? categories.error ?? items.error;
  if (error) {
    console.error(error); // detalhe técnico só no console; a tela mostra a mensagem humana
    throw new Error(LOAD_ERROR);
  }
  return { store: store.data, categories: categories.data, items: items.data };
}

// Só pratos ativos, em ordem, agrupados por categoria (categorias vazias somem).
export function shapeMenu({ store, categories, items }) {
  const active = items.filter((i) => i.active).sort(byPosition);
  const grouped = [...categories]
    .sort(byPosition)
    .map((c) => ({ ...c, items: active.filter((i) => i.category_id === c.id) }))
    .filter((c) => c.items.length > 0);
  return { store, categories: grouped, items: active };
}

// Foto do prato: nome de uma foto do site (gerada por `npm run imagens`),
// endereço do Supabase Storage ou, no modo demonstração, uma imagem enviada (data:).
// Sem foto: null.
export function menuImage(ref) {
  if (!ref) return null;
  if (/^(https:|data:image\/)/.test(ref)) return { src: ref, srcset: '' };
  return {
    src: `/img/menu/${ref}-320.webp`,
    srcset: `/img/menu/${ref}-320.webp 320w, /img/menu/${ref}-640.webp 640w`,
  };
}

// Cartazes da página da loja (arte feita para cada prato).
export const POSTERS = new Set([
  'burger-bacon', 'burger-classico', 'burger-veggie', 'burger-frango', 'burger-onion', 'onion-rings',
  'batata-cheddar-bacon', 'batata-frita', 'milkshake', 'limonada', 'brownie', 'cookie',
]);

export const posterImage = (key) => ({
  src: `/img/loja/${key}-480.webp`,
  srcset: `/img/loja/${key}-480.webp 480w, /img/loja/${key}-800.webp 800w`,
});
