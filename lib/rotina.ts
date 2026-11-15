// "Minha rotina": alimentos que a pessoa registra sempre naquela refeição, oferecidos no Hoje para registrar em
// um toque. Funções puras; os nutrientes NUNCA vêm daqui: são recalculados do banco na hora de registrar.
import type { Refeicao } from "@/lib/validacao/comida";

/** Mínimo de dias diferentes (nos últimos 30) para um alimento virar habitual naquela refeição. */
export const ROTINA_MIN_DIAS = 3;
export const ROTINA_JANELA_DIAS = 30;
export const ROTINA_MAX_ITENS = 4;

/** Refeição do horário local (São Paulo): café 5–10h, almoço 10–15h, lanche 15–18h, jantar 18–22h, ceia no resto. */
export function refeicaoDoHorario(hora: number): Refeicao {
  if (hora >= 5 && hora < 10) return "cafe";
  if (hora >= 10 && hora < 15) return "almoco";
  if (hora >= 15 && hora < 18) return "lanche";
  if (hora >= 18 && hora < 22) return "jantar";
  return "ceia";
}

/** Hora atual em São Paulo (0–23). */
export function horaSaoPaulo(instante: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(instante);
  return Number(h) % 24;
}

export type TipoAlimentoRotina = "base" | "usuario";

export type RegistroHistorico = {
  data: string;
  refeicao: Refeicao;
  tipo: TipoAlimentoRotina;
  alimentoId: string;
  nome: string;
  gramas: number;
};

export type ItemRotina = {
  tipo: TipoAlimentoRotina;
  alimentoId: string;
  nome: string;
  /** Porção mais comum: mediana das gramas registradas, arredondada a 5 g. */
  gramas: number;
  dias: number;
};

const chave = (tipo: string, id: string) => `${tipo}:${id}`;

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Itens habituais de uma refeição: alimentos registrados nela em pelo menos ROTINA_MIN_DIAS dias diferentes.
 * Ordem: mais dias, depois o nome. Tira os ocultados e os já registrados hoje nessa refeição.
 */
export function itensHabituais(
  historico: ReadonlyArray<RegistroHistorico>,
  refeicao: Refeicao,
  opcoes: { hoje: string; ocultos?: ReadonlySet<string>; limite?: number },
): ItemRotina[] {
  const ocultos = opcoes.ocultos ?? new Set<string>();
  const jaHoje = new Set(historico.filter((r) => r.data === opcoes.hoje && r.refeicao === refeicao).map((r) => chave(r.tipo, r.alimentoId)));
  const grupos = new Map<string, { item: RegistroHistorico; dias: Set<string>; gramas: number[] }>();
  for (const r of historico) {
    if (r.refeicao !== refeicao || r.data >= opcoes.hoje) continue; // hoje não conta para formar o hábito
    const k = chave(r.tipo, r.alimentoId);
    const g = grupos.get(k) ?? { item: r, dias: new Set<string>(), gramas: [] };
    g.dias.add(r.data);
    g.gramas.push(r.gramas);
    if (r.data > g.item.data) g.item = r; // nome mais recente
    grupos.set(k, g);
  }
  return [...grupos.entries()]
    .filter(([k, g]) => g.dias.size >= ROTINA_MIN_DIAS && !ocultos.has(`${refeicao}|${k}`) && !jaHoje.has(k))
    .map(([, g]) => ({
      tipo: g.item.tipo,
      alimentoId: g.item.alimentoId,
      nome: g.item.nome,
      gramas: Math.max(5, Math.round(mediana(g.gramas) / 5) * 5),
      dias: g.dias.size,
    }))
    .sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, opcoes.limite ?? ROTINA_MAX_ITENS);
}

/** Chave de um item oculto (refeição + alimento). */
export const chaveOculto = (refeicao: Refeicao, tipo: TipoAlimentoRotina, alimentoId: string) => `${refeicao}|${chave(tipo, alimentoId)}`;

/** Próxima porção ao tocar − ou +: passos de 10% da porção habitual, arredondados a 5 g, entre 5 g e 5000 g. */
export function ajustarPorcao(atual: number, habitual: number, direcao: 1 | -1): number {
  const passo = Math.max(5, Math.round((habitual * 0.1) / 5) * 5);
  return Math.min(5000, Math.max(5, atual + direcao * passo));
}
