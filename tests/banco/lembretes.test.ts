// Fase 9F: lembretes e inscrições de push, contra o banco de teste. O envio usa um provedor falso.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }) }));
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { createElement } from "react";
import { prerender } from "react-dom/static";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const C = randomUUID(); // conta ainda não aprovada
const sessao = { userId: A, admin: null };
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao, obterVinculoSessao: async () => "0".repeat(64) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); },
  notFound: () => { throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); },
  usePathname: () => "/ajustes/lembretes",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

import { db } from "@/lib/db";
import { acessos, agua, inscricoesPush, lembretes, lembretesEnvios, metas, pausas, perfis, pesagens } from "@/lib/db/schema";
import { garantirPerfil } from "@/lib/dal/perfil";
import { listarLembretes, salvarInscricao } from "@/lib/dal/lembretes";
import { enviarLembretesDevidos } from "@/lib/lembretes-execucao";
import type { CargaPush, EnviarPush, InscricaoPush, ResultadoPush } from "@/lib/push";
import {
  adiarLembreteAcao, apagarLembreteAcao, atualizarLembreteAcao, criarLembreteAcao, hojeNaoAcao, pausarTodosAcao, removerInscricaoAcao, salvarInscricaoAcao,
} from "@/app/(app)/ajustes/lembretes/actions";
import PaginaLembretes from "@/app/(app)/ajustes/lembretes/page";
import { POST } from "@/app/api/lembretes/enviar/route";

// 2026-11-16 é segunda-feira. Meio-dia e cinco em São Paulo.
const AGORA = new Date("2026-11-16T12:05:00-03:00");
const DIA = "2026-11-16";
const chaves = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
const endpoint = (dono: string) => `https://web.push.apple.com/teste-${dono}-${randomUUID()}`;

const form = (campos: Record<string, string | string[]>) => {
  const f = new FormData();
  f.set("contextoId", "proprio");
  for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const dados = (extra: Record<string, string | string[]> = {}) =>
  form({ tipo: "refeicao", refeicao: "almoco", hora: "12", min: "0", dias: ["1", "2", "4", "8", "16", "32", "64"], silenciarFeito: "on", ativo: "on", ...extra });

/** Provedor falso: registra só os envios para os endpoints deste teste. */
function provedor(resposta: (i: InscricaoPush) => ResultadoPush = () => "ok") {
  const envios: Array<{ endpoint: string; carga: CargaPush }> = [];
  const enviar: EnviarPush = async (i, carga) => {
    if (!i.endpoint.includes("/teste-")) return "ok";
    envios.push({ endpoint: i.endpoint, carga });
    return resposta(i);
  };
  return { enviar, envios, de: (dono: string) => envios.filter((e) => e.endpoint.includes(`/teste-${dono}-`)) };
}

async function html(): Promise<string> {
  const arvore = await PaginaLembretes();
  const { prelude } = await prerender(createElement("div", null, arvore));
  return new Response(prelude).text();
}

beforeAll(async () => {
  for (const u of [A, B, C]) await garantirPerfil(u);
  await db.insert(acessos).values([
    { userId: A, email: "a-9f@teste.invalid", status: "aprovado" },
    { userId: B, email: "b-9f@teste.invalid", status: "aprovado" },
    { userId: C, email: "c-9f@teste.invalid", status: "pendente" },
  ]);
}, 60_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B, C]));
  await db.delete(acessos).where(inArray(acessos.userId, [A, B, C]));
});

