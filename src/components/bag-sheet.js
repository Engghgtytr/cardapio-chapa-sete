import { NOTE_MAX, cartLines, onCartChange, setNote, setQty } from '../services/cart.js';
import { LIMITS, PAYMENTS, buildOrderMessage, orderTotals, validateOrder, whatsappUrl } from '../utils/order.js';
import { esc } from '../utils/dom.js';
import { formatCents } from '../utils/money.js';
import { openStatus } from '../utils/hours.js';

// O que a pessoa preencheu fica guardado enquanto a página está aberta,
// para não precisar digitar de novo ao fechar e abrir a sacola.
const form = { name: '', mode: 'retirada', address: '', payment: '', change: '' };

const stepIcon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" /></svg>`;
const MINUS = stepIcon('M5 12h14');
const PLUS = stepIcon('M12 5v14M5 12h14');

const lineHTML = ({ item, qty, note, subtotalCents }) => `
  <li class="bag-line">
    <div class="bag-line__top">
      <p class="bag-line__name">${esc(item.name)}</p>
      <p class="bag-line__price">${formatCents(subtotalCents)}</p>
    </div>
    <div class="bag-line__bottom">
      <div class="stepper" role="group" aria-label="Quantidade de ${esc(item.name)}">
        <button type="button" data-qty="${esc(item.id)}" data-delta="-1" aria-label="${qty === 1 ? 'Remover' : 'Tirar um'} ${esc(item.name)}">${MINUS}</button>
        <output aria-live="polite">${qty}</output>
        <button type="button" data-qty="${esc(item.id)}" data-delta="1" aria-label="Mais um ${esc(item.name)}">${PLUS}</button>
      </div>
      <input class="bag-line__note" type="text" data-note="${esc(item.id)}" value="${esc(note)}" maxlength="${NOTE_MAX}"
             placeholder="Observação (ex.: sem cebola)" aria-label="Observação para ${esc(item.name)}" />
    </div>
  </li>`;

const radio = (name, value, label, checked) => `
  <label class="choice"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} /><span>${label}</span></label>`;

