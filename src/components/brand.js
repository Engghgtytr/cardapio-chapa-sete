import { esc } from '../utils/dom.js';
import { openStatus } from '../utils/hours.js';

// Logo feito em código: o "7" num selo cor de cheddar + o nome em letra larga.
export const logo = (href = '#/') => `
  <a class="logo" href="${href}" aria-label="Chapa Sete Smash Burger, página inicial">
    <svg class="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="12" />
      <path d="M18 16h28v7L31 50h-9l14-26H18z" />
    </svg>
    <span class="logo__name">Chapa Sete<small>Smash Burger</small></span>
  </a>`;

export function statusPill(hours) {
  const status = openStatus(hours);
  return `<p class="status ${status.open ? 'status--open' : ''}">${esc(status.text)}</p>`;
}
