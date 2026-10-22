import { prefersReducedMotion } from '../utils/dom.js';

// Vídeos curtos em loop, sem som, usados como "foto que se mexe".
// Regras:
// - Com "reduzir movimento" ou "economia de dados" ligados, o vídeo nem é criado:
//   fica o pôster (uma imagem), que já está na página.
// - Um único botão de pausa vale para todos os vídeos do site (exigência de
//   acessibilidade para movimento que dura mais de 5 s).
// - O vídeo só toca quando está na tela e quando a página pediu (play/pause).

const saveData = () => Boolean(navigator.connection?.saveData);
export const canPlayVideo = () => !prefersReducedMotion() && !saveData();

let paused = false;
const listeners = new Set();

// O vídeo fica escondido do leitor de tela (role="img" não é permitido em <video>);
// quem precisa de descrição põe um texto .sr-only ao lado.
export function loopVideo({ src, poster, className = '' }) {
  const video = document.createElement('video');
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'metadata', poster, src });
  // Sem os atributos, alguns navegadores de celular recusam tocar sozinho.
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.className = className;
  video.setAttribute('aria-hidden', 'true');

  let wanted = false; // a página quer que ele toque agora?
  let visible = false;

  const sync = () => {
    if (wanted && visible && !paused) {
      video.play().catch(() => {}); // recusa do navegador: fica o pôster
    } else {
      video.pause();
    }
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  observer.observe(video);
  listeners.add(sync);
  video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });

  return {
    el: video,
    play() {
      wanted = true;
      sync();
    },
    pause() {
      wanted = false;
      sync();
    },
    destroy() {
      observer.disconnect();
      listeners.delete(sync);
      video.pause();
      video.removeAttribute('src');
      video.load(); // solta a conexão do download
    },
  };
}

const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>';

// Botão que pausa ou volta a tocar todos os vídeos.
export function videoToggle(className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `video-toggle ${className}`.trim();
  const paint = () => {
    button.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
    button.setAttribute('aria-label', paused ? 'Tocar os vídeos' : 'Pausar os vídeos');
  };
  const repaint = () => paint();
  button.addEventListener('click', () => {
    paused = !paused;
    listeners.forEach((fn) => fn());
  });
  listeners.add(repaint);
  paint();
  button.cleanup = () => listeners.delete(repaint);
  return button;
}