describe("lembretes da própria conta", () => {
  it("cria, lista, edita e apaga; valida a entrada", async () => {
    sessao.userId = A;
    expect(await criarLembreteAcao({}, dados())).toEqual({ ok: true });
    const [l] = await listarLembretes(A);
    expect(l).toMatchObject({ tipo: "refeicao", refeicao: "almoco", minuto: 720, dias: 127, ativo: true, silenciarFeito: true });

    expect((await criarLembreteAcao({}, dados())).erro).toMatch(/igual/);
    expect((await criarLembreteAcao({}, dados({ refeicao: "" }))).erro).toBeTruthy();
    expect((await criarLembreteAcao({}, dados({ min: "10" }))).erro).toBeTruthy();
    expect((await criarLembreteAcao({}, dados({ hora: "24" }))).erro).toBeTruthy();
    expect((await criarLembreteAcao({}, dados({ dias: [] }))).erro).toMatch(/dia/);
    expect((await criarLembreteAcao({}, dados({ tipo: "remedio" }))).erro).toBeTruthy();

    // água: refeição é ignorada; só segunda a sexta, sem "não avisar se já fiz", desligado
    const f = dados({ tipo: "agua", hora: "15", min: "30", dias: ["1", "2", "4", "8", "16"] });
    f.delete("silenciarFeito");
    f.delete("ativo");
    expect(await criarLembreteAcao({}, f)).toEqual({ ok: true });
    const aguaL = (await listarLembretes(A)).find((x) => x.tipo === "agua")!;
    expect(aguaL).toMatchObject({ refeicao: null, minuto: 930, dias: 31, silenciarFeito: false, ativo: false });

    expect(await atualizarLembreteAcao({}, dados({ id: l.id, hora: "13", min: "15" }))).toEqual({ ok: true });
    expect((await listarLembretes(A)).find((x) => x.id === l.id)!.minuto).toBe(795);

    await apagarLembreteAcao(form({ id: aguaL.id }));
    expect((await listarLembretes(A)).map((x) => x.id)).toEqual([l.id]);
  });

  it("outra pessoa não edita, adia, pausa nem apaga", async () => {
    const [l] = await listarLembretes(A);
    sessao.userId = B;
    expect((await atualizarLembreteAcao({}, dados({ id: l.id, hora: "6" }))).erro).toMatch(/não encontrado/);
    expect((await adiarLembreteAcao({}, form({ id: l.id }))).erro).toMatch(/não encontrado/);
    expect((await hojeNaoAcao({}, form({ id: l.id }))).erro).toMatch(/não encontrado/);
    await apagarLembreteAcao(form({ id: l.id }));
    sessao.userId = A;
    const [depois] = await listarLembretes(A);
    expect(depois).toMatchObject({ id: l.id, minuto: 795, pausadoAte: null, adiadoPara: null });
  });

  it("limite de 10 por pessoa", async () => {
    sessao.userId = B;
    for (let i = 0; i < 10; i++) expect(await criarLembreteAcao({}, dados({ hora: String(6 + i) }))).toEqual({ ok: true });
    expect((await criarLembreteAcao({}, dados({ hora: "20" }))).erro).toMatch(/10 lembretes/);
    await db.delete(lembretes).where(eq(lembretes.userId, B));
    sessao.userId = A;
  });

  it("pausar todos e retomar", async () => {
    await pausarTodosAcao(form({ dias: "3" }));
    expect((await listarLembretes(A))[0].pausadoAte).not.toBeNull();
    await pausarTodosAcao(form({ dias: "30" })); // fora das opções: ignorado
    await pausarTodosAcao(form({ retomar: "1" }));
    expect((await listarLembretes(A))[0].pausadoAte).toBeNull();
  });

  it("CHECKs do banco (inclusive NULL)", async () => {
    const v = { userId: A, minuto: 600 };
    await expect(db.insert(lembretes).values({ ...v, tipo: "refeicao", refeicao: null })).rejects.toThrow();
    await expect(db.insert(lembretes).values({ ...v, tipo: "agua", refeicao: "almoco" })).rejects.toThrow();
    await expect(db.insert(lembretes).values({ ...v, tipo: "remedio" })).rejects.toThrow();
    await expect(db.insert(lembretes).values({ userId: A, tipo: "agua", minuto: 610 })).rejects.toThrow();
    await expect(db.insert(lembretes).values({ userId: A, tipo: "agua", minuto: 1440 })).rejects.toThrow();
    await expect(db.insert(lembretes).values({ userId: A, tipo: "agua", minuto: 600, dias: 0 })).rejects.toThrow();
    await expect(db.insert(lembretes).values({ userId: A, tipo: "agua", minuto: 600, dias: 128 })).rejects.toThrow();
    await expect(db.insert(inscricoesPush).values({ userId: A, endpoint: "http://x", ...chaves })).rejects.toThrow();
  });

  it("tela mostra os lembretes e o aparelho", async () => {
    const h = await html();
    expect(h).toContain("Meus lembretes");
    expect(h).toContain("13:15");
    expect(h).toContain("Almoço");
    expect(h).toContain("Este aparelho");
  });
});

