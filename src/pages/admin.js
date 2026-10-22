import { logo } from '../components/brand.js';
import { toast } from '../components/toast.js';
import { currentAdmin, isDemo, signIn, signOut, startDemo } from '../services/admin-session.js';
import { LOAD_ERROR, loadAdminMenu, resetDemo, saveItem, saveStore, uploadItemPhoto } from '../services/admin.js';
import { hasDemoChanges } from '../services/demo-data.js';
import { menuImage } from '../services/menu.js';
import { esc } from '../utils/dom.js';
import { formatCents } from '../utils/money.js';
import { ITEM_LIMITS, formatWhatsapp, validateItem, validateStore } from '../utils/menu-rules.js';
import { checkPhoto, squarePhoto } from '../utils/photo.js';

// Painel do dono: marcar esgotado, mudar preço e foto, criar prato e ajustar a loja.
// Rotas: #/admin (pratos) e #/admin/loja (dados da loja).

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // a tabela começa na segunda

// O que foi digitado no formulário de um prato e não foi salvo volta ao reabrir.
const drafts = new Map();

const ICON = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>',
};

const money = (cents) => (cents / 100).toFixed(2).replace('.', ',');

export function renderAdmin(app, view = 'pratos') {
  const ctx = { app, view, alive: true, cleanups: [] };
  app.innerHTML = '<div class="admin"><p class="admin-loading">Carregando…</p></div>';
  currentAdmin()
    .then((admin) => ctx.alive && route(ctx, admin))
    .catch((err) => ctx.alive && showFatal(ctx, err.message));
  return () => {
    ctx.alive = false;
    ctx.cleanups.forEach((fn) => fn());
  };
}

function route(ctx, admin) {
  if (!admin) return showLogin(ctx);
  if (!admin.isAdmin) return showNoAccess(ctx, admin);
  return showPanel(ctx, admin);
}

function showFatal(ctx, message) {
  ctx.app.innerHTML = `
    <div class="admin admin--center">
      <main class="login">
        <p role="alert">${esc(message)}</p>
        <button class="btn btn--dark" type="button" data-retry>Tentar de novo</button>
      </main>
    </div>`;
  ctx.app.querySelector('[data-retry]').addEventListener('click', () => {
    ctx.cleanups.forEach((fn) => fn());
    Object.assign(ctx, { cleanups: [] });
    renderAgain(ctx);
  });
}

function renderAgain(ctx) {
  ctx.app.innerHTML = '<div class="admin"><p class="admin-loading">Carregando…</p></div>';
  currentAdmin()
    .then((admin) => ctx.alive && route(ctx, admin))
    .catch((err) => ctx.alive && showFatal(ctx, err.message));
}

// ---------- Entrar ----------

function showLogin(ctx) {
  if (isDemo()) {
    ctx.app.innerHTML = `
      <div class="admin admin--center">
        <main class="login">
          ${logo('#/')}
          <h1>Painel da loja</h1>
          <p>É aqui que o dono muda preços e fotos, marca o que esgotou e ajusta o horário.</p>
          <p>Como a loja é fictícia, você pode testar sem senha. <strong>As mudanças ficam só no seu navegador</strong>: ninguém mais vê.</p>
          <button class="btn btn--dark" type="button" data-demo>Entrar na demonstração</button>
          <a class="text-link-dark" href="#/">Voltar para a loja</a>
        </main>
      </div>`;
    ctx.app.querySelector('[data-demo]').addEventListener('click', () => showPanel(ctx, startDemo()));
    return;
  }

  ctx.app.innerHTML = `
    <div class="admin admin--center">
      <main class="login">
        ${logo('#/')}
        <h1>Painel da loja</h1>
        <p>Entre para mudar preços, fotos e o que está esgotado.</p>
        <form class="admin-form" novalidate>
          <div class="field">
            <label for="l-email">E-mail</label>
            <input id="l-email" name="email" type="email" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="l-pass">Senha</label>
            <input id="l-pass" name="password" type="password" autocomplete="current-password" required />
          </div>
          <p class="form-error" role="alert"></p>
          <button class="btn btn--dark" type="submit">Entrar</button>
        </form>
        <p class="muted">O acesso é criado por quem cuida do site. Não há cadastro aberto.</p>
      </main>
    </div>`;

  const form = ctx.app.querySelector('form');
  const error = form.querySelector('.form-error');
  const button = form.querySelector('button');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.disabled) return; // trava o clique duplo
    const { email: emailField, password: passField } = form.elements;
    const email = emailField.value.trim();
    const password = passField.value;
    if (!email || !password) {
      error.textContent = 'Preencha o e-mail e a senha.';
      (email ? passField : emailField).focus();
      return;
    }
    setBusy(button, true, 'Entrando…');
    error.textContent = '';
    try {
      const admin = await signIn(email, password);
      if (ctx.alive) route(ctx, admin);
    } catch (err) {
      if (!ctx.alive) return;
      setBusy(button, false);
      error.textContent = err.message;
      form.elements.password.select();
    }
  });
}

