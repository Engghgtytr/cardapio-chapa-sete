import { describe, expect, it } from 'vitest';
import { hoursTable, openStatus } from '../src/utils/hours.js';
import { DEMO_STORE } from '../src/data/demo-menu.js';

const { hours } = DEMO_STORE;
// 2026-10-20 é uma terça-feira.
const at = (date, time) => new Date(`${date}T${time}:00`);

describe('openStatus', () => {
  it('aberto dentro do horário', () => {
    expect(openStatus(hours, at('2026-10-20', '19:15'))).toEqual({ open: true, text: 'Aberto agora · até 23h30' });
  });

  it('antes de abrir no mesmo dia', () => {
    expect(openStatus(hours, at('2026-10-20', '10:00')).text).toBe('Fechado · abre hoje às 18h');
  });

  it('fecha exatamente no horário de fechamento', () => {
    expect(openStatus(hours, at('2026-10-20', '23:30')).text).toBe('Fechado · abre amanhã às 18h');
  });

  it('domingo à noite pula a segunda fechada', () => {
    expect(openStatus(hours, at('2026-10-25', '23:45')).text).toBe('Fechado · abre terça às 18h');
  });

  it('segunda o dia todo fechado', () => {
    expect(openStatus(hours, at('2026-10-26', '20:00')).text).toBe('Fechado · abre amanhã às 18h');
  });

  it('sem nenhum horário cadastrado', () => {
    expect(openStatus({}, at('2026-10-20', '20:00')).text).toBe('Fechado');
  });
});

describe('hoursTable', () => {
  it('agrupa dias seguidos com o mesmo horário', () => {
    expect(hoursTable(hours)).toEqual([
      { days: 'Segunda', value: 'Fechado' },
      { days: 'Terça a domingo', value: '18h às 23h30' },
    ]);
  });
});
