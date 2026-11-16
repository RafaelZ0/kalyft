// O que a revisão da jornada pode aplicar à conta. Funções puras: recebem o rascunho (do servidor) e os dados
// atuais, e descrevem as mudanças possíveis para a pessoa escolher. Nada aqui grava.
// Regras: só entra o que foi informado; vazio nunca apaga; valor diferente do atual começa desmarcado (a pessoa
// decide trocar); pesagem só com peso E data; pesagem já existente na data exige decisão explícita.
import type { Rascunho } from "@/lib/jornada";

export const CAMPOS_PERFIL_JORNADA = ["nome", "dataNascimento", "sexo", "alturaCm", "nivelAtividade"] as const;
export type CampoPerfilJornada = (typeof CAMPOS_PERFIL_JORNADA)[number];

export type PerfilAtual = Record<CampoPerfilJornada, string | number | null>;
export type MudancaPerfil = { campo: CampoPerfilJornada; atual: string | number | null; novo: string | number; padrao: boolean };

export type PlanoPesagem =
  | { tipo: "nenhuma" }
  | { tipo: "sem_data"; pesoKg: number }
  | { tipo: "nova"; data: string; pesoKg: number }
  | { tipo: "igual"; data: string; pesoKg: number }
  | { tipo: "existente"; data: string; pesoKg: number; pesoAtualKg: number; podeSubstituir: boolean };

export type PlanoAplicacao = { perfil: MudancaPerfil[]; pesagem: PlanoPesagem };

/** Valores do rascunho que correspondem a campos do perfil (sexo "depois" não altera nada). */
function propostasDoPerfil(r: Rascunho): Partial<Record<CampoPerfilJornada, string | number>> {
  const p = r.perfil ?? {};
  return {
    ...(p.nome ? { nome: p.nome } : {}),
    ...(p.nascimento ? { dataNascimento: p.nascimento } : {}),
    ...(p.sexo && p.sexo !== "depois" ? { sexo: p.sexo } : {}),
    ...(p.alturaCm !== undefined ? { alturaCm: p.alturaCm } : {}),
    ...(r.atividade?.nivelDeclarado ? { nivelAtividade: r.atividade.nivelDeclarado } : {}),
  };
}

export function planoDeAplicacao(
  r: Rascunho,
  atual: PerfilAtual,
  pesagemNaData: { pesoKg: number; massaMagraKg: number | null } | null,
): PlanoAplicacao {
  const propostas = propostasDoPerfil(r);
  const perfil: MudancaPerfil[] = [];
  for (const campo of CAMPOS_PERFIL_JORNADA) {
    const novo = propostas[campo];
    if (novo === undefined) continue;
    const anterior = atual[campo];
    if (anterior !== null && String(anterior) === String(novo)) continue;
    perfil.push({ campo, atual: anterior, novo, padrao: anterior === null });
  }

  const peso = r.perfil?.pesoKg;
  const data = r.perfil?.dataPesagem;
  let pesagem: PlanoPesagem = { tipo: "nenhuma" };
  if (peso !== undefined && !data) pesagem = { tipo: "sem_data", pesoKg: peso };
  else if (peso !== undefined && data) {
    if (!pesagemNaData) pesagem = { tipo: "nova", data, pesoKg: peso };
    else if (pesagemNaData.pesoKg === peso) pesagem = { tipo: "igual", data, pesoKg: peso };
    else {
      pesagem = {
        tipo: "existente",
        data,
        pesoKg: peso,
        pesoAtualKg: pesagemNaData.pesoKg,
        podeSubstituir: pesagemNaData.massaMagraKg === null || pesagemNaData.massaMagraKg <= peso,
      };
    }
  }
  return { perfil, pesagem };
}

/**
 * Preferências confirmadas guardadas na conclusão: escolhas estruturadas da jornada, sem duplicar o que vai para o
 * perfil e as pesagens. O peso de referência fica como intenção — NÃO vira meta (metas têm fluxo próprio).
 */
export function preferenciasDoRascunho(r: Rascunho): Record<string, unknown> {
  const pref: Record<string, unknown> = {};
  if (r.foco) pref.foco = r.foco;
  if (r.objetivo) pref.objetivo = r.objetivo;
  if (r.rotina) pref.rotina = r.rotina;
  if (r.atividade) {
    const { nivelDeclarado: _nivel, ...resto } = r.atividade;
    void _nivel;
    pref.atividade = resto;
  }
  if (r.treino) pref.treino = r.treino;
  if (r.alimentacao) pref.alimentacao = r.alimentacao;
  return structuredClone(pref);
}