function showNoAccess(ctx, admin) {
  ctx.app.innerHTML = `
    <div class="admin admin--center">
      <main class="login">
        ${logo('#/')}
        <h1>Sem acesso ao painel</h1>
        <p>A conta <strong>${esc(admin.email)}</strong> entrou, mas não tem permissão para mudar o cardápio. Peça para quem cuida do site liberar o acesso.</p>
        <button class="btn btn--dark" type="button" data-out>Sair</button>
      </main>
    </div>`;
  ctx.app.querySelector('[data-out]').addEventListener('click', async () => {
    await signOut();
    if (ctx.alive) showLogin(ctx);
  });
}

// ---------- Painel ----------

async function showPanel(ctx, admin) {
  const demo = admin.mode === 'demo';
  ctx.app.innerHTML = `
    <div class="admin">
      <header class="admin-top">
        ${logo('#/')}
        <nav class="admin-nav" aria-label="Painel">
          <a href="#/admin" ${ctx.view === 'pratos' ? 'aria-current="page"' : ''}>Pratos</a>
          <a href="#/admin/loja" ${ctx.view === 'loja' ? 'aria-current="page"' : ''}>Loja</a>
        </nav>
        <button class="admin-out" type="button" data-out>Sair</button>
      </header>
      ${demo ? `
        <div class="demo-banner">
          <p><strong>Demonstração.</strong> O que você mudar aparece no cardápio só neste navegador.</p>
          <button class="text-link-dark" type="button" data-reset ${hasDemoChanges() ? '' : 'hidden'}>Desfazer minhas mudanças</button>
        </div>` : ''}
      <main class="admin-main" aria-busy="true"><p class="admin-loading">Carregando…</p></main>
    </div>`;

  ctx.app.querySelector('[data-out]').addEventListener('click', async () => {
    await signOut();
    location.hash = '#/';
  });
  ctx.app.querySelector('[data-reset]')?.addEventListener('click', (e) => {
    resetDemo();
    e.target.hidden = true;
    toast('Pronto: voltaram os dados de exemplo.');
    loadView(ctx);
  });

  loadView(ctx);
}

const markDemoChanged = (ctx) => {
  const reset = ctx.app.querySelector('[data-reset]');
  if (reset) reset.hidden = false;
};

async function loadView(ctx) {
  const main = ctx.app.querySelector('.admin-main');
  main.setAttribute('aria-busy', 'true');
  try {
    const data = await loadAdminMenu();
    if (!ctx.alive) return;
    main.removeAttribute('aria-busy');
    if (ctx.view === 'loja') storeView(ctx, main, data);
    else itemsView(ctx, main, data);
  } catch (err) {
    if (!ctx.alive) return;
    main.removeAttribute('aria-busy');
    main.innerHTML = `
      <div class="load-error" role="alert">
        <p>${esc(err.message || LOAD_ERROR)}</p>
        <button class="btn btn--dark" type="button" data-retry>Tentar de novo</button>
      </div>`;
    main.querySelector('[data-retry]').addEventListener('click', () => loadView(ctx));
  }
}

