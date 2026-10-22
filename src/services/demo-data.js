// Dados do modo demonstração (sem Supabase). O que o visitante muda no painel
// fica só no navegador dele (localStorage), para ele testar à vontade.
// Não guarda nada sensível: só preços, textos e fotos de exemplo.
import { DEMO_CATEGORIES, DEMO_ITEMS, DEMO_STORE } from '../data/demo-menu.js';

const KEY = 'chapa7:demo';
const VERSION = 1;

const defaults = () => structuredClone({ store: DEMO_STORE, categories: DEMO_CATEGORIES, items: DEMO_ITEMS });

export function readDemoData() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.version === VERSION) return saved.data;
  } catch {
    // sem localStorage (aba anônima bloqueada, testes): usa os dados de exemplo
  }
  return defaults();
}

// Pode falhar se o navegador estiver sem espaço: quem chama mostra o erro.
export function writeDemoData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, data }));
  } catch {
    throw new Error('O navegador não deixou salvar. Libere espaço ou saia da aba anônima e tente de novo.');
  }
}

export function resetDemoData() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada a fazer
  }
}

export function hasDemoChanges() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
