// Planejamento leve da semana e lista de compras (funções puras). Planejado NÃO é consumido: só vira registro
// quando a pessoa toca em "Comi isso", e aí os nutrientes são recalculados do banco como em qualquer registro.

export const LIMITES_PLANO = { itensPorRefeicao: 4, porcoesMin: 0.5, porcoesMax: 10, gramasMin: 1, gramasMax: 5000, textoAvulsoMax: 80, avulsosPorSemana: 40 } as const;
export const TIPOS_PLANEJADO = ["receita", "salva", "alimento"] as const;
export type TipoPlanejado = (typeof TIPOS_PLANEJADO)[number];

export type Ingrediente = { tipo: "base" | "usuario"; alimentoId: string; nome: string; grupo: string | null; gramas: number };

/** Um item planejado já expandido em ingredientes, para a lista de compras. */
export type PlanejadoExpandido = { ingredientes: Ingrediente[] };

/** Ingredientes de uma receita para N porções: proporção dos ingredientes cadastrados pelo rendimento da receita. */
export function ingredientesDaReceita(itens: ReadonlyArray<Ingrediente>, porcoesDaReceita: number, porcoesPlanejadas: number): Ingrediente[] {
  if (!(porcoesDaReceita > 0)) return [];
  const f = porcoesPlanejadas / porcoesDaReceita;
  return itens.map((i) => ({ ...i, gramas: i.gramas * f }));
}

/** Itens de uma refeição salva multiplicados pelo número de vezes planejado. */
export function ingredientesDaSalva(itens: ReadonlyArray<Ingrediente>, vezes: number): Ingrediente[] {
  return itens.map((i) => ({ ...i, gramas: i.gramas * vezes }));
}

export type ItemDaLista = { chave: string; nome: string; grupo: string | null; gramas: number };

export const chaveIngrediente = (i: Pick<Ingrediente, "tipo" | "alimentoId">) => `${i.tipo}:${i.alimentoId}`;

/** Arredonda para cima a uma quantidade de compra amigável: 5 g até 100 g, 10 g até 1 kg, 50 g acima. */
export function arredondarCompra(g: number): number {
  if (g <= 0) return 0;
  const passo = g <= 100 ? 5 : g <= 1000 ? 10 : 50;
  return Math.ceil(g / passo) * passo;
}

/** Soma os ingredientes de todos os itens planejados por alimento e ordena por grupo e nome. */
export function listaDeCompras(planejados: ReadonlyArray<PlanejadoExpandido>): ItemDaLista[] {
  const soma = new Map<string, ItemDaLista>();
  for (const p of planejados) {
    for (const i of p.ingredientes) {
      if (!(i.gramas > 0)) continue;
      const k = chaveIngrediente(i);
      const atual = soma.get(k);
      if (atual) atual.gramas += i.gramas;
      else soma.set(k, { chave: k, nome: i.nome, grupo: i.grupo, gramas: i.gramas });
    }
  }
  return [...soma.values()]
    .map((i) => ({ ...i, gramas: arredondarCompra(i.gramas) }))
    .sort((a, b) => {
      if ((a.grupo === null) !== (b.grupo === null)) return a.grupo === null ? 1 : -1; // sem grupo vai para o fim
      return (a.grupo ?? "").localeCompare(b.grupo ?? "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/** Texto de quantidade para a lista: "350 g" ou "1,25 kg". */
export function textoQuantidade(g: number): string {
  return g >= 1000 ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : `${g.toLocaleString("pt-BR")} g`;
}

/** As 7 datas da semana (segunda a domingo) a partir da segunda-feira. */
export function diasDaSemana(inicio: string): string[] {
  const d0 = Date.parse(`${inicio}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, k) => new Date(d0 + k * 86_400_000).toISOString().slice(0, 10));
}

/** Gramas de uma porção de receita (peso final ÷ porções), base para registrar "Comi isso". */
export function gramasPorPorcao(pesoFinalG: number, porcoes: number): number | null {
  return pesoFinalG > 0 && porcoes > 0 ? pesoFinalG / porcoes : null;
}

/** Semanas planejáveis: até 8 para trás e 4 para frente da atual. */
export const JANELA_SEMANAS = { antes: 8, depois: 4 } as const;

const segundaDe = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
};
const somar = (iso: string, dias: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

/** Segunda-feira pedida, dentro da janela; qualquer outra coisa vira a semana atual. */
export function semanaDoPlanejamento(valor: unknown, hoje: string): string {
  const atual = segundaDe(hoje);
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(`${valor}T12:00:00Z`))) return atual;
  const s = segundaDe(valor);
  return s < somar(atual, -7 * JANELA_SEMANAS.antes) || s > somar(atual, 7 * JANELA_SEMANAS.depois) ? atual : s;
}

/** A data está dentro da janela planejável? */
export function dataPlanejavel(data: string, hoje: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) return false;
  const atual = segundaDe(hoje);
  return data >= somar(atual, -7 * JANELA_SEMANAS.antes) && data <= somar(atual, 7 * JANELA_SEMANAS.depois + 6);
}