// ---------- Pratos ----------

function itemRow(item) {
  const image = menuImage(item.image);
  const thumb = image ? `<img src="${esc(image.src)}" alt="" width="56" height="56" loading="lazy" />` : '';
  return `
    <li class="admin-item ${item.active ? '' : 'admin-item--hidden'}" data-id="${esc(item.id)}">
      <div class="admin-item__photo">${thumb}</div>
      <div class="admin-item__info">
        <p class="admin-item__name">${esc(item.name)}</p>
        <p class="admin-item__meta">${formatCents(item.price_cents)}${item.active ? '' : ' · <span class="tag">Fora do cardápio</span>'}</p>
      </div>
      <label class="switch">
        <input type="checkbox" role="switch" data-available ${item.available ? 'checked' : ''} aria-label="${esc(item.name)} tem hoje" />
        <span class="switch__track" aria-hidden="true"></span>
        <span class="switch__label" aria-hidden="true">Tem hoje</span>
      </label>
      <button class="admin-edit" type="button" data-edit aria-label="Editar ${esc(item.name)}">Editar</button>
    </li>`;
}

function itemsView(ctx, main, data) {
  const { categories } = data;
  let items = data.items;

  const paint = () => {
    main.innerHTML = `
      <div class="admin-head">
        <h1>Pratos</h1>
        <button class="btn btn--dark" type="button" data-new>Novo prato</button>
      </div>
      <p class="admin-hint">Desligue <strong>Tem hoje</strong> quando um prato acabar. Ele continua no cardápio, marcado como esgotado.</p>
      ${categories
        .map((c) => {
          const list = items.filter((i) => i.category_id === c.id);
          return `
            <section class="admin-section" aria-labelledby="ac-${esc(c.id)}">
              <h2 id="ac-${esc(c.id)}">${esc(c.name)}</h2>
              ${list.length ? `<ul class="admin-items">${list.map(itemRow).join('')}</ul>` : '<p class="muted">Nenhum prato nesta categoria.</p>'}
            </section>`;
        })
        .join('')}`;
  };
  paint();

  const replace = (saved) => {
    const exists = items.some((i) => i.id === saved.id);
    items = exists ? items.map((i) => (i.id === saved.id ? saved : i)) : [...items, saved];
    items.sort((a, b) => a.position - b.position);
  };

  const editor = itemEditor(ctx, categories, (saved, isNew) => {
    replace(saved);
    paint();
    markDemoChanged(ctx);
    toast(isNew ? `${saved.name} entrou no cardápio.` : 'Prato salvo.');
    main.querySelector(`[data-id="${CSS.escape(saved.id)}"] [data-edit]`)?.focus();
  });
  ctx.cleanups.push(editor.destroy);

  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) return editor.open(null);
    const row = e.target.closest('[data-edit]')?.closest('[data-id]');
    if (row) editor.open(items.find((i) => i.id === row.dataset.id));
  });

  // "Tem hoje": muda na hora e salva. Se der erro, volta como estava.
  const pending = new Set();
  main.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-available]');
    if (!input) return;
    const id = input.closest('[data-id]').dataset.id;
    if (pending.has(id)) return;
    pending.add(id);
    input.disabled = true;
    const available = input.checked;
    try {
      const saved = await saveItem(id, { available });
      replace(saved);
      markDemoChanged(ctx);
      toast(available ? `${saved.name} voltou ao cardápio.` : `${saved.name} marcado como esgotado.`);
    } catch (err) {
      input.checked = !available;
      toast(err.message, 5000);
    } finally {
      pending.delete(id);
      input.disabled = false;
    }
  });
}

