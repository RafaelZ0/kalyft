import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessionId: "session-id-1", desde: null as Date | null, getSession: vi.fn() }));
vi.mock("react", () => ({ cache: <T>(funcao: T) => funcao }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, unstable_rethrow: () => undefined }));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: mocks.getSession } }));
vi.mock("@/lib/dal/acessos", () => ({ sessoesValidasDesde: async () => mocks.desde, registrarAcesso: async () => ({ status: "aprovado" }) }));
vi.mock("@/lib/dal/perfil", () => ({ garantirPerfil: async () => undefined }));
vi.mock("@/lib/log", () => ({ registrarErro: vi.fn() }));

import { exigirUsuario, obterSessao, obterVinculoSessao } from "@/lib/auth/sessao";

beforeEach(() => {
  mocks.sessionId = "session-id-1";
  mocks.desde = null;
  mocks.getSession.mockImplementation(async () => ({ data: { user: { id: "ator", email: "teste@exemplo.com", emailVerified: true }, session: { id: mocks.sessionId, token: "token-secreto-nao-persistido", createdAt: new Date("2026-11-13T12:00:00Z") } } }));
});

describe("vínculo não reversível da sessão validada", () => {
  it("mantém a identidade pública e usa somente o id da sessão para vínculo", async () => {
    expect(await obterSessao()).toEqual({ id: "ator", email: "teste@exemplo.com", emailVerificado: true });
    expect((await exigirUsuario()).userId).toBe("ator");
    const hash = await obterVinculoSessao();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("token");
    mocks.sessionId = "session-id-2";
    expect(await obterVinculoSessao()).not.toBe(hash);
  });
  it("invalidação por troca de senha também impede obter vínculo", async () => {
    mocks.desde = new Date("2026-11-13T13:00:00Z");
    expect(await obterSessao()).toBeNull();
    await expect(obterVinculoSessao()).rejects.toThrow("REDIRECT:/entrar");
  });
  it("sessão sem identificador não é autenticada", async () => {
    mocks.sessionId = "";
    expect(await obterSessao()).toBeNull();
  });
});
