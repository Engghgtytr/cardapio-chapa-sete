import { addItem } from '../services/cart.js';
import { esc } from '../utils/dom.js';
import { formatCents } from '../utils/money.js';
import { priceWithOptions } from '../utils/options.js';

// Janela de opções do prato (tamanho, sabores, ponto, adicionais). Abre quando o prato tem
// opções; o botão mostra o preço ao vivo e só libera quando a escolha está completa.
const rule = (g) =>
  g.min >= 1 && g.max === 1 ? 'Escolha 1 (obrigatório)'
    : g.min >= 1 ? `Escolha de ${g.min} a ${g.max}`
      : g.max === 1 ? 'Opcional'
        : `Opcional · até ${g.max}`;

const priceLabel = (c, g) => (c.price_cents ? `${g.pricing === 'maior' ? '' : '+ '}${formatCents(c.price_cents)}` : '');

export function createOptionsSheet({ onAdded }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet options-sheet';
  dialog.setAttribute('aria-labelledby', 'opt-title');
  document.body.append(dialog);
  let item = null;
  let adding = false;

  const selection = () => {
    const sel = {};
    for (const g of item.options) {
      sel[g.id] = [...dialog.querySelectorAll(`input[data-group="${CSS.escape(g.id)}"]:checked`)].map((i) => i.value);
    }
    return sel;
  };

  const paint = () => {
    // Trava as caixinhas quando o grupo chega no máximo (ex.: 2 sabores)
    for (const g of item.options) {
      if (g.max === 1) continue;
      const boxes = [...dialog.querySelectorAll(`input[data-group="${CSS.escape(g.id)}"]`)];
      const full = boxes.filter((b) => b.checked).length >= g.max;
      boxes.forEach((b) => (b.disabled = full && !b.checked));
    }
    const button = dialog.querySelector('[data-add-opt]');
    try {
      const { unitCents } = priceWithOptions(item, selection());
      button.disabled = false;
      button.textContent = `Adicionar · ${formatCents(unitCents)}`;
    } catch {
      button.disabled = true;
      button.textContent = 'Escolha as opções obrigatórias';
    }
  };

  const close = () => dialog.open && dialog.close();

  dialog.addEventListener('change', paint);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) close();
    if (!e.target.closest('[data-add-opt]') || adding) return;
    adding = true;
    try {
      const sel = selection();
      priceWithOptions(item, sel); // confere de novo antes de pôr na sacola
      addItem(item.id, sel);
      onAdded?.(item);
      close();
    } catch {
      paint();
    } finally {
      adding = false;
    }
  });

  return {
    open(it) {
      item = it;
      dialog.innerHTML = `
        <div class="sheet__grip" aria-hidden="true"></div>
        <header class="sheet__head">
          <h2 id="opt-title">${esc(item.name)}</h2>
          <button class="icon-btn" type="button" data-close aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </header>
        <div class="sheet__body">
          ${item.description ? `<p class="muted">${esc(item.description)}</p>` : ''}
          ${item.options.map((g) => `
            <fieldset class="opt-group">
              <legend>${esc(g.name)} <span class="opt-rule">${rule(g)}</span></legend>
              ${g.choices.map((c) => `
                <label class="opt-choice">
                  <input type="${g.max === 1 ? 'radio' : 'checkbox'}" name="opt-${esc(g.id)}" data-group="${esc(g.id)}" value="${esc(c.id)}" />
                  <span>${esc(c.name)}</span>
                  <span class="opt-price">${priceLabel(c, g)}</span>
                </label>`).join('')}
              ${g.pricing === 'maior' && g.max > 1 ? '<p class="opt-note">Com mais de um sabor, vale o preço do mais caro.</p>' : ''}
            </fieldset>`).join('')}
        </div>
        <footer class="sheet__foot">
          <button class="btn btn--kitchen" type="button" data-add-opt disabled></button>
        </footer>`;
      paint();
      dialog.showModal();
    },
    destroy() {
      dialog.remove();
    },
  };
}