// Formulário de prato num painel que sobe de baixo (mesmo componente visual da sacola).
function itemEditor(ctx, categories, onSaved) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet admin-sheet';
  dialog.setAttribute('aria-labelledby', 'edit-title');
  document.body.append(dialog);

  let current = null; // prato aberto (null = novo)
  let photo = null; // { blob, url } da foto escolhida e ainda não enviada
  let busy = false;

  const draftKey = () => current?.id ?? 'novo';

  // Fechar no X, no Esc ou fora do painel guarda o rascunho; "Cancelar" descarta.
  const close = ({ keepDraft = true } = {}) => {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    if (keepDraft) saveDraft();
    else {
      drafts.delete(draftKey());
      if (photo) URL.revokeObjectURL(photo.url);
      photo = null;
    }
    dialog.classList.add('is-closing');
    const done = () => {
      dialog.classList.remove('is-closing');
      dialog.close();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    dialog.addEventListener('transitionend', done, { once: true });
    setTimeout(() => dialog.open && dialog.classList.contains('is-closing') && done(), 300);
  };

  // .elements: com form.name o navegador devolveria o nome do formulário, não o campo.
  const form = () => dialog.querySelector('form')?.elements;

  const readForm = () => {
    const f = form();
    return {
      name: f.name.value,
      description: f.description.value,
      price: f.price.value,
      category_id: f.category_id.value,
      active: f.active.checked,
      available: f.available.checked,
    };
  };

  const saveDraft = () => {
    if (!form() || busy) return;
    drafts.set(draftKey(), { ...readForm(), photo });
  };

  const showErrors = (errors) => {
    const f = form();
    for (const key of ['name', 'description', 'price', 'category_id', 'photo']) {
      const box = dialog.querySelector(`#ee-${key}`);
      box.textContent = errors[key] ?? '';
      const field = key === 'photo' ? f.photo : f[key];
      field.toggleAttribute('aria-invalid', Boolean(errors[key]));
      if (errors[key]) field.setAttribute('aria-describedby', `ee-${key}`);
      else field.removeAttribute('aria-describedby');
    }
    const first = ['photo', 'name', 'description', 'price', 'category_id'].find((k) => errors[k]);
    if (first) (first === 'photo' ? f.photo : f[first]).focus();
  };

  function fill() {
    const draft = drafts.get(draftKey());
    const v = draft ?? {
      name: current?.name ?? '',
      description: current?.description ?? '',
      price: current ? money(current.price_cents) : '',
      category_id: current?.category_id ?? categories[0]?.id ?? '',
      active: current?.active ?? true,
      available: current?.available ?? true,
    };
    photo = draft?.photo ?? null;
    const image = photo ? { src: photo.url } : menuImage(current?.image);

    dialog.innerHTML = `
      <div class="sheet__grip" aria-hidden="true"></div>
      <header class="sheet__head">
        <h2 id="edit-title">${current ? 'Editar prato' : 'Novo prato'}</h2>
        <button class="icon-btn" type="button" data-close aria-label="Fechar">${ICON.close}</button>
      </header>
      <form class="sheet__body admin-form" novalidate>
        <div class="photo-field">
          <div class="photo-field__preview">${image ? `<img src="${esc(image.src)}" alt="Foto atual do prato" />` : '<span>Sem foto</span>'}</div>
          <div class="photo-field__side">
            <label class="btn btn--ghost-dark btn--small" for="e-photo">${image ? 'Trocar foto' : 'Escolher foto'}</label>
            <input class="sr-only" id="e-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
            <p class="muted">JPG, PNG ou WebP. A foto é cortada em quadrado.</p>
            <p class="field__error" id="ee-photo"></p>
          </div>
        </div>
        <div class="field">
          <label for="e-name">Nome</label>
          <input id="e-name" name="name" maxlength="${ITEM_LIMITS.name}" value="${esc(v.name)}" autocomplete="off" />
          <p class="field__error" id="ee-name"></p>
        </div>
        <div class="field">
          <label for="e-desc">Descrição <span class="optional">(opcional)</span></label>
          <textarea id="e-desc" name="description" rows="3" maxlength="${ITEM_LIMITS.description}">${esc(v.description)}</textarea>
          <p class="field__count" aria-live="polite"><span data-count>${v.description.length}</span> de ${ITEM_LIMITS.description}</p>
          <p class="field__error" id="ee-description"></p>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="e-price">Preço (R$)</label>
            <input id="e-price" name="price" inputmode="decimal" placeholder="29,90" value="${esc(v.price)}" autocomplete="off" />
            <p class="field__error" id="ee-price"></p>
          </div>
          <div class="field">
            <label for="e-cat">Categoria</label>
            <select id="e-cat" name="category_id">
              ${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === v.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
            <p class="field__error" id="ee-category_id"></p>
          </div>
        </div>
        <label class="check"><input type="checkbox" name="available" ${v.available ? 'checked' : ''} /> Tem hoje (desmarcado = esgotado)</label>
        <label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''} /> Mostrar no cardápio</label>
        <p class="form-error" role="alert"></p>
      </form>
      <footer class="sheet__foot">
        <button class="btn btn--dark" type="button" data-save>${current ? 'Salvar prato' : 'Criar prato'}</button>
        <button class="btn btn--ghost-dark" type="button" data-cancel>Cancelar</button>
      </footer>`;
  }

  dialog.addEventListener('input', (e) => {
    if (e.target.name === 'description') dialog.querySelector('[data-count]').textContent = e.target.value.length;
  });

  dialog.addEventListener('change', async (e) => {
    if (e.target.name !== 'photo') return;
    const file = e.target.files[0];
    const problem = checkPhoto(file);
    if (problem) {
      showErrors({ photo: problem });
      return;
    }
    try {
      const blob = await squarePhoto(file);
      if (photo) URL.revokeObjectURL(photo.url);
      photo = { blob, url: URL.createObjectURL(blob) };
      dialog.querySelector('.photo-field__preview').innerHTML = `<img src="${esc(photo.url)}" alt="Nova foto do prato" />`;
      dialog.querySelector('label[for="e-photo"]').textContent = 'Trocar foto';
      showErrors({});
    } catch (err) {
      showErrors({ photo: err.message });
    }
  });

  dialog.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cancel]')) return busy || close({ keepDraft: false });
    if (e.target === dialog || e.target.closest('[data-close]')) return busy || close();
    if (!e.target.closest('[data-save]') || busy) return;

    const { errors, value } = validateItem(readForm(), categories);
    showErrors(errors);
    if (Object.keys(errors).length) return;

    const button = e.target.closest('[data-save]');
    const formError = dialog.querySelector('.form-error');
    busy = true;
    setBusy(button, true, 'Salvando…');
    formError.textContent = '';
    dialog.querySelectorAll('input, select, textarea').forEach((el) => (el.disabled = true));
    const isNew = !current;
    let saved = null;
    try {
      saved = await saveItem(current?.id ?? null, value);
      if (photo) saved = await uploadItemPhoto(saved.id, photo.blob);
      drafts.delete(isNew ? 'novo' : saved.id);
      if (photo) URL.revokeObjectURL(photo.url);
      photo = null;
      busy = false;
      dialog.close();
      onSaved(saved, isNew);
    } catch (err) {
      busy = false;
      if (!ctx.alive) return;
      setBusy(button, false);
      dialog.querySelectorAll('input, select, textarea').forEach((el) => (el.disabled = false));
      // O prato pode ter sido salvo e só a foto ter falhado: o painel já mostra o prato.
      if (saved) {
        current = saved;
        onSaved(saved, isNew);
        dialog.showModal();
        formError.textContent = `O prato foi salvo, mas a foto não foi enviada. ${err.message}`;
      } else {
        formError.textContent = err.message;
      }
    }
  });

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (!busy) close();
  });

  return {
    open(item) {
      current = item;
      fill();
      dialog.showModal();
      dialog.querySelector('#e-name').focus();
    },
    destroy() {
      if (photo) URL.revokeObjectURL(photo.url);
      dialog.remove();
    },
  };
}

