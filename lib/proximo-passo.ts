// Resumo semanal com próximo passo (funções puras). As frases saem só dos números do relatório; as sugestões
// nunca propõem comer menos nem perder mais peso; a medição usa dados registrados, sem estimar.
import type { RelatorioSemanal } from "@/lib/relatorio";
import { ROTULOS_REFEICAO, type Refeicao } from "@/lib/validacao/comida";

export const TIPOS_PASSO = ["registrar_dias", "refeicao_dias", "pesar_dias", "treinos", "proteina_dias", "agua_dias", "livre"] as const;
export type TipoPasso = (typeof TIPOS_PASSO)[number];
export const TEXTO_LIVRE_MAX = 120;

export type Passo = { tipo: TipoPasso; alvo: number | null; refeicao: Refeicao | null; texto: string | null };

/** Dados da semana usados para medir o passo (contagens a partir dos registros). */
export type DadosDaSemana = {
  diasComRegistro: number;
  diasPorRefeicao: Partial<Record<Refeicao, number>>;
  pesagens: number;
  treinosFeitos: number;
  /** null = sem meta de proteína (não dá para medir). */
  diasProteinaNaMeta: number | null;
  /** null = sem meta de água. */
  diasAguaNaMeta: number | null;
};

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const plural = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;

/** "O que dá para dizer": leituras curtas, só com o que os números permitem. */
export function leiturasDaSemana(r: RelatorioSemanal): string[] {
  const l: string[] = [];
  if (r.calorias.media !== null) {
    const base = `Nos ${plural(r.calorias.dias, "dia registrado", "dias registrados")}, a média foi de ${n(r.calorias.media)} kcal`;
    if (r.calorias.meta !== null && r.calorias.difMedia !== null) {
      const d = r.calorias.difMedia;
      l.push(Math.abs(d) <= 100 ? `${base}, perto da sua referência de ${n(r.calorias.meta)} kcal.` : `${base}, ${n(Math.abs(d))} kcal ${d > 0 ? "acima" : "abaixo"} da referência de ${n(r.calorias.meta)} kcal.`);
    } else l.push(`${base}.`);
  }
  if (r.proteina.media !== null && r.proteina.meta !== null && r.proteina.difMedia !== null) {
    l.push(r.proteina.difMedia >= -5 ? `A proteína ficou na meta em média (${n(r.proteina.media)} g).` : `A proteína ficou em média ${n(Math.abs(r.proteina.difMedia))} g abaixo da meta de ${n(r.proteina.meta)} g.`);
  }
  if (r.treino.planejados !== null) {
    l.push(`${plural(r.treino.feitos, "treino feito", "treinos feitos")} de ${r.treino.planejados} ${r.treino.planejados === 1 ? "planejado" : "planejados"} na semana.`);
  } else if (r.treino.feitos > 0) l.push(`${plural(r.treino.feitos, "treino feito", "treinos feitos")} na semana.`);
  if (r.peso.variacaoKg !== null) {
    const v = r.peso.variacaoKg;
    l.push(Math.abs(v) < 0.05 ? "A tendência do peso ficou estável." : `A tendência do peso ${v < 0 ? "caiu" : "subiu"} ${n(Math.abs(v))} kg (estimativa).`);
  }
  if (r.ritmoRealKgSemana !== null && r.ritmoPrevistoKgSemana !== null && Math.abs(r.ritmoRealKgSemana - r.ritmoPrevistoKgSemana) >= 0.5) {
    l.push("O peso andou diferente do que o consumo registrado indicava; isso costuma acontecer quando algum dia ficou sem registro completo ou o gasto estimado ainda está se ajustando.");
  }
  return l;
}

/** "O que ainda não dá para concluir": lacunas que impedem uma leitura mais firme. */
export function lacunasDaSemana(r: RelatorioSemanal): string[] {
  const l: string[] = [];
  if (r.calorias.media === null) l.push("Sem dias com registro completo, não dá para falar da alimentação desta semana.");
  else if (r.calorias.dias < 4) l.push(`Com ${plural(r.calorias.dias, "dia", "dias")} de registro, a média pode não representar a semana.`);
  if (r.peso.pesagens < 2) l.push("Com menos de duas pesagens, a tendência do peso da semana não aparece.");
  if (r.calorias.meta === null) l.push("Sem uma meta confirmada, não dá para comparar o consumo com uma referência.");
  if (!r.gasto) l.push("Sem o perfil completo, o gasto estimado não é calculado.");
  if (r.parcial) l.push("A semana ainda está em andamento.");
  return l;
}

