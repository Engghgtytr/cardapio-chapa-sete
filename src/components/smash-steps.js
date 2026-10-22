import { prefersReducedMotion } from '../utils/dom.js';
import { canPlayVideo, loopVideo, videoToggle } from './loop-video.js';

// "Como nasce um smash": a seção que trava na tela enquanto 4 fotos se revezam.
// Sem JavaScript ou com "reduzir movimento", os passos ficam um embaixo do outro.
const STEPS = [
  {
    title: 'A bola',
    text: 'Carne moída no dia, temperada só com sal. Vai para a chapa em formato de bola.',
    alt: 'Bola de carne moída crua',
  },
  {
    title: 'O smash',
    text: 'A espátula prensa a carne contra o ferro bem quente. A borda fica crocante e cheia de sabor.',
    alt: 'Espátula prensando a carne na chapa, com fumaça',
    video: 'passo-2',
    videoAlt: 'Espátula prensando a carne crua contra a chapa',
  },
  {
    title: 'O queijo',
    text: 'Uma fatia de cheddar por cima, ainda na chapa, até derreter sobre a carne.',
    alt: 'Fatia de cheddar derretendo sobre a carne na chapa',
    video: 'passo-3',
    videoAlt: 'Fatia de cheddar derretendo e escorrendo pela carne na chapa',
  },
  {
    title: 'A montagem',
    text: 'Pão brioche selado, molho da casa e pronto. Da chapa para a sua mão em poucos minutos.',
    alt: 'Hambúrguer sendo montado ao lado da chapa',
    video: 'passo-4',
    videoAlt: 'Pão brioche descendo sobre dois smash cobertos de cheddar derretido',
  },
];

const img = (n, alt) =>
  `<img src="/img/passos/passo-${n}-800.webp"
        srcset="/img/passos/passo-${n}-800.webp 800w, /img/passos/passo-${n}-1400.webp 1400w"
        sizes="(min-width: 900px) 580px, 90vw" alt="${alt}" loading="lazy" decoding="async" />`;

export function smashStepsHTML() {
  return `
  <section class="smash" aria-labelledby="smash-title">
    <div class="smash__stage">
      <h2 id="smash-title" class="smash__title">Como nasce um smash</h2>
      <ol class="smash__steps">
        ${STEPS.map((s, i) => `
          <li class="smash__step" data-step="${i}">
            <figure class="smash__photo">${img(i + 1, s.alt)}</figure>
            <div class="smash__caption">
              <p class="smash__count">${i + 1} de ${STEPS.length}</p>
              <h3>${s.title}</h3>
              <p>${s.text}</p>
            </div>
          </li>`).join('')}
      </ol>
      <div class="smash__progress" aria-hidden="true"><span></span></div>
    </div>
  </section>`;
}

// Liga a trava. Devolve a função que desliga (usada ao trocar de página).
export function initSmashSteps(root) {
  const section = root.querySelector('.smash');
  if (!section || prefersReducedMotion()) return () => {};

  section.classList.add('smash--pinned');
  const steps = [...section.querySelectorAll('.smash__step')];
  const bar = section.querySelector('.smash__progress span');

  // Nos passos com vídeo, ele ocupa o lugar da foto (que nem chega a ser baixada).
  // Só o vídeo do passo atual toca.
  const videos = canPlayVideo()
    ? STEPS.map((s, i) => {
        if (!s.video) return null;
        const figure = steps[i].querySelector('.smash__photo');
        const video = loopVideo({ src: `/video/${s.video}.mp4`, poster: `/video/${s.video}.webp`, className: 'smash__video' });
        const description = Object.assign(document.createElement('span'), { className: 'sr-only', textContent: s.videoAlt });
        figure.querySelector('img').hidden = true;
        figure.append(video.el, description);
        return video;
      })
    : [];
  const toggle = videos.length ? videoToggle('smash__toggle') : null;
  if (toggle) section.querySelector('.smash__stage').append(toggle);

  // As fotos ficam empilhadas; carregar todas já evita um "buraco" na troca.
  section.querySelectorAll('img:not([hidden])').forEach((i) => (i.loading = 'eager'));

  let current = -1;
  let frame = 0;

  const update = () => {
    frame = 0;
    const rect = section.getBoundingClientRect();
    const range = rect.height - window.innerHeight;
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    const step = Math.min(steps.length - 1, Math.floor(progress * steps.length));
    bar.style.transform = `scaleX(${(step + 1) / steps.length})`;
    if (step === current) return;
    current = step;
    steps.forEach((el, i) => el.classList.toggle('is-active', i === step));
    videos.forEach((v, i) => (i === step ? v?.play() : v?.pause()));
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    videos.forEach((v) => v?.destroy());
    toggle?.cleanup();
  };
}
