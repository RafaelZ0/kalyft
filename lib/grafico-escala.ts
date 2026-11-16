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

/**
 * Escala de um gráfico de linhas com uma linha de referência opcional (meta, gasto). A referência só entra no
 * desenho se estiver PERTO dos dados (até 60% da faixa dos dados além da borda); longe, ela esmagaria a
 * variação (ex.: pesos 150–154 com meta 95) e passa a ser mostrada só como texto.
 */
export function escalaComReferencia(
  valores: ReadonlyArray<number>,
  referencia: number | null | undefined,
  opcoes: { zero?: boolean } = {},
): { escala: Escala; referenciaNoDesenho: boolean } {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = Math.max(max - min, Math.abs((min + max) / 2) * 0.05, 1e-9);
  const perto = referencia != null && Number.isFinite(referencia) && referencia >= min - faixa * 0.6 && referencia <= max + faixa * 0.6;
  const lo = perto ? Math.min(min, referencia!) : min;
  const hi = perto ? Math.max(max, referencia!) : max;
  // Folga de ~8% para a linha não encostar na borda (exceto no zero das barras).
  const folga = (hi - lo || Math.abs(hi) * 0.05 || 1) * 0.08;
  // Dados que nunca ficam abaixo de zero não ganham folga negativa (evita um "−1" sem sentido no eixo).
  const baixo = opcoes.zero ? Math.min(0, lo) : lo >= 0 && lo - folga < 0 ? 0 : lo - folga;
  const escala = escalaBonita(baixo, hi + folga, { zero: opcoes.zero, alvo: 3 });
  return { escala, referenciaNoDesenho: perto };
}

/**
 * Até `alvo` posições do eixo X igualmente espaçadas entre o primeiro e o último valor, escolhidas entre os
 * valores existentes (cada marca cai num ponto real). Sempre inclui o primeiro e o último.
 */
export function marcasEixoX(xs: ReadonlyArray<number>, alvo = 4): number[] {
  const unicos = [...new Set(xs)].sort((a, b) => a - b);
  if (unicos.length <= alvo) return unicos;
  const primeiro = unicos[0];
  const ultimo = unicos[unicos.length - 1];
  const marcas = new Set<number>([primeiro, ultimo]);
  for (let i = 1; i < alvo - 1; i++) {
    const alvoX = primeiro + ((ultimo - primeiro) * i) / (alvo - 1);
    const maisPerto = unicos.reduce((a, b) => (Math.abs(b - alvoX) < Math.abs(a - alvoX) ? b : a));
    marcas.add(maisPerto);
  }
  return [...marcas].sort((a, b) => a - b);
}

/** Índice do valor de `xs` (ordenado) mais perto de `x`. */
export function indiceMaisPerto(xs: ReadonlyArray<number>, x: number): number {
  let melhor = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[melhor] - x)) melhor = i;
  return melhor;
}

/** Rótulo de um ponto no eixo X: dias a partir de uma data (dd/mm) ou semanas a partir de hoje. */
export type EixoX = { tipo: "dias"; inicio: string } | { tipo: "semanas" };

export function rotuloEixoX(eixo: EixoX, x: number): string {
  if (eixo.tipo === "semanas") return x === 0 ? "hoje" : `sem. ${x}`;
  const [a, m, d] = eixo.inicio.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + Math.round(x)));
  return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
