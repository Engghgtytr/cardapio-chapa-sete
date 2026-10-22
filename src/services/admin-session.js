// Quem está usando o painel.
//   - Com Supabase: login por e-mail e senha. Ser admin = ter uma linha na tabela admins.
//     Esconder telas aqui é só conforto: quem barra de verdade é o RLS do banco.
//   - Sem Supabase (demonstração): qualquer visitante entra, sem senha.
import { supabase } from './supabase.js';

const DEMO_KEY = 'chapa7:demo-admin';

export const isDemo = () => !supabase;

// null = ninguém entrou. { mode, email, isAdmin } = sessão ativa.
export async function currentAdmin() {
  if (!supabase) {
    try {
      return sessionStorage.getItem(DEMO_KEY) ? { mode: 'demo', email: '', isAdmin: true } : null;
    } catch {
      return null;
    }
  }
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return { mode: 'cloud', email: user.email, isAdmin: await checkAdmin(user.id) };
}

async function checkAdmin(userId) {
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) {
    console.error(error);
    throw new Error('Não foi possível conferir seu acesso. Verifique a internet e tente de novo.');
  }
  return Boolean(data);
}

// Mensagem genérica de propósito: não revela se o e-mail tem conta.
const AUTH_MESSAGES = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme o e-mail pelo link que você recebeu antes de entrar.',
  over_request_rate_limit: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
};

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (String(error.message).includes('fetch')) throw new Error('Sem conexão com o servidor. Verifique a internet.');
    throw new Error(AUTH_MESSAGES[error.code] ?? 'Não foi possível entrar. Tente novamente.');
  }
  return currentAdmin();
}

export function startDemo() {
  try {
    sessionStorage.setItem(DEMO_KEY, '1');
  } catch {
    // sem sessionStorage: a demonstração dura até recarregar
  }
  return { mode: 'demo', email: '', isAdmin: true };
}

export async function signOut() {
  try {
    sessionStorage.removeItem(DEMO_KEY);
  } catch {
    // nada a fazer
  }
  if (supabase) await supabase.auth.signOut();
}
