// Aviso flutuante curto. A região #toasts já é `aria-live`, então o leitor de tela lê o texto.
export function toast(text, ms = 2800) {
  const box = document.getElementById('toasts');
  const el = document.createElement('p');
  el.className = 'toast';
  el.textContent = text;
  box.append(el);
  setTimeout(() => {
    el.classList.add('toast--out');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, ms);
}
