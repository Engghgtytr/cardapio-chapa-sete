import { createClient } from '@supabase/supabase-js';

// Só variáveis PÚBLICAS (prefixo VITE_) chegam ao navegador.
// A chave anon/publishable pode ficar no frontend porque quem protege os dados é o RLS.
// NUNCA use aqui a chave service_role: ela ignora o RLS.
const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// Uma URL inválida (ex.: a chave colada no lugar da URL) derrubaria o site inteiro.
const isValidUrl = (value) => /^https:\/\/\S+$/.test(value ?? '');

if (url && !isValidUrl(url)) {
  console.error('VITE_SUPABASE_URL não é uma URL válida. Usando só o modo demonstração.');
}

export const isSupabaseConfigured = Boolean(isValidUrl(url) && key);

// Sem .env (ou com .env inválido), o site funciona no modo demonstração.
export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
