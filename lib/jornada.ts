// Jornada inicial (cadastro guiado). Regras puras: quais etapas valem para o caminho escolhido, ordem e como as
// respostas entram no rascunho. O rascunho NÃO é dado aplicado: perfil, pesagens e metas só mudam na finalização
// com revisão (entrega 2B). Campo ausente = "não informado" (nunca zero, "sedentário" ou confirmação falsa).
import { NIVEIS_ATIVIDADE } from "@/lib/validacao/perfil";

/** Versão do contrato do rascunho em produção (não a versão do protótipo). */
export const VERSAO_JORNADA = 1;
/**
 * Limite do rascunho no app (bytes UTF-8 do JSON). Menor que o CHECK do banco (16 KB), que mede o texto do jsonb
 * com espaços extras: assim o app recusa antes e o banco nunca rejeita de surpresa. Um rascunho real tem < 2 KB.
 */
export const TAMANHO_MAX_RASCUNHO = 12_000;

export const ETAPAS = ["foco", "perfil", "objetivo", "rotina", "atividade", "treino", "alimentacao", "revisao", "inicio"] as const;
export type Etapa = (typeof ETAPAS)[number];
/** Etapas com "Agora não": guardadas como objeto vazio (pulada), diferente de não visitada (ausente). */
export const ETAPAS_PULAVEIS = ["perfil", "rotina", "atividade", "treino", "alimentacao"] as const satisfies readonly Etapa[];
export const ESTADOS_JORNADA = ["em_andamento", "adiada", "concluida"] as const;
export type EstadoJornada = (typeof ESTADOS_JORNADA)[number];
export const ESTADOS_TUTORIAL = ["nao_iniciado", "em_andamento", "pulado", "concluido"] as const;

// Opções (mesmos valores do protótipo v2 aprovado).
export const AREAS = ["comida", "treino", "ambos"] as const;
export const PRIMEIRAS = ["comida", "treino"] as const;
export const SEXOS_JORNADA = ["feminino", "masculino", "depois"] as const;
export const OBJETIVOS = ["organizar", "reduzir", "manter", "massa", "forca"] as const;
/** Objetivos em que um peso de referência faz sentido. */
export const OBJETIVOS_COM_PESO = ["reduzir", "manter", "massa"] as const;
export const TRABALHOS = ["sentado", "alternado", "movimento", "fisico"] as const;
export const DESLOCAMENTOS = ["transporte", "caminhada", "bicicleta", "casa", "misto"] as const;
export const EXERCICIOS = ["nenhum", "voltando", "regular"] as const;
export const TIPOS_EXERCICIO = ["musculacao", "caminhada", "corrida", "bike", "esporte", "outro"] as const;
export const METODOS = ["ajuda", "existente", "manual"] as const;
export const EXPERIENCIAS = ["iniciante", "retorno", "regular"] as const;
export const LOCAIS = ["academia", "casa", "ar_livre", "misto"] as const;
export const EQUIPAMENTOS = ["completa", "halteres", "elasticos", "corpo"] as const;
export const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
export const LIMITACOES = ["nao", "profissional", "adaptacao"] as const;
export const PREFERENCIAS = ["variada", "vegetariana", "vegana", "outra"] as const;
export const RESTRICOES = ["nao", "lactose", "gluten", "outra"] as const;
export const ALERGIAS = ["nao", "sim", "depois"] as const;
export const PLANEJAMENTOS = ["sim", "depois", "nao"] as const;

type Um<T extends readonly string[]> = T[number];

