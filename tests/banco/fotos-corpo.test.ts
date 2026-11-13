// Simula uma requisição pessoal; mantém o resolvedor real de acompanhamento.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const sessao = { userId: A, admin: null };
let logado = true;

vi.mock("@/lib/auth/sessao", () => ({
  exigirUsuario: async () => sessao,
  obterSessao: async () => (logado ? { id: sessao.userId, email: "a@teste.local", emailVerificado: true } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { db } from "@/lib/db";
import { fotosCorpo, perfis } from "@/lib/db/schema";
import { contarFotosCorpo, excluirFotoCorpo, fotosDoUsuario, inserirFotoCorpo, listarFotosCorpo, obterBytesFotoCorpo } from "@/lib/dal/fotos-corpo";
import { garantirPerfil } from "@/lib/dal/perfil";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { enviarFotoCorpo, excluirFotoCorpoAcao } from "@/app/(app)/progresso/fotos/actions";
import { GET } from "@/app/api/fotos-corpo/[id]/route";

const u8 = (...n: number[]) => Uint8Array.from(n);
const concat = (...p: Uint8Array[]) => {
  const o = new Uint8Array(p.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const x of p) {
    o.set(x, i);
    i += x.length;
  }
  return o;
};
const texto = (s: string) => new TextEncoder().encode(s);
const seg = (m: number, d: Uint8Array) => concat(u8(0xff, m, (d.length + 2) >> 8, (d.length + 2) & 0xff), d);
/** JPEG sintético (estrutura válida) com EXIF/GPS opcional. */
function jpeg(opcoes: { exif?: boolean; dados?: number } = {}) {
  const exif = opcoes.exif ? [seg(0xe1, texto("Exif\0\0GPSLatitude -23.55 Apple iPhone"))] : [];
  const sof = seg(0xc0, u8(8, 1440 >> 8, 1440 & 0xff, 1080 >> 8, 1080 & 0xff, 1, 1, 0x11, 0));
  const sos = seg(0xda, u8(1, 1, 0, 0, 63, 0));
  const dados = Uint8Array.from({ length: opcoes.dados ?? 5000 }, (_, i) => (i * 7 + 3) & 0x7f);
  return concat(u8(0xff, 0xd8), seg(0xe0, texto("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")), ...exif, sof, sos, dados, u8(0xff, 0xd9));
}
const form = (campos: Record<string, string | File>) => {
  const f = new FormData(); f.set("contextoId", "proprio");
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};
const arquivo = (b: Uint8Array, nome = "foto.jpg") => new File([b as BlobPart], nome, { type: "image/jpeg" });
const HOJE = hojeSaoPaulo();
const tem = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));
const chamarRota = (id: string) => GET(new Request("http://localhost/api/fotos-corpo/" + id), { params: Promise.resolve({ id }) } as never);

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
}, 120_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

describe("envio da foto (Server Action)", () => {
  it("grava só o JPEG limpo: sem EXIF, GPS ou câmera nos bytes do banco", async () => {
    const r = await enviarFotoCorpo({}, form({ foto: arquivo(jpeg({ exif: true })), data: HOJE, posicao: "frente", nota: "  primeira   foto \n" }));
    expect(r).toEqual({ ok: true });
    const [linha] = await listarFotosCorpo(A);
    expect(linha).toMatchObject({ data: HOJE, posicao: "frente", nota: "primeira foto" });
    const bytes = (await obterBytesFotoCorpo(A, linha.id))!;
    for (const proibido of ["Exif", "GPSLatitude", "iPhone"]) expect(tem(bytes, proibido)).toBe(false);
    expect(bytes[0]).toBe(0xff);
    expect(bytes.length).toBe(linha.tamanho);
  });
  it("recusa PNG, texto, data futura, posição inválida e foto ausente", async () => {
    const png = new File([u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(2000).fill(1)) as BlobPart], "x.png", { type: "image/png" });
    expect((await enviarFotoCorpo({}, form({ foto: png, data: HOJE, posicao: "lado" }))).erro).toMatch(/JPEG/);
    expect((await enviarFotoCorpo({}, form({ foto: new File(["<script>"], "x.jpg", { type: "image/jpeg" }), data: HOJE, posicao: "lado" }))).erro).toBeDefined();
    expect((await enviarFotoCorpo({}, form({ foto: arquivo(jpeg()), data: somarDias(HOJE, 3), posicao: "lado" }))).erro).toMatch(/futuro/);
    expect((await enviarFotoCorpo({}, form({ foto: arquivo(jpeg()), data: HOJE, posicao: "cabeça" }))).erro).toBeDefined();
    expect((await enviarFotoCorpo({}, form({ data: HOJE, posicao: "lado" }))).erro).toBeDefined();
    expect((await enviarFotoCorpo({}, form({ foto: arquivo(jpeg()), data: "1999-01-01", posicao: "lado" }))).erro).toBeDefined();
    expect(await contarFotosCorpo(A)).toBe(1);
  });
});

