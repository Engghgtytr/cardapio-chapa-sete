// Alterações feitas pelo painel. Mesma interface nos dois modos:
// Supabase (dados reais, protegidos pelo RLS) ou demonstração (localStorage).
import { supabase } from './supabase.js';
import { clearMenuCache, loadRemote, LOAD_ERROR } from './menu.js';
import { readDemoData, resetDemoData, writeDemoData } from './demo-data.js';
import { slugify } from '../utils/menu-rules.js';

const BUCKET = 'menu-images';
const byPosition = (a, b) => a.position - b.position;

// Converte erros do Supabase/Postgres em mensagens para a tela.
// O detalhe técnico vai só para o console.
export function toAppError(error) {
  console.error(error);
  if (error?.code === '23514') return new Error('Algum valor ficou fora do permitido. Revise os campos.');
  if (error?.code === '42501' || error?.code === 'PGRST301' || error?.code === 'PGRST116') {
    return new Error('Sua sessão expirou ou esta conta não tem permissão. Entre de novo.');
  }
  if (String(error?.message).includes('fetch')) return new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  return new Error('Não foi possível salvar. Tente novamente.');
}

// Tudo o que o painel mostra, inclusive pratos fora do cardápio.
export async function loadAdminMenu() {
  const data = supabase ? await loadRemote() : readDemoData();
  return {
    store: data.store,
    categories: [...data.categories].sort(byPosition),
    items: [...data.items].sort(byPosition),
  };
}

export { LOAD_ERROR };

// id null = prato novo (vai para o fim da categoria). Devolve o prato salvo.
export async function saveItem(id, value) {
  const saved = supabase ? await saveItemRemote(id, value) : saveItemDemo(id, value);
  clearMenuCache();
  return saved;
}

async function saveItemRemote(id, value) {
  if (id) {
    // .single() falha (PGRST116) quando o RLS não deixa alterar: nenhuma linha volta.
    const { data, error } = await supabase.from('menu_items').update(value).eq('id', id).select().single();
    if (error) throw toAppError(error);
    return data;
  }
  const { data: last } = await supabase
    .from('menu_items')
    .select('position')
    .eq('category_id', value.category_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = { ...value, id: slugify(value.name), position: (last?.position ?? 0) + 1 };
  const { data, error } = await supabase.from('menu_items').insert(row).select().single();
  if (error) throw toAppError(error);
  return data;
}

function saveItemDemo(id, value) {
  const data = readDemoData();
  let item;
  if (id) {
    item = data.items.find((i) => i.id === id);
    if (!item) throw new Error('Este prato não existe mais. Recarregue a página.');
    Object.assign(item, value);
  } else {
    const last = Math.max(0, ...data.items.filter((i) => i.category_id === value.category_id).map((i) => i.position));
    item = { image: '', featured: false, ...value, id: slugify(value.name), position: last + 1 };
    data.items.push(item);
  }
  writeDemoData(data);
  return item;
}

export async function saveStore(value) {
  if (supabase) {
    const { data, error } = await supabase.from('store_settings').update(value).eq('id', 1).select().single();
    if (error) throw toAppError(error);
    clearMenuCache();
    return data;
  }
  const data = readDemoData();
  Object.assign(data.store, value);
  writeDemoData(data);
  clearMenuCache();
  return data.store;
}

// Envia a foto (já convertida por utils/photo.js) e grava no prato. Devolve o prato.
export async function uploadItemPhoto(id, blob) {
  if (!supabase) {
    const image = await blobToDataUrl(blob);
    return saveItem(id, { image });
  }
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  // Nome novo a cada envio: o navegador não mostra a foto antiga guardada em cache.
  const path = `itens/${id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw toAppError(error);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return saveItem(id, { image: data.publicUrl });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.readAsDataURL(blob);
  });
}

export function resetDemo() {
  resetDemoData();
  clearMenuCache();
}
