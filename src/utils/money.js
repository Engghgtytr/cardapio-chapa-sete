// Valores são guardados em CENTAVOS (inteiros) para evitar erros de ponto flutuante
// como 0.1 + 0.2 = 0.30000000000000004. Só dividimos por 100 na hora de exibir.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatCents = (cents) => brl.format(cents / 100);
