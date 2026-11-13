import { beforeEach, expect, it, vi } from "vitest";
const estado = vi.hoisted(() => ({ logado: true, fotos: false, contextoId: "ctx-a", bytes: vi.fn(async () => new Uint8Array([255,216,255,217])) }));
vi.mock("@/lib/auth/sessao", () => ({
  obterSessao: async () => estado.logado ? { id: "admin" } : null,
  exigirUsuario: async () => ({ userId: "aluno" }),
}));
vi.mock("@/lib/auth/acompanhamento", () => ({
  exigirContextoDados: async () => ({ userId: "aluno", modo: "acompanhamento", podeVerFotos: estado.fotos, contextoId: estado.contextoId }),
}));
vi.mock("@/lib/dal/fotos-corpo", () => ({ obterBytesFotoCorpo: estado.bytes }));
import { GET } from "@/app/api/fotos-corpo/[id]/route";
const id="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const get=(ctx="ctx-a")=>GET(new Request(`https://kalyft.vercel.app/api/fotos-corpo/${id}?contextoId=${ctx}`),{params:Promise.resolve({id})} as never);
beforeEach(()=>{estado.logado=true;estado.fotos=false;estado.contextoId="ctx-a";estado.bytes.mockClear();});
it("não entrega bytes sem autorização independente", async()=>{
  expect((await get()).status).toBe(404); expect(estado.bytes).not.toHaveBeenCalled();
});
it("recusa imagem de uma aba com contexto antigo",async()=>{
  estado.fotos=true; expect((await get("ctx-b")).status).toBe(404); expect(estado.bytes).not.toHaveBeenCalled();
});
it("entrega imagem autorizada sem cache compartilhado",async()=>{
  estado.fotos=true; const res=await get(); expect(res.status).toBe(200); expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  expect(estado.bytes).toHaveBeenCalledWith("aluno",id);
});
it("reavalia a permissão após revogação",async()=>{
  estado.fotos=true; expect((await get()).status).toBe(200);
  estado.fotos=false; expect((await get()).status).toBe(404);
});
it("recusa acesso sem sessão",async()=>{estado.logado=false;expect((await get()).status).toBe(401);});
