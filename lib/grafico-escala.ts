// Escala do eixo vertical com números redondos (ex.: 88, 90, 92 em vez de 88,37 / 90,12 / 91,87).

const PASSOS_BASE = [1, 2, 2.5, 5, 10];

/** Passo "bonito" (1, 2, 2,5 ou 5 vezes uma potência de 10) que divide o intervalo em cerca de `alvo` partes. */
export function passoBonito(intervalo: number, alvo = 4): number {
  if (!(intervalo > 0) || !Number.isFinite(intervalo)) return 1;
  const bruto = intervalo / alvo;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const base = PASSOS_BASE.find((b) => b * potencia >= bruto) ?? 10;
  return base * potencia;
}

export type Escala = { min: number; max: number; marcas: number[] };

/**
 * Escala que contém [min, max] com marcas redondas. Com `zero`, começa em 0 (barras sempre partem de zero).
 * Valores iguais ganham uma folga para a linha não ficar colada na borda.
 */
export function escalaBonita(minDado: number, maxDado: number, opcoes: { zero?: boolean; alvo?: number } = {}): Escala {
  let lo = opcoes.zero ? Math.min(0, minDado) : minDado;
  let hi = maxDado;
  if (hi === lo) {
    const folga = Math.abs(hi) > 0 ? Math.abs(hi) * 0.05 : 1;
    lo = opcoes.zero ? lo : lo - folga;
    hi = hi + folga;
  }
  const passo = passoBonito(hi - lo, opcoes.alvo ?? 4);
  const min = opcoes.zero && lo >= 0 ? 0 : Math.floor(lo / passo) * passo;
  const max = Math.ceil(hi / passo) * passo;
  const marcas: number[] = [];
  for (let v = min; v <= max + passo / 1000; v += passo) marcas.push(Math.round(v * 1e6) / 1e6);
  return { min, max, marcas };
}
