import { describe, expect, it } from "vitest";
import {
  agoraEmSaoPaulo,
  bitDoDia,
  caminhoDoLembrete,
  endpointPushValido,
  jaFeito,
  lembretesDevidos,
  minutoValido,
  pausarAte,
  textoDias,
  textoDoLembrete,
  textoHorario,
  type Lembrete,
} from "@/lib/lembretes";

// São Paulo = UTC-3 (sem horário de verão desde 2019). 2026-11-16 é segunda-feira.
const sp = (data: string, hhmm: string) => new Date(`${data}T${hhmm}:00-03:00`);

const base: Lembrete = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "u1",
  tipo: "refeicao",
  refeicao: "almoco",
  minuto: 12 * 60,
  dias: 127,
  ativo: true,
  silenciarFeito: true,
  pausadoAte: null,
  adiadoPara: null,
};

describe("horário de São Paulo", () => {
  it("data e minuto do dia", () => {
    expect(agoraEmSaoPaulo(sp("2026-11-16", "12:07"))).toEqual({ data: "2026-11-16", minuto: 727 });
    expect(agoraEmSaoPaulo(new Date("2026-11-17T02:30:00Z"))).toEqual({ data: "2026-11-16", minuto: 23 * 60 + 30 });
  });
  it("bit do dia da semana (segunda = 1, domingo = 64)", () => {
    expect(bitDoDia("2026-11-16")).toBe(1);
    expect(bitDoDia("2026-11-21")).toBe(32);
    expect(bitDoDia("2026-11-22")).toBe(64);
  });
  it("minuto válido e textos", () => {
    expect(minutoValido(0)).toBe(true);
    expect(minutoValido(1425)).toBe(true);
    expect(minutoValido(1440)).toBe(false);
    expect(minutoValido(610)).toBe(false);
    expect(minutoValido(-15)).toBe(false);
    expect(textoHorario(7 * 60 + 30)).toBe("07:30");
    expect(textoDias(127)).toBe("Todos os dias");
    expect(textoDias(31)).toBe("Segunda a sexta");
    expect(textoDias(96)).toBe("Sábado e domingo");
    expect(textoDias(1 | 4)).toBe("seg, qua");
  });
});

describe("lembretesDevidos", () => {
  it("vence no horário e até 60 min depois; não antes nem depois disso", () => {
    expect(lembretesDevidos([base], sp("2026-11-16", "11:59"))).toEqual([]);
    expect(lembretesDevidos([base], sp("2026-11-16", "12:00"))).toEqual([
      { lembreteId: base.id, userId: "u1", data: "2026-11-16", minuto: 720, adiado: false },
    ]);
    expect(lembretesDevidos([base], sp("2026-11-16", "13:00"))).toHaveLength(1);
    expect(lembretesDevidos([base], sp("2026-11-16", "13:01"))).toEqual([]);
  });
  it("lembrete de 23:45 ainda sai depois da meia-noite, com a data de ontem", () => {
    const l = { ...base, minuto: 23 * 60 + 45 };
    expect(lembretesDevidos([l], sp("2026-11-17", "00:20"))).toEqual([
      { lembreteId: l.id, userId: "u1", data: "2026-11-16", minuto: 1425, adiado: false },
    ]);
  });
  it("respeita dias da semana, ativo, pausa do lembrete e pausa marcada", () => {
    const agora = sp("2026-11-16", "12:10"); // segunda
    expect(lembretesDevidos([{ ...base, dias: 2 }], agora)).toEqual([]);
    expect(lembretesDevidos([{ ...base, ativo: false }], agora)).toEqual([]);
    expect(lembretesDevidos([{ ...base, pausadoAte: "2026-11-16" }], agora)).toEqual([]);
    expect(lembretesDevidos([{ ...base, pausadoAte: "2026-11-15" }], agora)).toHaveLength(1);
    const pausas = new Map([["u1", [{ inicio: "2026-11-14", fim: "2026-11-16" }]]]);
    expect(lembretesDevidos([base], agora, pausas)).toEqual([]);
    expect(lembretesDevidos([{ ...base, userId: "u2" }], agora, pausas)).toHaveLength(1);
  });
  it("adiado vence pelo instante escolhido, mesmo com o horário normal já passado", () => {
    const l = { ...base, adiadoPara: sp("2026-11-16", "14:30") };
    expect(lembretesDevidos([l], sp("2026-11-16", "14:29"))).toEqual([]);
    expect(lembretesDevidos([l], sp("2026-11-16", "14:45"))).toEqual([
      { lembreteId: l.id, userId: "u1", data: "2026-11-16", minuto: 870, adiado: true },
    ]);
    expect(lembretesDevidos([l], sp("2026-11-16", "15:31"))).toEqual([]);
    expect(lembretesDevidos([{ ...l, pausadoAte: "2026-11-16" }], sp("2026-11-16", "14:45"))).toEqual([]);
  });
});