// ---------- Loja ----------

function storeView(ctx, main, { store }) {
  const hours = store.hours ?? {};
  main.innerHTML = `
    <div class="admin-head"><h1>Loja</h1></div>
    <form class="admin-form store-form" novalidate>
      <div class="field">
        <label for="s-whats">WhatsApp que recebe os pedidos</label>
        <input id="s-whats" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 91234-5678" value="${esc(formatWhatsapp(store.whatsapp))}" />
        <p class="muted">Com DDD. Vazio = o pedido aparece na tela em vez de abrir o WhatsApp.</p>
        <p class="field__error" id="se-whatsapp"></p>
      </div>
      <div class="field">
        <label for="s-fee">Taxa de entrega (R$)</label>
        <input id="s-fee" name="fee" inputmode="decimal" placeholder="0,00" value="${money(store.delivery_fee_cents ?? 0)}" />
        <p class="field__error" id="se-fee"></p>
      </div>
      <div class="field">
        <label for="s-address">Endereço</label>
        <textarea id="s-address" name="address" rows="2" maxlength="160">${esc(store.address)}</textarea>
        <p class="field__error" id="se-address"></p>
      </div>
      <fieldset class="field">
        <legend>Horário de funcionamento</legend>
        <div class="week">
          ${WEEK.map((d) => {
            const h = hours[d];
            return `
              <div class="day" data-day="${d}">
                <label class="check day__name"><input type="checkbox" name="open-${d}" ${h ? 'checked' : ''} /> ${DAYS[d]}</label>
                <label class="sr-only" for="from-${d}">${DAYS[d]}: abre às</label>
                <input id="from-${d}" name="from-${d}" type="time" value="${esc(h?.[0] ?? '18:00')}" ${h ? '' : 'disabled'} />
                <span aria-hidden="true">às</span>
                <label class="sr-only" for="to-${d}">${DAYS[d]}: fecha às</label>
                <input id="to-${d}" name="to-${d}" type="time" value="${esc(h?.[1] ?? '23:00')}" ${h ? '' : 'disabled'} />
                <p class="field__error" id="se-hours-${d}"></p>
              </div>`;
          }).join('')}
        </div>
      </fieldset>
      <p class="form-error" role="alert"></p>
      <button class="btn btn--dark" type="submit">Salvar loja</button>
    </form>`;

  const form = main.querySelector('form');
  const fields = form.elements;
  const button = form.querySelector('[type="submit"]');

  form.addEventListener('change', (e) => {
    const m = e.target.name?.match(/^open-(\d)$/);
    if (!m) return;
    fields[`from-${m[1]}`].disabled = !e.target.checked;
    fields[`to-${m[1]}`].disabled = !e.target.checked;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.disabled) return;
    const raw = {
      whatsapp: fields.whatsapp.value,
      fee: fields.fee.value,
      address: fields.address.value,
      hours: Object.fromEntries(
        [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { open: fields[`open-${d}`].checked, from: fields[`from-${d}`].value, to: fields[`to-${d}`].value }]),
      ),
    };
    const { errors, value } = validateStore(raw);
    const keys = ['whatsapp', 'fee', 'address', ...[1, 2, 3, 4, 5, 6, 0].map((d) => `hours-${d}`)];
    for (const key of keys) {
      main.querySelector(`#se-${key}`).textContent = errors[key] ?? '';
      const field = key.startsWith('hours-') ? fields[`from-${key.slice(6)}`] : fields[key];
      field.toggleAttribute('aria-invalid', Boolean(errors[key]));
      if (errors[key]) field.setAttribute('aria-describedby', `se-${key}`);
      else field.removeAttribute('aria-describedby');
    }
    const first = keys.find((k) => errors[k]);
    if (first) {
      (first.startsWith('hours-') ? fields[`from-${first.slice(6)}`] : fields[first]).focus();
      return;
    }

    const formError = form.querySelector('.form-error');
    setBusy(button, true, 'Salvando…');
    formError.textContent = '';
    try {
      await saveStore(value);
      if (!ctx.alive) return;
      markDemoChanged(ctx);
      toast('Dados da loja salvos.');
    } catch (err) {
      if (ctx.alive) formError.textContent = err.message;
    } finally {
      if (ctx.alive) setBusy(button, false);
    }
  });
}

// Botão em espera: desativado, com indicador e texto de andamento.
function setBusy(button, busy, text) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(text)}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.label ?? button.textContent;
  }
}
