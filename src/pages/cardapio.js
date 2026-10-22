import { logo, statusPill } from '../components/brand.js';
import { createBagSheet } from '../components/bag-sheet.js';
import { getMenu, menuImage } from '../services/menu.js';
import { addItem, cartSummary, onCartChange } from '../services/cart.js';
import { esc } from '../utils/dom.js';
import { formatCents } from '../utils/money.js';

const skeleton = () => `
  <div class="menu-section" aria-hidden="true">
    ${'<div class="dish dish--skeleton"><div><span></span><span></span><span></span></div><div class="dish__photo"></div></div>'.repeat(4)}
  </div>`;

function dish(item) {
  const image = menuImage(item.image);
  const photo = image
    ? `<img src="${esc(image.src)}" ${image.srcset ? `srcset="${esc(image.srcset)}" sizes="112px"` : ''} alt="" width="320" height="320" loading="lazy" decoding="async" />`
    : '';
  const action = item.available
    ? `<button class="add" type="button" data-add="${esc(item.id)}" aria-label="Adicionar ${esc(item.name)}">
         <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
       </button>`
    : '';
  return `
    <li class="dish ${item.available ? '' : 'dish--out'}">
      <div class="dish__info">
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.description)}</p>
        <p class="dish__price">${item.available ? formatCents(item.price_cents) : '<span class="badge">Esgotado</span>'}</p>
      </div>
      <div class="dish__photo">
        ${photo}
        ${action}
      </div>
    </li>`;
}

export function renderCardapio(app) {
  app.innerHTML = `
  <div class="cardapio">
    <header class="menu-header">
      <a class="back" href="#/" aria-label="Voltar para a página da loja">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </a>
      ${logo('#/')}
      <span data-status></span>
    </header>
    <nav class="tabs" aria-label="Categorias"><div class="tabs__list"></div></nav>
    <main class="menu" id="menu">${skeleton()}</main>
    <div class="cart-bar" hidden>
      <button class="cart-bar__btn" type="button">
        <span class="cart-bar__count">0</span>
        <span>Ver sacola</span>
        <span class="cart-bar__total"></span>
      </button>
    </div>
    <p class="sr-only" aria-live="polite" data-announce></p>
  </div>`;

  const offs = [];
  const page = app.querySelector('.cardapio');
  const main = app.querySelector('#menu');

  const load = () => {
    main.innerHTML = skeleton();
    main.setAttribute('aria-busy', 'true');
    getMenu()
      .then((menu) => {
        // A pessoa pode ter saído da página antes de os dados chegarem.
        if (!page.isConnected) return;
        main.removeAttribute('aria-busy');
        fillMenu(app, menu, offs);
      })
      .catch((err) => {
        if (!page.isConnected) return;
        main.removeAttribute('aria-busy');
        main.innerHTML = `
          <div class="load-error" role="alert">
            <p>${esc(err.message)}</p>
            <button class="btn btn--dark" type="button" data-retry>Tentar de novo</button>
          </div>`;
        main.querySelector('[data-retry]').addEventListener('click', load);
      });
  };
  load();
  return () => offs.forEach((off) => off());
}

function fillMenu(app, menu, offs) {
  const main = app.querySelector('#menu');
  app.querySelector('[data-status]').outerHTML = statusPill(menu.store.hours);
  if (menu.categories.length === 0) {
    main.innerHTML = '<p class="load-error">O cardápio está vazio no momento. Volte mais tarde.</p>';
    return;
  }
  main.innerHTML = menu.categories
    .map((c) => `
      <section class="menu-section" id="cat-${esc(c.id)}" aria-labelledby="h-${esc(c.id)}">
        <h2 id="h-${esc(c.id)}">${esc(c.name)}</h2>
        <ul class="dishes">${c.items.map(dish).join('')}</ul>
      </section>`)
    .join('');

  // A foto aparece com fade quando termina de carregar (sem "pintar aos pedaços").
  main.querySelectorAll('.dish__photo img').forEach((img) => {
    if (img.complete) img.classList.add('is-loaded');
    else img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
  });

  offs.push(initTabs(app, menu.categories));
  offs.push(initCart(app, menu.store, menu.items));
}

// Abas de categoria: acompanham a rolagem e o indicador desliza até a aba atual.
function initTabs(app, categories) {
  const list = app.querySelector('.tabs__list');
  list.innerHTML =
    categories.map((c) => `<a class="tab" href="#cat-${esc(c.id)}" data-cat="${esc(c.id)}">${esc(c.name)}</a>`).join('') +
    '<span class="tabs__indicator" aria-hidden="true"></span>';

  const tabs = [...list.querySelectorAll('.tab')];
  const indicator = list.querySelector('.tabs__indicator');
  const sections = categories.map((c) => app.querySelector(`#cat-${c.id}`));
  let current = -1;
  let frame = 0;

  const select = (index) => {
    if (index === current) return;
    current = index;
    tabs.forEach((t, i) => (i === index ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current')));
    const tab = tabs[index];
    indicator.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
    // Mantém a aba atual visível quando a lista de abas é maior que a tela.
    list.scrollTo({ left: tab.offsetLeft - 16, behavior: 'smooth' });
  };

  // A barra de abas fica presa no topo; a seção atual é a última que já passou por baixo dela.
  const update = () => {
    frame = 0;
    const line = list.getBoundingClientRect().bottom + 24;
    let index = 0;
    sections.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= line) index = i;
    });
    // No fim da página, a última categoria pode ser curta demais para chegar ao topo.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) index = sections.length - 1;
    select(index);
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  // O link "#cat-..." trocaria a rota (o app usa o hash). Rolamos até a seção sem mudar o endereço.
  list.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    e.preventDefault();
    app.querySelector(`#cat-${tab.dataset.cat}`).scrollIntoView({ behavior: 'smooth' });
  });

  update();
  requestAnimationFrame(() => list.classList.add('is-ready'));
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

function initCart(app, store, items) {
  const bar = app.querySelector('.cart-bar');
  const count = bar.querySelector('.cart-bar__count');
  const total = bar.querySelector('.cart-bar__total');
  const announce = app.querySelector('[data-announce]');
  const byId = new Map(items.map((i) => [i.id, i]));

  const paint = () => {
    const summary = cartSummary(items);
    bar.hidden = summary.count === 0;
    count.textContent = summary.count;
    total.textContent = formatCents(summary.totalCents);
  };

  app.querySelector('#menu').addEventListener('click', (e) => {
    const button = e.target.closest('[data-add]');
    if (!button) return;
    addItem(button.dataset.add);
    announce.textContent = `${byId.get(button.dataset.add).name} adicionado`;
    // O contador dá um "pulinho" para mostrar onde o item foi parar.
    count.classList.remove('is-bumping');
    void count.offsetWidth;
    count.classList.add('is-bumping');
  });

  const sheet = createBagSheet(store, items);
  bar.querySelector('button').addEventListener('click', () => sheet.open());

  paint();
  const off = onCartChange(paint);
  return () => {
    off();
    sheet.destroy();
  };
}
