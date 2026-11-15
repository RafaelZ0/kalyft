// Lembretes escolhidos pela pessoa (Fase 9F). Funções puras: quais lembretes vencem agora, textos neutros,
// validação do endereço de push e do caminho aberto pela notificação. Horários no fuso de São Paulo.
import { FUSO, somarDias } from "@/lib/datas";
import { ROTULOS_REFEICAO, type Refeicao } from "@/lib/validacao/comida";

export const TIPOS_LEMBRETE = ["refeicao", "agua", "peso", "treino"] as const;
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number];

export const LIMITES_LEMBRETE = {
  porPessoa: 10,
  inscricoesPorPessoa: 5,
  /** Envio aceito até este atraso depois do horário (o agendador do GitHub pode atrasar). */
  toleranciaMin: 60,
  adiarMin: 30,
  passoMin: 15,
  pausarDias: [1, 3, 7] as const,
  /** Registros de envio guardados por este período (só para impedir duplicatas). */
  guardarEnviosDias: 30,
} as const;

/** Horas oferecidas na tela (5h às 23h). */
export const HORAS_LEMBRETE = Array.from({ length: 19 }, (_, i) => i + 5);
export const MINUTOS_LEMBRETE = [0, 15, 30, 45] as const;

/** Dias da semana como bits: segunda = 1, terça = 2, …, domingo = 64. */
export const DIAS_LEMBRETE = [
  { bit: 1, curto: "S", nome: "segunda" },
  { bit: 2, curto: "T", nome: "terça" },
  { bit: 4, curto: "Q", nome: "quarta" },
  { bit: 8, curto: "Q", nome: "quinta" },
  { bit: 16, curto: "S", nome: "sexta" },
  { bit: 32, curto: "S", nome: "sábado" },
  { bit: 64, curto: "D", nome: "domingo" },
] as const;
export const TODOS_OS_DIAS = 127;

export type Lembrete = {
  id: string;
  userId: string;
  tipo: TipoLembrete;
  refeicao: Refeicao | null;
  /** Minuto do dia (0–1425, múltiplo de 15). */
  minuto: number;
  dias: number;
  ativo: boolean;
  silenciarFeito: boolean;
  /** Pausado até esta data, inclusive (AAAA-MM-DD). */
  pausadoAte: string | null;
  adiadoPara: Date | null;
};

export type Envio = { lembreteId: string; userId: string; data: string; minuto: number; adiado: boolean };

/** Data, minuto do dia e dia da semana (bit) do instante em São Paulo. */
export function agoraEmSaoPaulo(instante: Date): { data: string; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "0";
  return { data: `${v("year")}-${v("month")}-${v("day")}`, minuto: (Number(v("hour")) % 24) * 60 + Number(v("minute")) };
}

/** Bit do dia da semana de uma data AAAA-MM-DD (segunda = 1 … domingo = 64). */
export function bitDoDia(data: string): number {
  const [a, m, d] = data.split("-").map(Number);
  const dom0 = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return 1 << ((dom0 + 6) % 7);
}

export function minutoValido(m: number): boolean {
  return Number.isInteger(m) && m >= 0 && m <= 1425 && m % LIMITES_LEMBRETE.passoMin === 0;
}

