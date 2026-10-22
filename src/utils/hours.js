// "Aberto agora / Fechado", calculado pelo horário do aparelho de quem visita.
const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const label = (hhmm) => {
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

export function openStatus(hours, now = new Date()) {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = hours[day];

  if (today && minutes >= toMinutes(today[0]) && minutes < toMinutes(today[1])) {
    return { open: true, text: `Aberto agora · até ${label(today[1])}` };
  }
  if (today && minutes < toMinutes(today[0])) {
    return { open: false, text: `Fechado · abre hoje às ${label(today[0])}` };
  }
  // Procura o próximo dia com horário (no máximo uma semana à frente).
  for (let i = 1; i <= 7; i++) {
    const next = (day + i) % 7;
    if (hours[next]) {
      const when = i === 1 ? 'amanhã' : DAY_NAMES[next];
      return { open: false, text: `Fechado · abre ${when} às ${label(hours[next][0])}` };
    }
  }
  return { open: false, text: 'Fechado' };
}

// Linhas para a tabela de horários: dias seguidos com o mesmo horário viram "Terça a domingo".
export function hoursTable(hours) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows = [];
  for (const day of order) {
    const value = hours[day] ? `${label(hours[day][0])} às ${label(hours[day][1])}` : 'Fechado';
    const last = rows.at(-1);
    if (last && last.value === value) last.to = day;
    else rows.push({ from: day, to: day, value });
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  return rows.map(({ from, to, value }) => ({
    days: from === to ? cap(DAY_NAMES[from]) : `${cap(DAY_NAMES[from])} a ${DAY_NAMES[to]}`,
    value,
  }));
}
