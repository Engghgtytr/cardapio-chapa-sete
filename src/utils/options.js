// Opções de um prato: tamanho, sabores (meio a meio), ponto da carne, adicionais, borda…
// A MESMA regra roda no navegador (sacola e demonstração) e no banco (função fazer_pedido,
// 005_opcoes.sql): o preço nunca vem do que a tela mandou.
//
// item.options = [{ id, name, min, max, pricing, choices: [{ id, name, price_cents }] }]
//   min/max  = quantas escolhas (min 1 = obrigatório; max 1 = escolhe uma só)
//   pricing  = 'soma'  → soma o preço de cada escolha (adicionais, borda, tamanho)
//              'maior' → vale a escolha mais cara (meio a meio cobra o sabor mais caro)
// selection = { [idDoGrupo]: [idDaEscolha, …] }

export const OPTION_ERROR = 'Escolha as opções do prato antes de adicionar.';

/** Confere a escolha e devolve o preço de UMA unidade e o resumo legível. Lança erro se inválida. */
export function priceWithOptions(item, selection = {}) {
  const groups = item.options ?? [];
  const known = new Set(groups.map((g) => g.id));
  if (Object.keys(selection).some((k) => !known.has(k))) throw new Error(OPTION_ERROR);

  let extra = 0;
  const summary = [];
  for (const g of groups) {
    const picked = selection[g.id] ?? [];
    if (!Array.isArray(picked) || new Set(picked).size !== picked.length) throw new Error(OPTION_ERROR);
    if (picked.length < g.min || picked.length > g.max) throw new Error(OPTION_ERROR);
    const choices = picked.map((id) => g.choices.find((c) => c.id === id));
    if (choices.some((c) => !c)) throw new Error(OPTION_ERROR);
    if (!choices.length) continue;
    const prices = choices.map((c) => c.price_cents);
    extra += g.pricing === 'maior' ? Math.max(...prices) : prices.reduce((s, p) => s + p, 0);
    summary.push({ group: g.name, choices: choices.map((c) => c.name) });
  }
  return { unitCents: item.price_cents + extra, summary };
}

/** Texto curto das opções: "Ponto: Ao ponto · Adicionais: Bacon, Ovo". */
export const summaryText = (summary = []) => summary.map((s) => `${s.group}: ${s.choices.join(', ')}`).join(' · ');

/** Chave estável de uma escolha (o mesmo prato com opções diferentes vira outra linha na sacola). */
export const selectionKey = (selection = {}) =>
  Object.keys(selection)
    .sort()
    .filter((k) => selection[k]?.length)
    .map((k) => `${k}=${[...selection[k]].sort().join('+')}`)
    .join(';');