export function textoHorario(minuto: number): string {
  return `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
}

export function textoDias(dias: number): string {
  if (dias === TODOS_OS_DIAS) return "Todos os dias";
  if (dias === 31) return "Segunda a sexta";
  if (dias === 96) return "Sábado e domingo";
  return DIAS_LEMBRETE.filter((d) => dias & d.bit).map((d) => d.nome.slice(0, 3)).join(", ");
}

/**
 * Lembretes que vencem agora. Um horário vence se passou há no máximo `toleranciaMin` (inclusive o de ontem perto
 * da meia-noite), o dia da semana está marcado, o lembrete está ativo e não está pausado naquela data, e o dia não
 * é uma pausa marcada (9A). O adiado vence pelo instante escolhido. A reserva no banco impede envio duplicado.
 */
export function lembretesDevidos(
  lembretes: ReadonlyArray<Lembrete>,
  agora: Date,
  pausasPorUsuario: ReadonlyMap<string, ReadonlyArray<{ inicio: string; fim: string }>> = new Map(),
): Envio[] {
  const { data: hoje, minuto: agoraMin } = agoraEmSaoPaulo(agora);
  const ontem = somarDias(hoje, -1);
  const tol = LIMITES_LEMBRETE.toleranciaMin;
  const emPausa = (userId: string, data: string) =>
    (pausasPorUsuario.get(userId) ?? []).some((p) => data >= p.inicio && data <= p.fim);
  const pausado = (l: Lembrete, data: string) => l.pausadoAte !== null && data <= l.pausadoAte;

  const devidos: Envio[] = [];
  for (const l of lembretes) {
    if (!l.ativo) continue;
    for (const [data, deslocamento] of [[hoje, 0], [ontem, 1440]] as const) {
      const atraso = agoraMin + deslocamento - l.minuto;
      if (atraso < 0 || atraso > tol) continue;
      if (!(l.dias & bitDoDia(data)) || pausado(l, data) || emPausa(l.userId, data)) continue;
      devidos.push({ lembreteId: l.id, userId: l.userId, data, minuto: l.minuto, adiado: false });
    }
    if (l.adiadoPara) {
      const atrasoMs = agora.getTime() - l.adiadoPara.getTime();
      if (atrasoMs >= 0 && atrasoMs <= tol * 60_000) {
        const alvo = agoraEmSaoPaulo(l.adiadoPara);
        if (!pausado(l, alvo.data) && !emPausa(l.userId, alvo.data)) {
          devidos.push({ lembreteId: l.id, userId: l.userId, data: alvo.data, minuto: alvo.minuto, adiado: true });
        }
      }
    }
  }
  return devidos;
}

/** O que a pessoa já fez no dia, para "não avisar se já fiz". */
export type FeitoNoDia = {
  refeicoes: ReadonlySet<Refeicao>;
  pesou: boolean;
  treinou: boolean;
  /** Água do dia atingiu a meta (sem meta: false, então avisa). */
  aguaNaMeta: boolean;
};

export function jaFeito(l: Pick<Lembrete, "tipo" | "refeicao">, feito: FeitoNoDia): boolean {
  switch (l.tipo) {
    case "refeicao":
      return l.refeicao !== null && feito.refeicoes.has(l.refeicao);
    case "peso":
      return feito.pesou;
    case "treino":
      return feito.treinou;
    case "agua":
      return feito.aguaNaMeta;
  }
}

export function nomeDoLembrete(l: Pick<Lembrete, "tipo" | "refeicao">): string {
  if (l.tipo === "refeicao") return l.refeicao ? ROTULOS_REFEICAO[l.refeicao] : "Refeição";
  return { agua: "Água", peso: "Pesagem", treino: "Treino" }[l.tipo];
}

/** Caminho aberto pela notificação. Sempre um caminho do próprio site. */
export function caminhoDoLembrete(l: Pick<Lembrete, "id" | "tipo" | "refeicao">): string {
  const base = { refeicao: "/comida", agua: "/hoje", peso: "/progresso/pesagem", treino: "/treino" }[l.tipo];
  return `${base}?lembrete=${encodeURIComponent(l.id)}`;
}

/**
 * Texto da notificação: neutro, sem números de saúde (passa pelo serviço de push do aparelho) e sem cobrança.
 */
export function textoDoLembrete(l: Pick<Lembrete, "tipo" | "refeicao">): { titulo: string; corpo: string } {
  switch (l.tipo) {
    case "refeicao": {
      const nome = l.refeicao ? ROTULOS_REFEICAO[l.refeicao].toLowerCase() : "refeição";
      const artigo = l.refeicao === "ceia" || l.refeicao === null ? "a" : "o";
      return { titulo: nomeDoLembrete(l), corpo: `Já registrou ${artigo} ${nome}? Toque para registrar.` };
    }
    case "agua":
      return { titulo: "Água", corpo: "Que tal registrar um copo de água?" };
    case "peso":
      return { titulo: "Pesagem", corpo: "Se hoje é dia de pesar, registre o peso." };
    case "treino":
      return { titulo: "Treino", corpo: "Seu treino de hoje está esperando. Dá para adaptar ao tempo que você tem." };
  }
}

/** Serviços de push aceitos. O servidor só envia para estes endereços (nunca para um endereço qualquer). */
const HOSTS_PUSH = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

export function endpointPushValido(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.port === "" && url.username === "" && url.password === "" && HOSTS_PUSH.some((h) => h.test(url.hostname));
}

/** Data até a qual "Pausar todos por N dias" vale (inclusive): hoje conta como o primeiro dia. */
export function pausarAte(hoje: string, dias: number): string {
  return somarDias(hoje, dias - 1);
}
