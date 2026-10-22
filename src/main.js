import './styles/base.css';
import './styles/loja.css';
import './styles/cardapio.css';
import './styles/sheet.css';
import './styles/admin.css';

import { renderLoja } from './pages/loja.js';
import { renderCardapio } from './pages/cardapio.js';
import { renderAdmin } from './pages/admin.js';
import { renderPrivacidade } from './pages/privacidade.js';

const app = document.getElementById('app');
const description = document.querySelector('meta[name="description"]');
const HOME_DESCRIPTION = description.content;

// Roteamento por hash (#/cardapio). Funciona em qualquer hospedagem estática.
// O QR code da mesa aponta direto para #/cardapio.
const routes = {
  '/': { title: 'Chapa Sete Smash Burger', render: renderLoja },
  '/cardapio': {
    title: 'Cardápio · Chapa Sete',
    description: 'Burgers, acompanhamentos, bebidas e sobremesas da Chapa Sete. Monte a sacola e envie o pedido pelo WhatsApp.',
    render: renderCardapio,
  },
  '/privacidade': {
    title: 'Privacidade · Chapa Sete',
    description: 'Que dados o site da Chapa Sete usa: o pedido não é guardado, não há cookies de rastreamento.',
    render: renderPrivacidade,
  },
  '/admin': { title: 'Painel · Chapa Sete', render: (el) => renderAdmin(el, 'pratos') },
  '/admin/loja': { title: 'Dados da loja · Painel · Chapa Sete', render: (el) => renderAdmin(el, 'loja') },
};

// Cada página pode devolver uma função de limpeza (tirar ouvintes de rolagem etc.).
let cleanup = null;

function router() {
  const path = location.hash.slice(1) || '/';
  const route = routes[path] ?? routes['/'];
  cleanup?.();
  document.title = route.title;
  description.content = route.description ?? HOME_DESCRIPTION;
  window.scrollTo(0, 0);
  cleanup = route.render(app) ?? null;
}

window.addEventListener('hashchange', router);
router();
