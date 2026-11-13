import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  usuario: { userId: "admin", admin: { userId: "admin", __admin: true } } as { userId: string; admin: { userId: string; __admin: true } | null },
  contexto: null as null | Record<string, unknown>,
  set: vi.fn(), delete: vi.fn(), resolver: vi.fn(), criar: vi.fn(), encerrar: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocks.cookie === undefined ? undefined : { value: mocks.cookie }, set: mocks.set, delete: mocks.delete }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => mocks.usuario, obterVinculoSessao: async () => "sessao-hash" }));
vi.mock("@/lib/dal/acompanhamento", () => ({ obterContextoAcompanhamento: mocks.resolver, criarContexto: mocks.criar, encerrarContexto: mocks.encerrar }));
import { criarContextoAcompanhamento, encerrarContextoAcompanhamento, exigirContextoDados, exigirContaPropria, executarAcaoAcompanhada } from "@/lib/auth/acompanhamento";
import { obterExecucaoAcompanhada } from "@/lib/acompanhamento/execucao";

const id = "29c5e902-280f-4789-9278-cd95b2c1dbab";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie = undefined;
  mocks.usuario = { userId: "admin", admin: { userId: "admin", __admin: true } };
  mocks.contexto = { id, alunoId: "aluno", nome: "Nome", podeEditar: true, podeVerFotos: false, edicaoAte: new Date("2099-01-01Z") };
  mocks.resolver.mockImplementation(async () => mocks.contexto);
});

describe("identidade dos dados", () => {
  it("preserva a identidade real na conta própria", async () => {
    expect(await exigirContextoDados()).toMatchObject({ userId: "admin", atorId: "admin", titularId: "admin", contextoId: "proprio", modo: "proprio", podeEditar: true });
    expect(await exigirContaPropria()).toMatchObject(mocks.usuario);
  });
  it("resolve o titular com o vínculo da sessão e retira poder administrativo", async () => {
    mocks.cookie = id;
    expect(await exigirContextoDados()).toMatchObject({ userId: "aluno", atorId: "admin", titularId: "aluno", admin: null, podeVerFotos: false });
    expect(mocks.resolver).toHaveBeenCalledWith(id, "admin", "sessao-hash");
    await expect(exigirContaPropria()).rejects.toThrow();
  });
  it.each(["adulterado", ""])("recusa cookie inválido sem cair na conta própria: %s", async (cookie) => {
    mocks.cookie = cookie;
    await expect(exigirContextoDados()).rejects.toThrow("REDIRECT:/acompanhamento-expirado");
  });
  it("bloqueia contexto encerrado e administrador removido", async () => {
    mocks.cookie = id;
    mocks.contexto = null;
    await expect(exigirContextoDados()).rejects.toThrow();
    mocks.usuario.admin = null;
    await expect(exigirContextoDados()).rejects.toThrow();
  });
  it("recusa marcadores antigos ou ausentes antes de executar callback", async () => {
    mocks.cookie = id;
    const callback = vi.fn();
    await expect(executarAcaoAcompanhada("proprio", "editar", callback)).rejects.toThrow("REDIRECT:/hoje?acompanhamento=contexto");
    await expect(executarAcaoAcompanhada(undefined, "editar", callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });
  it("reutiliza contexto autenticado apenas dentro da ação e isola chamadas paralelas", async () => {
    mocks.cookie = id;
    await executarAcaoAcompanhada(id, "editar", async () => {
      expect(obterExecucaoAcompanhada()?.operacao).toBe("editar");
      expect((await exigirContextoDados()).titularId).toBe("aluno");
    });
    expect(mocks.resolver).toHaveBeenCalledTimes(1);
    expect(obterExecucaoAcompanhada()).toBeUndefined();
  });
  it("somente leitura não executa callback", async () => {
    mocks.cookie = id;
    mocks.contexto!.podeEditar = false;
    const callback = vi.fn();
    await expect(executarAcaoAcompanhada(id, "editar", callback)).rejects.toThrow("REDIRECT:/hoje?acompanhamento=leitura");
    expect(callback).not.toHaveBeenCalled();
  });
  it("cria cookie protegido e permite limpar contexto inválido", async () => {
    mocks.criar.mockResolvedValue({ id });
    expect(await criarContextoAcompanhamento("aluno")).toBe(id);
    expect(mocks.set).toHaveBeenCalledWith("kalyft_acompanhamento", id, expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200 }));
    mocks.cookie = "invalid";
    await encerrarContextoAcompanhamento();
    expect(mocks.delete).toHaveBeenCalledWith("kalyft_acompanhamento");
  });
});