export function createBagSheet(store, items) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.setAttribute('aria-labelledby', 'bag-title');
  document.body.append(dialog);

  dialog.innerHTML = `
    <div class="sheet__grip" aria-hidden="true"></div>
    <header class="sheet__head">
      <h2 id="bag-title">Sua sacola</h2>
      <button class="icon-btn" type="button" data-close aria-label="Fechar sacola">${stepIcon('M6 6l12 12M18 6L6 18')}</button>
    </header>
    <div class="sheet__body">
      <div data-view="order">
        <ul class="bag-lines"></ul>
        <form class="bag-form" novalidate>
          <div class="field">
            <label for="f-name">Seu nome</label>
            <input id="f-name" name="name" autocomplete="name" maxlength="${LIMITS.name}" value="${esc(form.name)}" />
            <p class="field__error" id="e-name"></p>
          </div>
          <fieldset class="field">
            <legend>Como você quer receber?</legend>
            <div class="choices">
              ${radio('mode', 'retirada', 'Retirar no balcão', form.mode === 'retirada')}
              ${radio('mode', 'entrega', `Entrega (+ ${formatCents(store.delivery_fee_cents)})`, form.mode === 'entrega')}
            </div>
          </fieldset>
          <div class="field" data-when="entrega">
            <label for="f-address">Endereço de entrega</label>
            <textarea id="f-address" name="address" rows="2" autocomplete="street-address" maxlength="${LIMITS.address}"
                      placeholder="Rua, número, bairro e complemento">${esc(form.address)}</textarea>
            <p class="field__error" id="e-address"></p>
          </div>
          <fieldset class="field">
            <legend>Pagamento</legend>
            <div class="choices">
              ${Object.entries(PAYMENTS).map(([v, l]) => radio('payment', v, l.replace(/ \(.*\)/, ''), form.payment === v)).join('')}
            </div>
            <p class="field__error" id="e-payment"></p>
          </fieldset>
          <div class="field" data-when="dinheiro">
            <label for="f-change">Troco para quanto? <span class="optional">(opcional)</span></label>
            <input id="f-change" name="change" inputmode="decimal" placeholder="Ex.: 100" value="${esc(form.change)}" />
            <p class="field__error" id="e-change"></p>
          </div>
        </form>
      </div>
      <div data-view="preview" hidden>
        <p class="preview__intro"><strong>Esta loja é fictícia</strong>, então o WhatsApp não abre. Esta é a mensagem que a loja receberia:</p>
        <pre class="preview__msg"></pre>
        <p class="muted">Numa loja real, o botão abre a conversa com essa mensagem já escrita. A pessoa só toca em enviar.</p>
      </div>
      <div data-view="empty" hidden>
        <p class="bag-empty">Sua sacola está vazia. Toque no <strong>+</strong> de um prato para adicionar.</p>
      </div>
    </div>
    <footer class="sheet__foot">
      <dl class="totals"></dl>
      <p class="closed-note" hidden></p>
      <button class="btn btn--whats" type="button" data-send>Enviar pedido pelo WhatsApp</button>
      <button class="btn btn--ghost-dark" type="button" data-back hidden>Voltar ao pedido</button>
    </footer>`;

  const $ = (s) => dialog.querySelector(s);
  const list = $('.bag-lines');
  const formEl = $('.bag-form');
  const views = { order: $('[data-view="order"]'), preview: $('[data-view="preview"]'), empty: $('[data-view="empty"]') };

  const show = (name) => {
    Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
    $('[data-send]').hidden = name !== 'order';
    $('[data-back]').hidden = name !== 'preview';
    $('.totals').hidden = name === 'empty';
  };

  const paint = () => {
    const lines = cartLines(items);
    // Redesenhar a lista apaga o foco; guardamos qual botão estava focado para devolver.
    const focused = document.activeElement?.closest?.('.bag-lines [data-qty]');
    const focusKey = focused && `[data-qty="${focused.dataset.qty}"][data-delta="${focused.dataset.delta}"]`;
    list.innerHTML = lines.map(lineHTML).join('');
    if (focusKey) (list.querySelector(focusKey) ?? $('[data-close]')).focus();

    const { subtotalCents, feeCents, totalCents } = orderTotals(lines, form.mode, store.delivery_fee_cents);
    $('.totals').innerHTML = `
      <dt>Subtotal</dt><dd>${formatCents(subtotalCents)}</dd>
      ${form.mode === 'entrega' ? `<dt>Entrega</dt><dd>${formatCents(feeCents)}</dd>` : ''}
      <dt class="totals__total">Total</dt><dd class="totals__total">${formatCents(totalCents)}</dd>`;
    formEl.querySelectorAll('[data-when]').forEach((el) => {
      el.hidden = el.dataset.when !== form.mode && el.dataset.when !== form.payment;
    });
    if (lines.length === 0) show('empty');
    else if (!views.preview.hidden) show('preview');
    else show('order');
  };

  const showErrors = (errors) => {
    for (const key of ['name', 'address', 'payment', 'change']) {
      const box = $(`#e-${key}`);
      const field = formEl.elements[key];
      box.textContent = errors[key] ?? '';
      const inputs = field instanceof RadioNodeList ? [...field] : [field];
      inputs.forEach((el) => {
        el.toggleAttribute('aria-invalid', Boolean(errors[key]));
        if (errors[key]) el.setAttribute('aria-describedby', `e-${key}`);
        else el.removeAttribute('aria-describedby');
      });
    }
  };

  list.addEventListener('click', (e) => {
    const button = e.target.closest('[data-qty]');
    if (!button) return;
    const line = cartLines(items).find((l) => l.item.id === button.dataset.qty);
    setQty(button.dataset.qty, line.qty + Number(button.dataset.delta));
  });
  list.addEventListener('input', (e) => {
    if (e.target.dataset.note) setNote(e.target.dataset.note, e.target.value);
  });

  let lastErrors = {};

  formEl.addEventListener('input', (e) => {
    const { name, value } = e.target;
    if (!(name in form)) return;
    form[name] = value;
    if (name === 'mode' || name === 'payment') paint();
    // O erro do campo some assim que a pessoa corrige.
    if (lastErrors[name]) {
      delete lastErrors[name];
      showErrors(lastErrors);
    }
  });

  $('[data-send]').addEventListener('click', () => {
    const lines = cartLines(items);
    const { totalCents } = orderTotals(lines, form.mode, store.delivery_fee_cents);
    lastErrors = validateOrder(form, lines, totalCents);
    showErrors(lastErrors);
    const first = ['name', 'address', 'payment', 'change'].find((k) => lastErrors[k]);
    if (first) {
      const field = formEl.elements[first];
      (field instanceof RadioNodeList ? field[0] : field).focus();
      return;
    }

    const message = buildOrderMessage({ storeName: store.name, lines, form, deliveryFeeCents: store.delivery_fee_cents });
    const url = whatsappUrl(store.whatsapp, message);
    if (url) {
      window.location.href = url;
      return;
    }
    // Mostra como o WhatsApp exibe: *texto* vira negrito. Montado com nós de texto, sem innerHTML.
    const preview = $('.preview__msg');
    preview.replaceChildren(
      ...message.split('\n').flatMap((line) => {
        const bold = line.match(/^\*(.+)\*$/);
        const node = bold ? Object.assign(document.createElement('strong'), { textContent: bold[1] }) : document.createTextNode(line);
        return [node, document.createTextNode('\n')];
      }),
    );
    show('preview');
    $('[data-back]').focus();
  });

  $('[data-back]').addEventListener('click', () => {
    show('order');
    $('[data-send]').focus();
  });

  // Fechar: espera a animação de saída antes de tirar o painel da tela.
  const close = () => {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    const done = () => {
      dialog.classList.remove('is-closing');
      dialog.close();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    dialog.addEventListener('transitionend', done, { once: true });
    setTimeout(() => dialog.open && dialog.classList.contains('is-closing') && done(), 300);
  };

  $('[data-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // Toque fora do painel (no fundo escurecido) também fecha.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  const off = onCartChange(() => dialog.open && paint());

  return {
    open() {
      const status = openStatus(store.hours);
      const note = $('.closed-note');
      note.hidden = status.open;
      note.textContent = status.open ? '' : `A loja está fechada agora (${status.text.replace('Fechado · ', '')}). O pedido será visto quando ela abrir.`;
      paint();
      if (views.preview.hidden === false) show('order');
      dialog.showModal();
    },
    destroy() {
      off();
      dialog.remove();
    },
  };
}
