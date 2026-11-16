// Validação da jornada inicial. Duas formas:
// - entrada (formulário): textos, vírgula decimal, vazio = não informado → objeto limpo, sem nulos;
// - rascunho guardado (JSONB): estrito, números já convertidos, sem campos extras.
// Nenhum campo de texto livre além do nome: nada de histórico clínico, alergênicos detalhados ou objetos arbitrários.
import { z } from "zod";
import { hojeSaoPaulo } from "@/lib/datas";
import {
  ALERGIAS,
  AREAS,
  DESLOCAMENTOS,
  DIAS_SEMANA,
  EQUIPAMENTOS,
  ETAPAS,
  EXERCICIOS,
  EXPERIENCIAS,
  LIMITACOES,
  LOCAIS,
  METODOS,
  OBJETIVOS,
  OBJETIVOS_COM_PESO,
  PLANEJAMENTOS,
  PREFERENCIAS,
  PRIMEIRAS,
  RESTRICOES,
  SEXOS_JORNADA,
  TIPOS_EXERCICIO,
  TRABALHOS,
  VERSAO_JORNADA,
  type Etapa,
  type RespostasDe,
} from "@/lib/jornada";
import { dataOpcional, decimalOpcional, errosPorCampo, inteiroOpcional, opcaoOpcional, textoOpcional, type ErrosCampos } from "./comum";
import { NIVEIS_ATIVIDADE } from "./perfil";

// Números podem chegar como número (JSON) ou texto (formulário): os validadores do app esperam texto.
const comoTexto = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : v);
const inteiro = (min: number, max: number, rotulo: string) => z.preprocess(comoTexto, inteiroOpcional(min, max, rotulo));
const decimal = (min: number, max: number, rotulo: string) => z.preprocess(comoTexto, decimalOpcional(min, max, rotulo));

/** Lista de opções (checkboxes): vazia = não informado; sem repetição; só opções conhecidas. */
function lista<const T extends readonly [string, ...string[]]>(opcoes: T, rotulo: string) {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? null : Array.isArray(v) ? (v.length === 0 ? null : v) : [v]),
    z
      .array(z.enum(opcoes, { error: `${rotulo}: opção inválida.` }))
      .max(opcoes.length, `${rotulo}: opções demais.`)
      .refine((l) => new Set(l).size === l.length, `${rotulo}: opção repetida.`)
      .nullable(),
  );
}

const entradaFoco = z
  .strictObject({ area: opcaoOpcional(AREAS, "Área"), primeira: opcaoOpcional(PRIMEIRAS, "Primeira área").optional() })
  .superRefine((d, ctx) => {
    if (!d.area) ctx.addIssue({ code: "custom", path: ["area"], message: "Escolha por onde quer começar." });
    if (d.area === "ambos" && !d.primeira) ctx.addIssue({ code: "custom", path: ["primeira"], message: "Escolha a primeira área." });
    if (d.area !== "ambos" && d.primeira) ctx.addIssue({ code: "custom", path: ["primeira"], message: "A primeira área só vale quando escolher as duas." });
  });

const entradaPerfil = z
  .strictObject({
    nome: textoOpcional(80, "Nome").optional(),
    nascimento: dataOpcional("Nascimento", { min: "1900-01-01", max: hojeSaoPaulo }).optional(),
    sexo: opcaoOpcional(SEXOS_JORNADA, "Sexo").optional(),
    alturaCm: decimal(100, 250, "Altura").optional(),
    pesoKg: decimal(20, 400, "Peso").optional(),
    dataPesagem: dataOpcional("Data da pesagem", { min: "2000-01-01", max: hojeSaoPaulo }).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.dataPesagem && d.pesoKg == null) ctx.addIssue({ code: "custom", path: ["pesoKg"], message: "Informe o peso dessa pesagem." });
  });

