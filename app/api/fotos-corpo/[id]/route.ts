import { obterSessao } from "@/lib/auth/sessao";
import { exigirContextoDados } from "@/lib/auth/acompanhamento";
import { obterBytesFotoCorpo } from "@/lib/dal/fotos-corpo";
import { ehUuid } from "@/lib/dal/util";

// Entrega a foto de progresso só para o dono, com sessão. Sem URL pública nem assinada; sem cache
// compartilhado. Foto de outra pessoa, id inválido ou inexistente dão o mesmo 404.
export const dynamic = "force-dynamic";

const CABECALHOS = {
  "Content-Type": "image/jpeg",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Disposition": "inline",
} as const;

export async function GET(req: Request, ctx: RouteContext<"/api/fotos-corpo/[id]">): Promise<Response> {
  if (!(await obterSessao())) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const contexto = await exigirContextoDados();
  const { userId } = contexto;
  const { id } = await ctx.params;
  const naoAchou = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const marcador = new URL(req.url).searchParams.get("contextoId");
  if (!contexto.podeVerFotos || (marcador ?? "proprio") !== contexto.contextoId) return naoAchou();
  if (!ehUuid(id)) return naoAchou();
  const bytes = await obterBytesFotoCorpo(userId, id);
  if (!bytes) return naoAchou();
  return new Response(bytes as BodyInit, { status: 200, headers: CABECALHOS });
}