export type RespostasFoco = { area: Um<typeof AREAS>; primeira?: Um<typeof PRIMEIRAS> };
export type RespostasPerfil = {
  nome?: string;
  nascimento?: string;
  sexo?: Um<typeof SEXOS_JORNADA>;
  alturaCm?: number;
  pesoKg?: number;
  dataPesagem?: string;
};
export type RespostasObjetivo = { objetivo: Um<typeof OBJETIVOS>; pesoReferenciaKg?: number };
export type RespostasRotina = { trabalho?: Um<typeof TRABALHOS>; deslocamento?: Um<typeof DESLOCAMENTOS> };
export type RespostasAtividade = {
  exercicio?: Um<typeof EXERCICIOS>;
  tipos?: Array<Um<typeof TIPOS_EXERCICIO>>;
  diasPorSemana?: number;
  minutos?: number;
  nivelDeclarado?: Um<typeof NIVEIS_ATIVIDADE>;
};
export type RespostasTreino = {
  metodo?: Um<typeof METODOS>;
  experiencia?: Um<typeof EXPERIENCIAS>;
  local?: Um<typeof LOCAIS>;
  equipamentos?: Array<Um<typeof EQUIPAMENTOS>>;
  diasSemana?: Array<Um<typeof DIAS_SEMANA>>;
  minutosSessao?: number;
  limitacao?: Um<typeof LIMITACOES>;
};
export type RespostasAlimentacao = {
  metodo?: Um<typeof METODOS>;
  preferencia?: Um<typeof PREFERENCIAS>;
  restricao?: Um<typeof RESTRICOES>;
  alergia?: Um<typeof ALERGIAS>;
  refeicoesPorDia?: number;
  minutosPreparo?: number;
  planejamento?: Um<typeof PLANEJAMENTOS>;
};

export type Rascunho = {
  foco?: RespostasFoco;
  perfil?: RespostasPerfil;
  objetivo?: RespostasObjetivo;
  rotina?: RespostasRotina;
  atividade?: RespostasAtividade;
  treino?: RespostasTreino;
  alimentacao?: RespostasAlimentacao;
};
export type EtapaComRespostas = keyof Rascunho;
export type RespostasDe<E extends Etapa> = E extends EtapaComRespostas ? NonNullable<Rascunho[E]> : Record<string, never>;

/** Etapas do caminho: treino e alimentação só para quem escolheu essas áreas. */
export function etapasAplicaveis(r: Rascunho): Etapa[] {
  const area = r.foco?.area;
  return [
    "foco",
    "perfil",
    "objetivo",
    "rotina",
    "atividade",
    ...(area === "treino" || area === "ambos" ? (["treino"] as const) : []),
    ...(area === "comida" || area === "ambos" ? (["alimentacao"] as const) : []),
    "revisao",
    "inicio",
  ];
}

export function etapaSeguinte(r: Rascunho, etapa: Etapa): Etapa {
  const rota = etapasAplicaveis(r);
  const i = rota.indexOf(etapa);
  return i < 0 ? rota[0] : rota[Math.min(rota.length - 1, i + 1)];
}

export function etapaAnterior(r: Rascunho, etapa: Etapa): Etapa {
  const rota = etapasAplicaveis(r);
  const i = rota.indexOf(etapa);
  return i <= 0 ? rota[0] : rota[i - 1];
}

/**
 * A etapa pode ser salva agora? Precisa estar no caminho; antes de escolher o foco, só o foco; revisão e início
 * só depois de foco e objetivo respondidos.
 */
export function etapaDisponivel(r: Rascunho, etapa: Etapa): boolean {
  if (etapa === "foco") return true;
  if (!r.foco) return false;
  if (!etapasAplicaveis(r).includes(etapa)) return false;
  if ((etapa === "revisao" || etapa === "inicio") && !r.objetivo) return false;
  return true;
}

/**
 * Novo rascunho com as respostas (já validadas) da etapa. Trocar a área remove as respostas da área que saiu do
 * caminho. Revisão e início não guardam respostas. Não altera o original.
 */
export function aplicarRespostas<E extends Etapa>(r: Rascunho, etapa: E, respostas: RespostasDe<E>): Rascunho {
  const novo: Rascunho = structuredClone(r);
  if (etapa === "revisao" || etapa === "inicio") return novo;
  (novo as Record<string, unknown>)[etapa] = structuredClone(respostas);
  if (etapa === "foco") {
    const area = (respostas as RespostasFoco).area;
    if (area === "comida") delete novo.treino;
    if (area === "treino") delete novo.alimentacao;
  }
  return novo;
}

/** Tamanho do rascunho em bytes UTF-8, como o banco mede (texto do JSON). */
export function tamanhoRascunho(r: Rascunho): number {
  return new TextEncoder().encode(JSON.stringify(r)).length;
}