const entradaObjetivo = z
  .strictObject({ objetivo: opcaoOpcional(OBJETIVOS, "Objetivo"), pesoReferenciaKg: decimal(20, 400, "Peso de referência").optional() })
  .superRefine((d, ctx) => {
    if (!d.objetivo) ctx.addIssue({ code: "custom", path: ["objetivo"], message: "Escolha um objetivo para orientar o caminho." });
    if (d.pesoReferenciaKg != null && !(OBJETIVOS_COM_PESO as readonly string[]).includes(d.objetivo ?? "")) {
      ctx.addIssue({ code: "custom", path: ["pesoReferenciaKg"], message: "Peso de referência só vale para reduzir, manter ou ganhar massa." });
    }
  });

const entradaRotina = z.strictObject({
  trabalho: opcaoOpcional(TRABALHOS, "Dia a dia").optional(),
  deslocamento: opcaoOpcional(DESLOCAMENTOS, "Deslocamento").optional(),
});

const entradaAtividade = z
  .strictObject({
    exercicio: opcaoOpcional(EXERCICIOS, "Atividade").optional(),
    tipos: lista(TIPOS_EXERCICIO, "Atividades").optional(),
    diasPorSemana: inteiro(1, 7, "Dias por semana").optional(),
    minutos: inteiro(5, 300, "Minutos por atividade").optional(),
    nivelDeclarado: opcaoOpcional(NIVEIS_ATIVIDADE, "Nível de atividade").optional(),
  })
  .superRefine((d, ctx) => {
    const pratica = d.exercicio === "regular" || d.exercicio === "voltando";
    if (pratica && d.diasPorSemana == null) {
      ctx.addIssue({ code: "custom", path: ["diasPorSemana"], message: "Informe quantos dias costuma praticar, ou use “Agora não”." });
    }
    if (!pratica) {
      for (const campo of ["tipos", "diasPorSemana", "minutos"] as const) {
        if (d[campo] != null) ctx.addIssue({ code: "custom", path: [campo], message: "Só para quem já pratica ou está voltando." });
      }
    }
  });

const entradaTreino = z.strictObject({
  metodo: opcaoOpcional(METODOS, "Como começar").optional(),
  experiencia: opcaoOpcional(EXPERIENCIAS, "Experiência").optional(),
  local: opcaoOpcional(LOCAIS, "Local").optional(),
  equipamentos: lista(EQUIPAMENTOS, "Equipamentos").optional(),
  diasSemana: lista(DIAS_SEMANA, "Dias").optional(),
  minutosSessao: inteiro(10, 180, "Minutos por sessão").optional(),
  limitacao: opcaoOpcional(LIMITACOES, "Limitação").optional(),
});

const entradaAlimentacao = z.strictObject({
  metodo: opcaoOpcional(METODOS, "Como começar").optional(),
  preferencia: opcaoOpcional(PREFERENCIAS, "Preferência").optional(),
  restricao: opcaoOpcional(RESTRICOES, "Restrição").optional(),
  alergia: opcaoOpcional(ALERGIAS, "Alergia").optional(),
  refeicoesPorDia: inteiro(1, 10, "Refeições por dia").optional(),
  minutosPreparo: inteiro(0, 180, "Minutos de preparo").optional(),
  planejamento: opcaoOpcional(PLANEJAMENTOS, "Planejamento").optional(),
});

const semRespostas = z.strictObject({});

const ENTRADAS: Record<Etapa, z.ZodType> = {
  foco: entradaFoco,
  perfil: entradaPerfil,
  objetivo: entradaObjetivo,
  rotina: entradaRotina,
  atividade: entradaAtividade,
  treino: entradaTreino,
  alimentacao: entradaAlimentacao,
  revisao: semRespostas,
  inicio: semRespostas,
};

/** Remove nulos e indefinidos: no rascunho, ausente = não informado. */
function limpar(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
}

