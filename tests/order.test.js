import { beforeEach, describe, expect, it } from 'vitest';
import { addItem, cartLines, clearCart, setNote, setQty } from '../src/services/cart.js';
import { DEMO_ITEMS } from '../src/data/demo-menu.js';
import { buildOrderMessage, clean, parseMoney, validateOrder, whatsappUrl } from '../src/utils/order.js';

// O Intl usa espaço especial entre "R$" e o número; normalizamos para comparar.
const plain = (s) => s.replace(/ /g, ' ');

const form = (extra = {}) => ({ name: 'Ana', mode: 'retirada', address: '', payment: 'pix', change: '', ...extra });

describe('sacola com quantidade e observação', () => {
  beforeEach(() => clearCart());

  it('muda a quantidade e remove com zero', () => {
    addItem('burger-bacon');
    setQty('burger-bacon', 3);
    expect(cartLines(DEMO_ITEMS)[0]).toMatchObject({ qty: 3, subtotalCents: 10470 });
    setQty('burger-bacon', 0);
    expect(cartLines(DEMO_ITEMS)).toEqual([]);
  });

  it('guarda a observação com limite de tamanho', () => {
    addItem('burger-classico');
    setNote('burger-classico', 'x'.repeat(500));
    expect(cartLines(DEMO_ITEMS)[0].note).toHaveLength(140);
  });

  it('deixa de fora prato esgotado', () => {
    addItem('cookie');
    expect(cartLines(DEMO_ITEMS)).toEqual([]);
  });
});

describe('parseMoney', () => {
  it.each([
    ['100', 10000],
    ['100,5', 10050],
    ['R$ 1.000,00', 100000],
    ['50,00', 5000],
  ])('%s → %i centavos', (text, cents) => expect(parseMoney(text)).toBe(cents));

  it.each(['abc', '10,999', '1.00', '-5'])('rejeita %s', (text) => expect(parseMoney(text)).toBeNull());
});

describe('validateOrder', () => {
  const lines = [{ subtotalCents: 2990 }];

  it('aceita um pedido completo', () => {
    expect(validateOrder(form(), lines, 2990)).toEqual({});
  });

  it('exige itens, nome e pagamento', () => {
    const errors = validateOrder(form({ name: '   ', payment: '' }), [], 0);
    expect(Object.keys(errors).sort()).toEqual(['cart', 'name', 'payment']);
  });

  it('exige endereço só na entrega', () => {
    expect(validateOrder(form({ mode: 'entrega' }), lines, 2990).address).toBeDefined();
    expect(validateOrder(form({ mode: 'retirada' }), lines, 2990).address).toBeUndefined();
  });

  it('troco menor que o total não passa', () => {
    expect(plain(validateOrder(form({ payment: 'dinheiro', change: '20' }), lines, 2990).change)).toBe(
      'O troco precisa ser para R$ 29,90 ou mais.',
    );
    expect(validateOrder(form({ payment: 'dinheiro', change: '50' }), lines, 2990)).toEqual({});
  });
});

describe('mensagem do WhatsApp', () => {
  beforeEach(() => clearCart());

  it('monta o pedido de entrega com observação e troco', () => {
    addItem('burger-classico');
    addItem('burger-classico');
    setNote('burger-classico', 'sem cebola\nbem passado');
    addItem('refrigerante');
    const text = buildOrderMessage({
      storeName: 'Chapa Sete',
      lines: cartLines(DEMO_ITEMS),
      form: form({ mode: 'entrega', address: 'Rua A, 10', payment: 'dinheiro', change: '100' }),
      deliveryFeeCents: 600,
    });
    expect(plain(text)).toBe(
      [
        '*Novo pedido · Chapa Sete*',
        '',
        '2x Clássico Smash · R$ 59,80',
        '   Obs.: sem cebola bem passado',
        '1x Refrigerante lata · R$ 7,90',
        '',
        'Subtotal: R$ 67,70',
        'Taxa de entrega: R$ 6,00',
        '*Total: R$ 73,70*',
        '',
        'Nome: Ana',
        'Entrega em: Rua A, 10',
        'Pagamento: Dinheiro (troco para R$ 100,00)',
      ].join('\n'),
    );
  });

  it('retirada não cobra taxa', () => {
    addItem('burger-bacon');
    const text = plain(buildOrderMessage({ storeName: 'X', lines: cartLines(DEMO_ITEMS), form: form(), deliveryFeeCents: 600 }));
    expect(text).toContain('Retirada no balcão');
    expect(text).not.toContain('Taxa de entrega');
    expect(text).toContain('*Total: R$ 34,90*');
  });

  it('o link codifica acentos, quebras de linha, & e #', () => {
    const url = whatsappUrl('+55 (11) 91234-5678', 'Pão & café #1\nok');
    expect(url).toBe('https://wa.me/5511912345678?text=P%C3%A3o%20%26%20caf%C3%A9%20%231%0Aok');
    expect(decodeURIComponent(new URL(url).searchParams.get('text'))).toBe('Pão & café #1\nok');
  });

  it('sem número válido não gera link (modo demonstração)', () => {
    expect(whatsappUrl(null, 'oi')).toBeNull();
    expect(whatsappUrl('1234', 'oi')).toBeNull();
  });

  it('clean tira caracteres de controle e corta no limite', () => {
    expect(clean('  a\u0000b\t\tc  ')).toBe('a b c');
    expect(clean('abcdef', 3)).toBe('abc');
  });
});
