import { logo } from '../components/brand.js';
import { STATUS, getOrderStatus, onOrdersChange } from '../services/orders.js';
import { supabase } from '../services/supabase.js';
import { esc } from '../utils/dom.js';
import { formatCents } from '../utils/money.js';

// Acompanhar o pedido (#/pedido?id=…): a pessoa vê o número e o status mudando
// sozinho até ficar pronto. Não mostra nome nem endereço (o banco nem devolve).
const STEPS = ['novo', 'preparando', 'pronto'];
const HINT = {
  novo: 'A cozinha recebeu seu pedido.',
  preparando: 'Seu pedido está sendo preparado.',
  pronto: 'Pronto! Pode retirar ou aguarde: já vai chegar até você.',
  entregue: 'Pedido entregue. Bom apetite!',
  cancelado: 'Este pedido foi cancelado pela loja. Fale com o atendente.',
};

const where = (o) => (o.mode === 'mesa' ? `Mesa ${esc(o.table_label)}` : o.mode === 'entrega' ? 'Entrega' : 'Retirada no balcão');

export function renderPedido(app, params) {
  const id = params.get('id') ?? '';
  app.innerHTML = `
  <div class="doc track">
    <header class="doc__top">${logo('#/')}</header>
    <main class="doc__body track__body" aria-busy="true"><p class="muted">Carregando seu pedido…</p></main>
  </div>`;
  const main = app.querySelector('.track__body');
  let lastStatus = null;
  let stopped = false;

  const paint = (o) => {
    main.removeAttribute('aria-busy');
    if (!o) {
      main.innerHTML = `
        <h1>Pedido não encontrado</h1>
        <p>O link pode estar incompleto ou o pedido é de outro dia.</p>
        <p class="doc__back"><a href="#/cardapio">Voltar ao cardápio</a></p>`;
      return;
    }
    const step = STEPS.indexOf(o.status);
    const done = o.status === 'entregue';
    main.innerHTML = `
      <p class="track__where">${where(o)}</p>
      <h1 class="track__code">Pedido <span>#${esc(o.code)}</span></h1>
      <ol class="track__steps" aria-label="Andamento do pedido">
        ${STEPS.map((s, i) => `
          <li class="${done || i < step ? 'is-done' : i === step ? 'is-now' : ''}" ${i === step ? 'aria-current="step"' : ''}>
            <span class="track__dot" aria-hidden="true"></span>${STATUS[s]}
          </li>`).join('')}
      </ol>
      <p class="track__hint ${o.status === 'cancelado' ? 'is-error' : ''}" role="status">${HINT[o.status] ?? ''}</p>
      <ul class="track__items">
        ${o.items.map((l) => `<li><span>${esc(l.qty)}x ${esc(l.name)}${l.note ? `<small>Obs.: ${esc(l.note)}</small>` : ''}</span></li>`).join('')}
      </ul>
      <p class="track__total">Total <strong>${formatCents(o.total_cents)}</strong></p>
      <p class="muted track__note">Esta página se atualiza sozinha. Pode deixar aberta.</p>
      <p class="doc__back"><a href="#/cardapio">Pedir mais alguma coisa</a></p>`;
    // Vibra de leve quando fica pronto (só se o aparelho permitir).
    if (lastStatus && lastStatus !== 'pronto' && o.status === 'pronto') navigator.vibrate?.(200);
    lastStatus = o.status;
  };

  const refresh = () =>
    getOrderStatus(id)
      .then((o) => !stopped && paint(o))
      .catch((err) => {
        if (stopped || lastStatus) return; // já mostrando o pedido: tenta de novo na próxima volta
        main.removeAttribute('aria-busy');
        main.innerHTML = `<div class="load-error" role="alert"><p>${esc(err.message)}</p>
          <button class="btn btn--dark" type="button" data-retry>Tentar de novo</button></div>`;
        main.querySelector('[data-retry]').addEventListener('click', refresh);
      });

  refresh();
  // Visitante não recebe o tempo real do banco (o RLS não deixa): pergunta a cada 8 s.
  const timer = setInterval(() => {
    if (!['entregue', 'cancelado'].includes(lastStatus)) refresh();
  }, 8000);
  // Na demonstração, outras abas avisam na hora; com Supabase, fica só a pergunta a cada 8 s.
  const off = supabase ? () => {} : onOrdersChange(refresh);
  return () => {
    stopped = true;
    clearInterval(timer);
    off();
  };
}
