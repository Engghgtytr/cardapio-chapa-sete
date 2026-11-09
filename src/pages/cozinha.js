import { currentAdmin, startDemo } from '../services/admin-session.js';
import { NEXT, STATUS, listOpenOrders, onOrdersChange, setOrderStatus, todaySummary } from '../services/orders.js';
import { supabase } from '../services/supabase.js';
import { esc } from '../utils/dom.js';
import { formatCents } from '../utils/money.js';

// Tela da cozinha (#/cozinha): feita para tablet ou TV na parede. Pedidos chegam na hora,
// com apito, e um toque avança o status. Só abre para admin (na demonstração, abre direto).
const COLUMNS = [
  ['novo', 'Novos'],
  ['preparando', 'Preparando'],
  ['pronto', 'Prontos'],
];
const ACTION = { novo: 'Começar', preparando: 'Pronto', pronto: 'Entregue' };
const LATE_MIN = 15; // passou disso, o cartão fica em alerta

const where = (o) => (o.mode === 'mesa' ? `Mesa ${esc(o.table_label)}` : o.mode === 'entrega' ? 'Entrega' : 'Retirada');
const minutesSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));

function card(o) {
  const min = minutesSince(o.created_at);
  return `
    <li class="ticket ${min >= LATE_MIN && o.status !== 'pronto' ? 'is-late' : ''}" data-id="${esc(o.id)}">
      <header class="ticket__head">
        <strong class="ticket__code">#${esc(o.code)}</strong>
        <span class="ticket__where ticket__where--${esc(o.mode)}">${where(o)}</span>
        <span class="ticket__time" title="Tempo desde o pedido">${min} min</span>
      </header>
      <p class="ticket__name">${esc(o.customer_name)}</p>
      <ul class="ticket__items">
        ${o.items.map((l) => `<li><b>${esc(l.qty)}x</b> ${esc(l.name)}${l.note ? `<em>${esc(l.note)}</em>` : ''}</li>`).join('')}
      </ul>
      ${o.mode === 'entrega' ? `<p class="ticket__addr">${esc(o.address)}</p>` : ''}
      <footer class="ticket__foot">
        <span>${formatCents(o.total_cents)}${o.payment ? ` · ${esc({ pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' }[o.payment])}` : ''}${o.change_cents ? ` (troco p/ ${formatCents(o.change_cents)})` : ''}</span>
        ${o.status === 'novo' ? `<button class="ticket__cancel" type="button" data-cancel>Cancelar</button>` : ''}
        <button class="ticket__next" type="button" data-next="${esc(NEXT[o.status])}">${ACTION[o.status]}</button>
      </footer>
    </li>`;
}

export function renderCozinha(app) {
  app.innerHTML = `<div class="kitchen"><p class="kitchen__msg">Carregando…</p></div>`;
  const root = app.querySelector('.kitchen');
  let stopped = false;
  const stops = [];

  (async () => {
    let admin;
    try {
      admin = supabase ? await currentAdmin() : startDemo();
    } catch (err) {
      root.innerHTML = `<p class="kitchen__msg" role="alert">${esc(err.message)}</p>`;
      return;
    }
    if (stopped) return;
    if (!admin?.isAdmin) {
      root.innerHTML = `
        <div class="kitchen__msg">
          <p>A tela da cozinha é só para a equipe da loja.</p>
          <a class="btn btn--light" href="#/admin">Entrar no painel</a>
        </div>`;
      return;
    }
    stops.push(startBoard(root, !supabase));
  })();

  return () => {
    stopped = true;
    stops.forEach((s) => s());
  };
}

function startBoard(root, demo) {
  root.innerHTML = `
    <header class="kitchen__top">
      <h1>Cozinha</h1>
      <p class="kitchen__summary" aria-live="off"></p>
      <button class="kitchen__sound" type="button" aria-pressed="false">Ligar som</button>
      <a class="kitchen__back" href="#/admin">Painel</a>
    </header>
    ${demo ? `<p class="kitchen__demo">Demonstração: abra o <a href="#/cardapio?mesa=5" target="_blank" rel="noopener">cardápio da mesa 5</a> em outra aba, faça um pedido e veja ele chegar aqui.</p>` : ''}
    <p class="kitchen__error" role="alert" hidden></p>
    <div class="kitchen__board">
      ${COLUMNS.map(([s, title]) => `
        <section class="lane lane--${s}" aria-labelledby="lane-${s}">
          <h2 id="lane-${s}">${title} <span class="lane__count" data-count="${s}">0</span></h2>
          <ul class="lane__list" data-lane="${s}"></ul>
        </section>`).join('')}
    </div>
    <p class="sr-only" aria-live="assertive" data-announce></p>`;

  const errorBox = root.querySelector('.kitchen__error');
  const announce = root.querySelector('[data-announce]');
  const soundBtn = root.querySelector('.kitchen__sound');
  let known = null; // ids já vistos, para apitar só nos novos
  let audio = null;
  let busy = false;
  let again = false;

  // O navegador só deixa tocar som depois de um toque na tela: por isso o botão.
  soundBtn.addEventListener('click', () => {
    if (audio) {
      audio.close();
      audio = null;
    } else {
      audio = new AudioContext();
      beep();
    }
    soundBtn.setAttribute('aria-pressed', String(Boolean(audio)));
    soundBtn.textContent = audio ? 'Som ligado' : 'Ligar som';
  });

  function beep() {
    if (!audio) return;
    const t = audio.currentTime;
    [0, 0.18].forEach((delay) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.15);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.16);
    });
  }

  async function refresh() {
    // Vários avisos seguidos viram uma busca só.
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      const [orders, summary] = await Promise.all([listOpenOrders(), todaySummary()]);
      errorBox.hidden = true;
      paint(orders, summary);
    } catch (err) {
      errorBox.textContent = `${err.message} Tentando de novo…`;
      errorBox.hidden = false;
    } finally {
      busy = false;
      if (again) {
        again = false;
        refresh();
      }
    }
  }

  function paint(orders, summary) {
    const fresh = known ? orders.filter((o) => o.status === 'novo' && !known.has(o.id)) : [];
    known = new Set(orders.map((o) => o.id));
    for (const [s] of COLUMNS) {
      const list = orders.filter((o) => o.status === s);
      root.querySelector(`[data-lane="${s}"]`).innerHTML = list.map(card).join('') || '<li class="lane__empty">Nada aqui</li>';
      root.querySelector(`[data-count="${s}"]`).textContent = list.length;
    }
    root.querySelector('.kitchen__summary').textContent = `Hoje: ${summary.count} pedido${summary.count === 1 ? '' : 's'} · ${formatCents(summary.totalCents)}`;
    if (fresh.length) {
      beep();
      announce.textContent = `Pedido novo: ${fresh.map((o) => `#${o.code}`).join(', ')}`;
      fresh.forEach((o) => root.querySelector(`[data-id="${CSS.escape(o.id)}"]`)?.classList.add('is-new'));
    }
  }

  root.querySelector('.kitchen__board').addEventListener('click', async (e) => {
    const button = e.target.closest('[data-next], [data-cancel]');
    if (!button || button.disabled) return;
    const id = button.closest('.ticket').dataset.id;
    const status = button.dataset.next ?? 'cancelado';
    if (status === 'cancelado' && !confirm('Cancelar este pedido? O cliente verá "cancelado" na tela dele.')) return;
    button.disabled = true;
    try {
      await setOrderStatus(id, status);
      await refresh();
    } catch (err) {
      button.disabled = false;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  });

  refresh();
  const off = onOrdersChange(refresh);
  // Rede de segurança: se o tempo real cair, a tela ainda se atualiza; e o "há X min" anda.
  const timer = setInterval(refresh, demo ? 5000 : 30000);
  return () => {
    off();
    clearInterval(timer);
    audio?.close();
  };
}