describe("inscrições de aparelho", () => {
  it("só aceita serviços de push conhecidos e chaves no formato certo", async () => {
    sessao.userId = A;
    expect((await salvarInscricaoAcao({ endpoint: "https://169.254.169.254/x", ...chaves })).erro).toBeTruthy();
    expect((await salvarInscricaoAcao({ endpoint: "https://web.push.apple.com.evil.com/x", ...chaves })).erro).toBeTruthy();
    expect((await salvarInscricaoAcao({ endpoint: endpoint(A), p256dh: "<script>", auth: chaves.auth })).erro).toBeTruthy();
    expect(await salvarInscricaoAcao({ endpoint: endpoint(A), ...chaves })).toEqual({ ok: true, inscrito: true });
  });

  it("aparelho que troca de conta passa para a conta nova; remover só a própria", async () => {
    const e = endpoint(B);
    expect(await salvarInscricao(A, { endpoint: e, ...chaves })).toBe("ok");
    expect(await salvarInscricao(B, { endpoint: e, ...chaves })).toBe("ok");
    const [r] = await db.select().from(inscricoesPush).where(eq(inscricoesPush.endpoint, e));
    expect(r.userId).toBe(B);
    sessao.userId = A;
    await removerInscricaoAcao(e);
    expect(await db.select().from(inscricoesPush).where(eq(inscricoesPush.endpoint, e))).toHaveLength(1);
    sessao.userId = B;
    await removerInscricaoAcao(e);
    expect(await db.select().from(inscricoesPush).where(eq(inscricoesPush.endpoint, e))).toHaveLength(0);
    sessao.userId = A;
  });

  it("até 5 aparelhos por pessoa", async () => {
    for (let i = 0; i < 5; i++) expect(await salvarInscricao(B, { endpoint: endpoint(B), ...chaves })).toBe("ok");
    expect(await salvarInscricao(B, { endpoint: endpoint(B), ...chaves })).toBe("limite");
    await db.delete(inscricoesPush).where(eq(inscricoesPush.userId, B));
  });
});

describe("envio pelo agendador", () => {
  let lembreteA: string;

  beforeAll(async () => {
    await db.delete(lembretes).where(inArray(lembretes.userId, [A, B, C]));
    await db.delete(inscricoesPush).where(inArray(inscricoesPush.userId, [A, B, C]));
    const [l] = await db.insert(lembretes).values({ userId: A, tipo: "peso", minuto: 720 }).returning({ id: lembretes.id });
    lembreteA = l.id;
    await db.insert(lembretes).values({ userId: C, tipo: "peso", minuto: 720 });
    for (const u of [A, C]) await salvarInscricao(u, { endpoint: endpoint(u), ...chaves });
    await salvarInscricao(A, { endpoint: endpoint(A), ...chaves }); // dois aparelhos
  });

  it("envia uma vez para cada aparelho da conta aprovada; nunca para conta pendente; não repete", async () => {
    const p = provedor();
    const r = await enviarLembretesDevidos(AGORA, p.enviar);
    expect(p.de(A)).toHaveLength(2);
    expect(p.de(C)).toHaveLength(0);
    expect(p.de(A)[0].carga).toEqual({ titulo: "Pesagem", corpo: "Se hoje é dia de pesar, registre o peso.", url: `/progresso/pesagem?lembrete=${lembreteA}`, tag: `lembrete-${lembreteA}` });
    expect(r.enviados).toBeGreaterThanOrEqual(1);
    const p2 = provedor();
    await enviarLembretesDevidos(new Date(AGORA.getTime() + 15 * 60_000), p2.enviar);
    expect(p2.de(A)).toHaveLength(0);
    expect(await db.select().from(lembretesEnvios).where(eq(lembretesEnvios.lembreteId, lembreteA))).toHaveLength(1);
  });

  it("duas execuções ao mesmo tempo enviam uma vez só", async () => {
    await db.delete(lembretesEnvios).where(eq(lembretesEnvios.lembreteId, lembreteA));
    const p = provedor();
    await Promise.all([enviarLembretesDevidos(AGORA, p.enviar), enviarLembretesDevidos(AGORA, p.enviar)]);
    expect(p.de(A)).toHaveLength(2); // dois aparelhos, um envio
  });

  it("não avisa se já fez (pesagem do dia); avisa se a opção está desligada", async () => {
    await db.delete(lembretesEnvios).where(eq(lembretesEnvios.lembreteId, lembreteA));
    await db.insert(pesagens).values({ userId: A, data: DIA, pesoKg: 80 });
    const p = provedor();
    const r = await enviarLembretesDevidos(AGORA, p.enviar);
    expect(p.de(A)).toHaveLength(0);
    expect(r.silenciados).toBeGreaterThanOrEqual(1);
    await db.update(lembretes).set({ silenciarFeito: false }).where(eq(lembretes.id, lembreteA));
    const p2 = provedor();
    await enviarLembretesDevidos(AGORA, p2.enviar);
    expect(p2.de(A)).toHaveLength(2);
    await db.update(lembretes).set({ silenciarFeito: true }).where(eq(lembretes.id, lembreteA));
    await db.delete(pesagens).where(eq(pesagens.userId, A));
  });

  it("água: silencia só com a meta do dia atingida", async () => {
    const [l] = await db.insert(lembretes).values({ userId: A, tipo: "agua", minuto: 705 }).returning({ id: lembretes.id });
    await db.insert(agua).values({ userId: A, data: DIA, ml: 1500 });
    const semMeta = provedor();
    await enviarLembretesDevidos(AGORA, semMeta.enviar);
    expect(semMeta.de(A).filter((e) => e.carga.tag === `lembrete-${l.id}`)).toHaveLength(2); // sem meta: avisa
    await db.delete(lembretesEnvios).where(eq(lembretesEnvios.lembreteId, l.id));
    await db.insert(metas).values({ userId: A, vigenteDesde: "2026-01-01", aguaMl: 1500 });
    const comMeta = provedor();
    await enviarLembretesDevidos(AGORA, comMeta.enviar);
    expect(comMeta.de(A).filter((e) => e.carga.tag === `lembrete-${l.id}`)).toHaveLength(0);
    await db.delete(lembretes).where(eq(lembretes.id, l.id));
  });

  it("respeita pausa do lembrete, pausa marcada (9A) e adiamento", async () => {
    await db.delete(lembretesEnvios).where(eq(lembretesEnvios.lembreteId, lembreteA));
    await db.update(lembretes).set({ pausadoAte: DIA }).where(eq(lembretes.id, lembreteA));
    const p1 = provedor();
    await enviarLembretesDevidos(AGORA, p1.enviar);
    expect(p1.de(A)).toHaveLength(0);
    await db.update(lembretes).set({ pausadoAte: null }).where(eq(lembretes.id, lembreteA));

    await db.insert(pausas).values({ userId: A, inicio: "2026-11-14", fim: DIA });
    const p2 = provedor();
    await enviarLembretesDevidos(AGORA, p2.enviar);
    expect(p2.de(A)).toHaveLength(0);
    await db.delete(pausas).where(eq(pausas.userId, A));

    // adiado para 12:35: vence às 12:40 mesmo com o horário normal já enviado
    await enviarLembretesDevidos(AGORA, provedor().enviar);
    const adiado = new Date("2026-11-16T12:35:00-03:00");
    await db.update(lembretes).set({ adiadoPara: adiado }).where(eq(lembretes.id, lembreteA));
    const p3 = provedor();
    await enviarLembretesDevidos(new Date("2026-11-16T12:40:00-03:00"), p3.enviar);
    expect(p3.de(A)).toHaveLength(2);
    const [depois] = await db.select().from(lembretes).where(eq(lembretes.id, lembreteA));
    expect(depois.adiadoPara).toBeNull();
  });

  it("inscrição expirada (410) é apagada", async () => {
    await db.delete(lembretesEnvios).where(eq(lembretesEnvios.lembreteId, lembreteA));
    const antes = await db.select().from(inscricoesPush).where(eq(inscricoesPush.userId, A));
    const expirada = antes[0].endpoint;
    const p = provedor((i) => (i.endpoint === expirada ? "expirada" : "ok"));
    const r = await enviarLembretesDevidos(AGORA, p.enviar);
    expect(r.expiradas).toBeGreaterThanOrEqual(1);
    const depois = await db.select().from(inscricoesPush).where(eq(inscricoesPush.userId, A));
    expect(depois.map((x) => x.endpoint)).toEqual(antes.map((x) => x.endpoint).filter((e) => e !== expirada));
  });
});

