import { logo, statusPill } from '../components/brand.js';
import { initSmashSteps, smashStepsHTML } from '../components/smash-steps.js';
import { canPlayVideo, loopVideo, videoToggle } from '../components/loop-video.js';
import { getMenu, POSTERS, posterImage } from '../services/menu.js';
import { esc } from '../utils/dom.js';
import { formatCents } from '../utils/money.js';
import { hoursTable } from '../utils/hours.js';

// Cartazes da página da loja, na ordem em que aparecem. Só entram pratos que têm
// cartaz e estão no cardápio; o resto aparece no cardápio completo.
const HOUSE = ['burger-classico', 'burger-bacon', 'burger-onion', 'burger-frango', 'burger-veggie'];
const SIDES = ['batata-cheddar-bacon', 'batata-frita', 'onion-rings', 'limonada', 'milkshake', 'brownie', 'cookie'];

function poster(item) {
  const image = posterImage(item.id);
  return `
    <li class="poster">
      <a href="#/cardapio">
        <img src="${image.src}" srcset="${image.srcset}" sizes="(min-width: 900px) 260px, 62vw"
             alt="${esc(item.name)}" width="480" height="600" loading="lazy" decoding="async" />
        <span class="poster__name">${esc(item.name)}</span>
        <span class="poster__price">${item.available ? formatCents(item.price_cents) : 'Esgotado hoje'}</span>
      </a>
    </li>`;
}

const posterSkeleton = () => '<li class="poster poster--skeleton" aria-hidden="true"><span></span></li>'.repeat(4);

export function renderLoja(app) {
  app.innerHTML = `
  <div class="loja">
    <header class="hero">
      <picture>
        <source media="(orientation: portrait)" srcset="/video/hero-tall.webp" />
        <img class="hero__bg" src="/video/hero-wide.webp" alt="" width="1280" height="720" fetchpriority="high" />
      </picture>
      <nav class="hero__nav">
        ${logo()}
        <a class="hero__link" href="#/cardapio">Cardápio</a>
      </nav>
      <div class="hero__content">
        <p class="status" data-status>&nbsp;</p>
        <h1 class="hero__title">Smash burger prensado na hora</h1>
        <p class="hero__text">Chapa de ferro, carne moída no dia e pão brioche. Escolha no cardápio e finalize o pedido pelo WhatsApp.</p>
        <a class="btn btn--cheddar" href="#/cardapio">Ver cardápio</a>
      </div>
    </header>

    <main>
      ${smashStepsHTML()}

      <section class="rail-section" aria-labelledby="casa-title">
        <div class="rail-section__head">
          <h2 id="casa-title">Os burgers da casa</h2>
          <a class="text-link" href="#/cardapio">Cardápio completo</a>
        </div>
        <ul class="rail" data-rail="house">${posterSkeleton()}</ul>
      </section>

      <section class="rail-section" aria-labelledby="junto-title">
        <div class="rail-section__head">
          <h2 id="junto-title">Para pedir junto</h2>
        </div>
        <ul class="rail" data-rail="sides">${posterSkeleton()}</ul>
      </section>

      <section class="visit" aria-labelledby="visit-title">
        <h2 id="visit-title">Onde estamos</h2>
        <div class="visit__grid">
          <div>
            <h3>Endereço</h3>
            <p data-address>&nbsp;</p>
            <p class="muted">Endereço fictício, criado para esta demonstração.</p>
          </div>
          <div>
            <h3>Horário</h3>
            <dl class="hours" data-hours></dl>
          </div>
          <div>
            <h3>Pedidos</h3>
            <p>Monte o pedido no cardápio. A mensagem pronta abre no WhatsApp da loja.</p>
            <button class="btn btn--ghost" type="button" data-whats aria-expanded="false" aria-controls="whats-note">Chamar no WhatsApp</button>
            <p class="muted" id="whats-note" hidden>Esta loja é fictícia, então o WhatsApp não abre aqui. No site de uma loja real, este botão abre a conversa com o número dela.</p>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <p>Projeto de portfólio da <strong>Penchel.Dev</strong>. A Chapa Sete é uma loja fictícia e as fotos e vídeos foram gerados com IA.</p>
      <p class="footer__links"><a href="#/privacidade">Privacidade</a> <a href="#/admin">Painel da loja</a></p>
    </footer>
  </div>`;

  const page = app.querySelector('.loja');
  getMenu()
    .then((menu) => page.isConnected && fillLoja(app, menu))
    .catch(() => {
      if (!page.isConnected) return;
      // Sem dados, os cartazes somem e o resto da página continua útil.
      app.querySelectorAll('.rail-section').forEach((s) => (s.hidden = true));
      app.querySelector('[data-status]').hidden = true;
    });

  const stopHero = initHeroVideo(app.querySelector('.hero'));
  const stopSteps = initSmashSteps(app);
  return () => {
    stopHero();
    stopSteps();
  };
}

function fillLoja(app, { store, items }) {
  app.querySelector('[data-status]').outerHTML = statusPill(store.hours);
  app.querySelector('[data-address]').textContent = store.address;
  app.querySelector('[data-hours]').innerHTML = hoursTable(store.hours)
    .map((r) => `<dt>${esc(r.days)}</dt><dd>${esc(r.value)}</dd>`)
    .join('');

  const byId = new Map(items.map((i) => [i.id, i]));
  const rail = (ids) => ids.filter((id) => POSTERS.has(id) && byId.has(id)).map((id) => poster(byId.get(id)));
  for (const [name, ids] of [['house', HOUSE], ['sides', SIDES]]) {
    const cards = rail(ids);
    const list = app.querySelector(`[data-rail="${name}"]`);
    list.innerHTML = cards.join('');
    list.closest('.rail-section').hidden = cards.length === 0;
  }

  // Com número cadastrado, o botão abre o WhatsApp da loja; sem número (demonstração), explica.
  const whats = app.querySelector('[data-whats]');
  if (store.whatsapp) {
    const link = document.createElement('a');
    link.className = whats.className;
    link.href = `https://wa.me/${encodeURIComponent(store.whatsapp)}`;
    link.rel = 'noopener';
    link.target = '_blank';
    link.textContent = 'Chamar no WhatsApp';
    whats.replaceWith(link);
    app.querySelector('#whats-note').remove();
  } else {
    whats.addEventListener('click', () => {
      const note = app.querySelector('#whats-note');
      note.hidden = !note.hidden;
      whats.setAttribute('aria-expanded', String(!note.hidden));
    });
  }
}

// A foto do topo é o primeiro quadro do vídeo: quando ele começa, não há troca visível.
// O vídeo em pé (celular) é menor e mostra só o centro da cena.
function initHeroVideo(hero) {
  if (!canPlayVideo()) return () => {};
  const tall = matchMedia('(orientation: portrait)').matches;
  const name = tall ? 'hero-tall' : 'hero-wide';
  const video = loopVideo({ src: `/video/${name}.mp4`, poster: `/video/${name}.webp`, className: 'hero__bg hero__video' });
  const toggle = videoToggle('hero__toggle');
  hero.querySelector('picture').after(video.el);
  hero.append(toggle);
  video.play();
  return () => {
    video.destroy();
    toggle.cleanup();
  };
}
