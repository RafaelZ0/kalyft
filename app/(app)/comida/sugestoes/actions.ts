"use server";

import { z } from "zod";
import { exigirContaPropria as exigirUsuario } from "@/lib/auth/acompanhamento";
import { consumirUsoIa, devolverUsoIa } from "@/lib/dal/ia";
import { metaVigente } from "@/lib/dal/metas";
import { casarItens, type CandidatoAlimento } from "@/lib/dal/refeicao-ia";
import { listarDia } from "@/lib/dal/registros";
import { hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ErroIa } from "@/lib/ia/provedor";
import { obterProvedor } from "@/lib/ia/provedor-ativo";
import { ESQUEMA_SUGESTAO, INSTRUCAO_SISTEMA_SUGESTAO, montarEntradaSugestao, PREFERENCIAS, sanitizarSugestao, TEMPOS_SUGESTAO, type OpcaoSugerida, type Preferencia } from "@/lib/ia/sugestao";
import { registrarErro } from "@/lib/log";
import { refeicao as refeicaoSchema } from "@/lib/validacao/comida";

// Server Action pública e só da conta própria (IA é pessoal): sessão, aceite da IA, Zod, limite diário atômico.
// A IA sugere; os ingredientes são casados com o banco (TACO ou do próprio usuário) e nada é gravado aqui:
// registrar ou salvar como receita passa pelas telas de revisão e pelas actions que já recalculam do banco.

export type IngredienteComCandidatos = OpcaoSugerida["ingredientes"][number] & { candidatos: CandidatoAlimento[] };
export type OpcaoComCandidatos = Omit<OpcaoSugerida, "ingredientes"> & { ingredientes: IngredienteComCandidatos[] };
export type EstadoSugestao = { erro?: string; precisaAceite?: boolean; opcoes?: OpcaoComCandidatos[]; descartadas?: number };

const MSG = {
  ocupada: "A IA está com muitos pedidos agora. Tente de novo em alguns minutos.",
  falhou: "A IA não respondeu. Tente de novo.",
  ilegivel: "A IA não conseguiu montar sugestões com esse pedido. Escreva os ingredientes de outro jeito.",
  vazio: "Não saiu nenhuma sugestão com esses ingredientes. Tente acrescentar mais alguns.",
} as const;

const pedidoSchema = z.object({
  tempo: z.coerce.number().refine((t) => (TEMPOS_SUGESTAO as readonly number[]).includes(t), "Tempo inválido."),
  refeicao: refeicaoSchema,
  preferencias: z.array(z.enum(Object.keys(PREFERENCIAS) as [Preferencia, ...Preferencia[]])).max(5),
  usarMeta: z.boolean(),
});

/** Quanto falta da meta de hoje, calculado no servidor (o cliente não manda números). */
async function restanteDeHoje(userId: string): Promise<{ kcal: number | null; proteinaG: number | null } | null> {
  const hoje = hojeSaoPaulo();
  const [meta, registros] = await Promise.all([metaVigente(userId, hoje), listarDia(userId, hoje)]);
  if (!meta) return null;
  const kcal = registros.reduce((s, r) => s + Number(r.kcal), 0);
  const prot = registros.reduce((s, r) => s + Number(r.proteinaG ?? 0), 0);
  return { kcal: meta.kcal != null ? meta.kcal - kcal : null, proteinaG: meta.proteinaG != null ? meta.proteinaG - prot : null };
}

export async function sugerirRefeicoes(_: EstadoSugestao, form: FormData): Promise<EstadoSugestao> {
  const { userId, admin } = await exigirUsuario();
  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) return { erro: acesso.erro, precisaAceite: acesso.precisaAceite };
  const r = pedidoSchema.safeParse({
    tempo: form.get("tempo"),
    refeicao: form.get("refeicao"),
    preferencias: form.getAll("preferencias").filter((v) => typeof v === "string"),
    usarMeta: form.get("usarMeta") === "on",
  });
  if (!r.success) return { erro: "Confira o tempo, a refeição e as preferências." };
  const entrada = montarEntradaSugestao({
    ingredientes: String(form.get("ingredientes") ?? ""),
    tempo: r.data.tempo as (typeof TEMPOS_SUGESTAO)[number],
    refeicao: r.data.refeicao,
    preferencias: r.data.preferencias,
    observacao: String(form.get("observacao") ?? ""),
    restante: r.data.usarMeta ? await restanteDeHoje(userId) : null,
  });
  if (!entrada) return { erro: "Escreva quais ingredientes você tem (pelo menos alguns)." };

  const dia = hojeSaoPaulo();
  if (!(await consumirUsoIa(userId, dia, "sugestao"))) return { erro: `Você já usou as ${LIMITE_DIARIO.sugestao} sugestões de hoje. Tente de novo amanhã.` };
  let bruto: unknown;
  try {
    bruto = await obterProvedor().gerar({ sistema: INSTRUCAO_SISTEMA_SUGESTAO, texto: entrada.texto, arquivos: [], esquema: ESQUEMA_SUGESTAO });
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.motivo : null;
    if (!motivo) registrarErro("sugerirRefeicoes", e);
    if (motivo === "bloqueada" || motivo === "formato") return { erro: MSG.ilegivel }; // conta como uso
    await devolverUsoIa(userId, dia, "sugestao");
    return { erro: motivo === "limite_provedor" ? MSG.ocupada : MSG.falhou };
  }
  try {
    const { opcoes, descartadas } = sanitizarSugestao(bruto);
    if (opcoes.length === 0) return { erro: MSG.vazio };
    const comCandidatos: OpcaoComCandidatos[] = [];
    for (const o of opcoes) {
      const candidatos = await casarItens(userId, o.ingredientes);
      comCandidatos.push({ ...o, ingredientes: o.ingredientes.map((i, k) => ({ ...i, candidatos: candidatos[k] })) });
    }
    return { opcoes: comCandidatos, descartadas };
  } catch (e) {
    registrarErro("sugerirRefeicoes", e);
    return { erro: MSG.ilegivel };
  }
}