describe("já feito e textos", () => {
  const nada = { refeicoes: new Set<never>(), pesou: false, treinou: false, aguaNaMeta: false };
  it("cada tipo olha o próprio registro", () => {
    expect(jaFeito(base, nada)).toBe(false);
    expect(jaFeito(base, { ...nada, refeicoes: new Set(["almoco"] as const) })).toBe(true);
    expect(jaFeito(base, { ...nada, refeicoes: new Set(["jantar"] as const) })).toBe(false);
    expect(jaFeito({ tipo: "peso", refeicao: null }, { ...nada, pesou: true })).toBe(true);
    expect(jaFeito({ tipo: "treino", refeicao: null }, { ...nada, treinou: true })).toBe(true);
    expect(jaFeito({ tipo: "agua", refeicao: null }, { ...nada, aguaNaMeta: true })).toBe(true);
    expect(jaFeito({ tipo: "agua", refeicao: null }, nada)).toBe(false);
  });
  it("textos neutros, sem números, com artigo certo", () => {
    expect(textoDoLembrete(base).corpo).toBe("Já registrou o almoço? Toque para registrar.");
    expect(textoDoLembrete({ tipo: "refeicao", refeicao: "ceia" }).corpo).toBe("Já registrou a ceia? Toque para registrar.");
    for (const tipo of ["agua", "peso", "treino"] as const) {
      const t = textoDoLembrete({ tipo, refeicao: null });
      expect(`${t.titulo} ${t.corpo}`).not.toMatch(/\d/);
    }
  });
  it("caminho é sempre do próprio site", () => {
    expect(caminhoDoLembrete(base)).toBe(`/comida?lembrete=${base.id}`);
    expect(caminhoDoLembrete({ ...base, tipo: "peso" })).toMatch(/^\/progresso\/pesagem\?/);
  });
  it("pausar por N dias conta hoje", () => {
    expect(pausarAte("2026-11-16", 1)).toBe("2026-11-16");
    expect(pausarAte("2026-11-16", 7)).toBe("2026-11-22");
  });
});

describe("endpointPushValido", () => {
  it("aceita só https dos serviços de push conhecidos", () => {
    expect(endpointPushValido("https://web.push.apple.com/QGx2abc")).toBe(true);
    expect(endpointPushValido("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(endpointPushValido("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(endpointPushValido("https://wns2-bl2p.notify.windows.com/w/?token=abc")).toBe(true);
  });
  it("recusa endereços internos, http, porta, usuário e imitações", () => {
    for (const e of [
      "http://web.push.apple.com/x",
      "https://169.254.169.254/latest",
      "https://localhost/x",
      "https://web.push.apple.com:8443/x",
      "https://user:pw@web.push.apple.com/x",
      "https://web.push.apple.com.evil.com/x",
      "https://evilweb.push.apple.com/x",
      "https://fcm.googleapis.com.evil.io/x",
      "javascript:alert(1)",
      "nao e url",
      `https://web.push.apple.com/${"a".repeat(1000)}`,
    ]) {
      expect(endpointPushValido(e), e).toBe(false);
    }
  });
});
