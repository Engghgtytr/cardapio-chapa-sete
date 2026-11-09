import QRCode from 'qrcode';
import { logo } from '../components/brand.js';
import { onlineOrders } from '../components/bag-sheet.js';
import { currentAdmin, startDemo } from '../services/admin-session.js';
import { loadAdminMenu, saveStore } from '../services/admin.js';
import { supabase } from '../services/supabase.js';
import { toast } from '../components/toast.js';
import { esc } from '../utils/dom.js';

// Painel → Pedidos e QR (#/admin/mesas): liga os pedidos pelo site e imprime
// um QR code por mesa. O QR abre o cardápio já com o número da mesa.
const COUNT_KEY = 'chapa7:qtd-mesas';
const MAX_TABLES = 60;

const tableUrl = (n) => `${location.origin}${location.pathname}#/cardapio?mesa=${n}`;

function savedCount() {
  try {
    const n = Number(localStorage.getItem(COUNT_KEY));
    return n >= 1 && n <= MAX_TABLES ? n : 10;
  } catch {
    return 10;
  }
}

export function renderMesas(app) {
  app.innerHTML = '<div class="admin"><main class="admin-main"><p class="admin-loading">Carregando…</p></main></div>';
  let stopped = false;

  (async () => {
    let admin;
    let data;
    try {
      admin = supabase ? await currentAdmin() : startDemo();
      if (admin?.isAdmin) data = await loadAdminMenu();
    } catch (err) {
      if (!stopped) app.querySelector('.admin-main').innerHTML = `<p class="load-error" role="alert">${esc(err.message)}</p>`;
      return;
    }
    if (stopped) return;
    if (!admin?.isAdmin) {
      location.hash = '#/admin';
      return;
    }
    paint(app, data.store);
  })();

  return () => {
    stopped = true;
  };
}

function paint(app, store) {
  const on = onlineOrders(store);
  app.innerHTML = `
    <div class="admin mesas">
      <header class="admin-top no-print">
        ${logo('#/')}
        <nav class="admin-nav" aria-label="Painel">
          <a href="#/admin">Pratos</a>
          <a href="#/admin/loja">Loja</a>
          <a href="#/admin/mesas" aria-current="page">Pedidos e QR</a>
          <a href="#/cozinha">Cozinha</a>
        </nav>
      </header>
      <main class="admin-main">
        <section class="panel no-print">
          <h1>Pedidos pelo site</h1>
          <label class="switch">
            <input type="checkbox" data-online ${on ? 'checked' : ''} />
            <span class="switch__track" aria-hidden="true"></span>
            <span>Receber pedidos na tela da cozinha</span>
          </label>
          <p class="muted">Ligado: a sacola manda o pedido direto para a <a href="#/cozinha">tela da cozinha</a>. Desligado: a sacola abre o WhatsApp com a mensagem pronta, como antes.</p>
        </section>

        <section class="panel no-print">
          <h2>QR code das mesas</h2>
          <div class="mesas__controls">
            <label for="qtd">Quantas mesas?</label>
            <input id="qtd" type="number" min="1" max="${MAX_TABLES}" value="${savedCount()}" inputmode="numeric" />
            <button class="btn btn--dark" type="button" data-print>Imprimir</button>
          </div>
          <p class="muted">Cada QR abre o cardápio já com o número da mesa. Imprima, recorte e cole na mesa (dá para plastificar).</p>
          ${on ? '' : '<p class="mesas__warn">Os pedidos pelo site estão desligados: o QR abre o cardápio, mas o pedido vai pelo WhatsApp, sem número de mesa.</p>'}
        </section>

        <ul class="qr-grid" aria-label="QR codes das mesas"></ul>
      </main>
    </div>`;

  const grid = app.querySelector('.qr-grid');
  const qtd = app.querySelector('#qtd');

  const drawQrs = async () => {
    const n = Math.min(MAX_TABLES, Math.max(1, Math.floor(Number(qtd.value)) || 1));
    try {
      localStorage.setItem(COUNT_KEY, String(n));
    } catch {
      // sem localStorage: só não lembra a quantidade
    }
    const svgs = await Promise.all(
      Array.from({ length: n }, (_, i) => QRCode.toString(tableUrl(i + 1), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })),
    );
    // O SVG vem da biblioteca a partir do nosso próprio endereço; o nome da loja passa pelo esc().
    grid.innerHTML = svgs
      .map((svg, i) => `
        <li class="qr-card">
          <p class="qr-card__store">${esc(store.name)}</p>
          <div class="qr-card__code" role="img" aria-label="QR code da mesa ${i + 1}">${svg}</div>
          <p class="qr-card__table">Mesa ${i + 1}</p>
          <p class="qr-card__hint">Aponte a câmera e faça seu pedido</p>
        </li>`)
      .join('');
  };

  qtd.addEventListener('change', drawQrs);
  app.querySelector('[data-print]').addEventListener('click', () => window.print());

  let saving = false;
  app.querySelector('[data-online]').addEventListener('change', async (e) => {
    if (saving) return;
    saving = true;
    const box = e.target;
    box.disabled = true;
    try {
      await saveStore({ online_orders: box.checked });
      toast(box.checked ? 'Pedidos pelo site ligados.' : 'Pedidos pelo site desligados.');
      store.online_orders = box.checked;
      paint(app, store);
    } catch (err) {
      box.checked = !box.checked;
      toast(err.message);
    } finally {
      saving = false;
      box.disabled = false;
    }
  });

  drawQrs();
}
