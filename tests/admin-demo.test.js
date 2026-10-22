// Painel no modo demonstração (sem Supabase): as mudanças vão para o
// localStorage e aparecem no cardápio deste navegador.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadAdminMenu, resetDemo, saveItem, saveStore } from '../src/services/admin.js';
import { getMenu, menuImage } from '../src/services/menu.js';

// localStorage de mentira (o Node não tem).
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  resetDemo();
});

describe('painel em modo demonstração', () => {
  it('mostra também os pratos fora do cardápio', async () => {
    await saveItem('refrigerante', { active: false });
    const admin = await loadAdminMenu();
    const menu = await getMenu();
    expect(admin.items.map((i) => i.id)).toContain('refrigerante');
    expect(menu.items.map((i) => i.id)).not.toContain('refrigerante');
  });

  it('marcar esgotado e mudar o preço aparece no cardápio', async () => {
    await saveItem('burger-classico', { available: false, price_cents: 3190 });
    const menu = await getMenu();
    const classico = menu.items.find((i) => i.id === 'burger-classico');
    expect(classico).toMatchObject({ available: false, price_cents: 3190 });
  });

  it('prato novo vai para o fim da categoria', async () => {
    const created = await saveItem(null, { name: 'Duplo', description: '', price_cents: 3990, category_id: 'burgers', active: true, available: true });
    expect(created.id).toMatch(/^duplo-/);
    const burgers = (await getMenu()).categories.find((c) => c.id === 'burgers').items;
    expect(burgers.at(-1).id).toBe(created.id);
  });

  it('dados da loja mudam o cardápio', async () => {
    await saveStore({ delivery_fee_cents: 0, whatsapp: '5511912345678' });
    const { store } = await getMenu();
    expect(store).toMatchObject({ delivery_fee_cents: 0, whatsapp: '5511912345678' });
  });

  it('"desfazer" volta aos dados de exemplo', async () => {
    await saveItem('burger-classico', { price_cents: 100 });
    resetDemo();
    const classico = (await getMenu()).items.find((i) => i.id === 'burger-classico');
    expect(classico.price_cents).toBe(2990);
  });

  it('avisa quando um prato não existe mais', async () => {
    await expect(saveItem('nao-existe', { available: false })).rejects.toThrow('não existe mais');
  });
});

describe('menuImage', () => {
  it('entende foto do site, do Supabase, enviada na demonstração e sem foto', () => {
    expect(menuImage('burger-bacon').src).toBe('/img/menu/burger-bacon-320.webp');
    const url = 'https://abc.supabase.co/storage/v1/object/public/menu-images/itens/x.webp';
    expect(menuImage(url)).toEqual({ src: url, srcset: '' });
    expect(menuImage('data:image/webp;base64,AAAA').srcset).toBe('');
    expect(menuImage('')).toBeNull();
  });
});