export type ResultadoRespostas<E extends Etapa = Etapa> =
  | { ok: true; etapa: E; respostas: RespostasDe<E> }
  | { ok: false; erros: ErrosCampos };

/** Valida as respostas de uma etapa vindas do formulário. Erros por campo; campos extras viram erro em "_". */
export function validarRespostas(etapa: unknown, respostas: unknown): ResultadoRespostas {
  const e = z.enum(ETAPAS).safeParse(etapa);
  if (!e.success) return { ok: false, erros: { etapa: "Etapa inválida." } };
  const r = ENTRADAS[e.data].safeParse(respostas ?? {});
  if (!r.success) return { ok: false, erros: errosPorCampo(r.error) };
  return { ok: true, etapa: e.data, respostas: limpar(r.data as Record<string, unknown>) as RespostasDe<Etapa> };
}

/** Contrato do salvamento (a identidade vem da sessão, nunca daqui). */
export const salvarEtapaSchema = z.strictObject({
  versao: z.literal(VERSAO_JORNADA),
  revisaoEsperada: z.number().int().min(0).max(1_000_000_000),
  etapa: z.enum(ETAPAS),
  respostas: z.record(z.string(), z.unknown()),
});
export type EntradaSalvarEtapa = z.infer<typeof salvarEtapaSchema>;

// ── rascunho guardado (já normalizado) ──
const num = (min: number, max: number, inteiroSo = false) => (inteiroSo ? z.number().int().min(min).max(max) : z.number().min(min).max(max));
const unicos = <T extends readonly [string, ...string[]]>(op: T) =>
  z.array(z.enum(op)).min(1).max(op.length).refine((l) => new Set(l).size === l.length);
const dataIso = z.iso.date();

export const rascunhoSchema = z.strictObject({
  foco: z.strictObject({ area: z.enum(AREAS), primeira: z.enum(PRIMEIRAS).optional() }).optional(),
  perfil: z
    .strictObject({
      nome: z.string().min(1).max(80).optional(),
      nascimento: dataIso.optional(),
      sexo: z.enum(SEXOS_JORNADA).optional(),
      alturaCm: num(100, 250).optional(),
      pesoKg: num(20, 400).optional(),
      dataPesagem: dataIso.optional(),
    })
    .optional(),
  objetivo: z.strictObject({ objetivo: z.enum(OBJETIVOS), pesoReferenciaKg: num(20, 400).optional() }).optional(),
  rotina: z.strictObject({ trabalho: z.enum(TRABALHOS).optional(), deslocamento: z.enum(DESLOCAMENTOS).optional() }).optional(),
  atividade: z
    .strictObject({
      exercicio: z.enum(EXERCICIOS).optional(),
      tipos: unicos(TIPOS_EXERCICIO).optional(),
      diasPorSemana: num(1, 7, true).optional(),
      minutos: num(5, 300, true).optional(),
      nivelDeclarado: z.enum(NIVEIS_ATIVIDADE).optional(),
    })
    .optional(),
  treino: z
    .strictObject({
      metodo: z.enum(METODOS).optional(),
      experiencia: z.enum(EXPERIENCIAS).optional(),
      local: z.enum(LOCAIS).optional(),
      equipamentos: unicos(EQUIPAMENTOS).optional(),
      diasSemana: unicos(DIAS_SEMANA).optional(),
      minutosSessao: num(10, 180, true).optional(),
      limitacao: z.enum(LIMITACOES).optional(),
    })
    .optional(),
  alimentacao: z
    .strictObject({
      metodo: z.enum(METODOS).optional(),
      preferencia: z.enum(PREFERENCIAS).optional(),
      restricao: z.enum(RESTRICOES).optional(),
      alergia: z.enum(ALERGIAS).optional(),
      refeicoesPorDia: num(1, 10, true).optional(),
      minutosPreparo: num(0, 180, true).optional(),
      planejamento: z.enum(PLANEJAMENTOS).optional(),
    })
    .optional(),
});