describe("isolamento", () => {
  it("outra pessoa não vê, não baixa, não apaga e não compara a foto", async () => {
    const [foto] = await listarFotosCorpo(A);
    expect(await listarFotosCorpo(B)).toEqual([]);
    expect(await obterBytesFotoCorpo(B, foto.id)).toBeNull();
    expect(await fotosDoUsuario(B, [foto.id])).toEqual([]);
    expect(await excluirFotoCorpo(B, foto.id)).toBe(false);
    expect(await contarFotosCorpo(A)).toBe(1);
  });
  it("a rota entrega ao dono com cabeçalhos seguros, e dá 404 para outro, id inválido ou inexistente", async () => {
    const [foto] = await listarFotosCorpo(A);
    const ok = await chamarRota(foto.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/jpeg");
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect((await ok.arrayBuffer()).byteLength).toBe(foto.tamanho);
    expect((await chamarRota(randomUUID())).status).toBe(404);
    expect((await chamarRota("../../etc/passwd")).status).toBe(404);
    expect((await chamarRota("1 or 1=1")).status).toBe(404);
    sessao.userId = B;
    expect((await chamarRota(foto.id)).status).toBe(404);
    sessao.userId = A;
    logado = false;
    expect((await chamarRota(foto.id)).status).toBe(401);
    logado = true;
  });
  it("o banco recusa foto com dono que não existe e valores fora das regras", async () => {
    const base = { id: randomUUID(), data: HOJE, posicao: "frente", tamanho: 2000, bytes: sql`decode(repeat('ab', 2000), 'hex')` };
    const inserir = (extra: Record<string, unknown>) => db.execute(sql`insert into fotos_corpo (id, user_id, data, posicao, nota, bytes, tamanho) values (${base.id}::uuid, ${(extra.user ?? A) as string}::uuid, ${(extra.data ?? base.data) as string}::date, ${(extra.posicao ?? base.posicao) as string}, ${(extra.nota ?? null) as string | null}, ${base.bytes}, ${(extra.tamanho ?? base.tamanho) as number})`);
    await expect(inserir({ user: randomUUID() })).rejects.toThrow();
    await expect(inserir({ posicao: "perfil" })).rejects.toThrow();
    await expect(inserir({ data: "1990-01-01" })).rejects.toThrow();
    await expect(inserir({ nota: "x".repeat(201) })).rejects.toThrow();
    await expect(inserir({ tamanho: 1999 })).rejects.toThrow(); // não bate com o tamanho real
    await expect(inserir({ tamanho: 10 })).rejects.toThrow();
  });
});

describe("limite de 60 fotos por pessoa", () => {
  it("o 61º envio é recusado com mensagem clara", async () => {
    await db.execute(sql`
      insert into fotos_corpo (user_id, data, posicao, bytes, tamanho)
      select ${B}::uuid, date '2025-01-01' + g, 'frente', decode(repeat('ab', 2000), 'hex'), 2000 from generate_series(1, 60) g
    `);
    expect(await contarFotosCorpo(B)).toBe(60);
    sessao.userId = B;
    const r = await enviarFotoCorpo({}, form({ foto: arquivo(jpeg()), data: HOJE, posicao: "costas" }));
    expect(r.erro).toMatch(/limite/);
    expect(await contarFotosCorpo(B)).toBe(60);
    sessao.userId = A;
  });
  it("envios simultâneos não passam do limite (trava por usuário)", async () => {
    await db.delete(fotosCorpo).where(eq(fotosCorpo.userId, B));
    await db.execute(sql`
      insert into fotos_corpo (user_id, data, posicao, bytes, tamanho)
      select ${B}::uuid, date '2025-01-01' + g, 'frente', decode(repeat('ab', 2000), 'hex'), 2000 from generate_series(1, 57) g
    `);
    const nova = { data: HOJE, posicao: "lado" as const, nota: null, bytes: jpeg() };
    const ids = await Promise.all(Array.from({ length: 8 }, () => inserirFotoCorpo(B, nova)));
    expect(ids.filter(Boolean)).toHaveLength(3);
    expect(await contarFotosCorpo(B)).toBe(60);
  });
  it("o limite de uma pessoa não afeta a outra", async () => {
    expect(await inserirFotoCorpo(A, { data: HOJE, posicao: "costas", nota: null, bytes: jpeg() })).not.toBeNull();
  });
});

describe("exclusão", () => {
  it("apaga só a própria foto; excluir id de outra pessoa ou inválido não faz nada", async () => {
    const antes = await contarFotosCorpo(A);
    const [deB] = await listarFotosCorpo(B);
    await excluirFotoCorpoAcao(form({ id: deB.id })); // sessão é A
    await excluirFotoCorpoAcao(form({ id: "não-é-uuid" }));
    expect(await contarFotosCorpo(B)).toBe(60);
    const [minha] = await listarFotosCorpo(A);
    await excluirFotoCorpoAcao(form({ id: minha.id }));
    expect(await contarFotosCorpo(A)).toBe(antes - 1);
    expect(await obterBytesFotoCorpo(A, minha.id)).toBeNull();
  });
  it("apagar o perfil leva as fotos junto", async () => {
    await db.delete(perfis).where(eq(perfis.userId, B));
    expect(await contarFotosCorpo(B)).toBe(0);
  });
});