describe("rota do agendador", () => {
  const segredoAntes = process.env.CRON_SECRET;
  afterAll(() => {
    process.env.CRON_SECRET = segredoAntes;
  });
  const chamar = (auth?: string) => POST(new Request("http://localhost/api/lembretes/enviar", { method: "POST", headers: auth ? { authorization: auth } : {} }));

  it("sem segredo, segredo errado ou segredo curto no servidor: 401", async () => {
    process.env.CRON_SECRET = "s".repeat(48);
    expect((await chamar()).status).toBe(401);
    expect((await chamar("Bearer errado")).status).toBe(401);
    expect((await chamar(`Basic ${"s".repeat(48)}`)).status).toBe(401);
    process.env.CRON_SECRET = "curto";
    expect((await chamar("Bearer curto")).status).toBe(401);
  });

  it("segredo certo sem chaves VAPID: 503, sem detalhes", async () => {
    process.env.CRON_SECRET = "s".repeat(48);
    const vapid = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const r = await chamar(`Bearer ${"s".repeat(48)}`);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ erro: "nao_configurado" });
    expect(r.headers.get("cache-control")).toBe("no-store");
    if (vapid.pub) process.env.VAPID_PUBLIC_KEY = vapid.pub;
    if (vapid.priv) process.env.VAPID_PRIVATE_KEY = vapid.priv;
  });
});