/** Texto de um passo, para a tela. */
export function textoDoPasso(p: Passo): string {
  const a = p.alvo ?? 0;
  switch (p.tipo) {
    case "registrar_dias": return `Registrar a alimentação em ${plural(a, "dia", "dias")}`;
    case "refeicao_dias": return `Registrar o ${p.refeicao ? ROTULOS_REFEICAO[p.refeicao].toLowerCase() : "refeição"} em ${plural(a, "dia", "dias")}`;
    case "pesar_dias": return `Pesar em ${plural(a, "dia", "dias")}`;
    case "treinos": return `Fazer ${plural(a, "treino", "treinos")}`;
    case "proteina_dias": return `Chegar na meta de proteína em ${plural(a, "dia", "dias")}`;
    case "agua_dias": return `Chegar na meta de água em ${plural(a, "dia", "dias")}`;
    case "livre": return p.texto ?? "";
  }
}

const limitar = (v: number) => Math.max(1, Math.min(7, Math.round(v)));

/**
 * Sugestões de próximo passo (até 4), a partir das lacunas da semana. Alvos alcançáveis: um pouco acima do que a
 * pessoa já fez, nunca mais que 7. Nada sobre comer menos ou perder mais.
 */
export function sugerirPassos(r: RelatorioSemanal, d: DadosDaSemana, metas: { proteina: boolean; agua: boolean }): Passo[] {
  const s: Passo[] = [];
  const add = (p: Omit<Passo, "texto" | "refeicao"> & { refeicao?: Refeicao | null }) => {
    if (!s.some((x) => x.tipo === p.tipo)) s.push({ tipo: p.tipo, alvo: p.alvo, refeicao: p.refeicao ?? null, texto: null });
  };
  if (d.diasComRegistro < 5) add({ tipo: "registrar_dias", alvo: limitar(Math.max(4, d.diasComRegistro + 2)) });
  if (d.pesagens < 3) add({ tipo: "pesar_dias", alvo: 3 });
  if (metas.proteina && d.diasProteinaNaMeta !== null && d.diasProteinaNaMeta < 5) add({ tipo: "proteina_dias", alvo: limitar(Math.max(3, d.diasProteinaNaMeta + 2)) });
  if (r.treino.planejados !== null && d.treinosFeitos < r.treino.planejados) add({ tipo: "treinos", alvo: limitar(Math.min(r.treino.planejados, d.treinosFeitos + 1)) });
  if (metas.agua && d.diasAguaNaMeta !== null && d.diasAguaNaMeta < 5) add({ tipo: "agua_dias", alvo: limitar(Math.max(3, d.diasAguaNaMeta + 2)) });
  // refeição menos registrada (entre almoço e jantar), quando a pessoa já registra alguns dias
  if (s.length < 4 && d.diasComRegistro >= 3) {
    const ref = (["jantar", "almoco", "cafe"] as const).find((x) => (d.diasPorRefeicao[x] ?? 0) < d.diasComRegistro);
    if (ref) add({ tipo: "refeicao_dias", alvo: limitar((d.diasPorRefeicao[ref] ?? 0) + 2), refeicao: ref });
  }
  if (s.length === 0) add({ tipo: "registrar_dias", alvo: limitar(Math.max(5, d.diasComRegistro)) });
  return s.slice(0, 4);
}

export type Medicao = { feito: number; alvo: number; concluido: boolean };

/** Quanto do passo foi cumprido na semana. Passo livre ou sem meta para medir: null (só aparece). */
export function medirPasso(p: Passo, d: DadosDaSemana): Medicao | null {
  if (p.tipo === "livre" || p.alvo === null) return null;
  let feito: number | null;
  switch (p.tipo) {
    case "registrar_dias": feito = d.diasComRegistro; break;
    case "refeicao_dias": feito = p.refeicao ? (d.diasPorRefeicao[p.refeicao] ?? 0) : null; break;
    case "pesar_dias": feito = d.pesagens; break;
    case "treinos": feito = d.treinosFeitos; break;
    case "proteina_dias": feito = d.diasProteinaNaMeta; break;
    case "agua_dias": feito = d.diasAguaNaMeta; break;
  }
  if (feito === null) return null;
  return { feito: Math.min(feito, 7), alvo: p.alvo, concluido: feito >= p.alvo };
}

/** Frase sobre o resultado, sem cobrança. */
export function fraseDoResultado(m: Medicao, semanaTerminou: boolean): string {
  if (m.concluido) return `${m.feito} de ${m.alvo}. Passo cumprido.`;
  if (!semanaTerminou) return `${m.feito} de ${m.alvo} até agora.`;
  if (m.feito === 0) return `0 de ${m.alvo}. Tudo bem: vale escolher um passo menor para a próxima semana.`;
  return `${m.feito} de ${m.alvo}. Bom avanço.`;
}
