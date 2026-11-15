import { enviarLembretesDevidos } from "@/lib/lembretes-execucao";
import { registrarErro } from "@/lib/log";
import { configuracaoVapid, enviarPushReal } from "@/lib/push";
import { segredoConfere } from "@/lib/segredo-cron";

// Chamada pelo agendador (GitHub Actions, a cada 15 min). Só com "Authorization: Bearer CRON_SECRET", comparado
// em tempo constante. Sem cookie (sem CSRF). Resposta só com contagens, sem cache. O segredo nunca vai para log.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEM_CACHE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;
const json = (corpo: Record<string, unknown>, status: number) => Response.json(corpo, { status, headers: SEM_CACHE });

export async function POST(req: Request): Promise<Response> {
  if (!segredoConfere(req.headers.get("authorization"), process.env.CRON_SECRET)) return json({ erro: "nao_autorizado" }, 401);
  if (!configuracaoVapid()) return json({ erro: "nao_configurado" }, 503);
  try {
    const resumo = await enviarLembretesDevidos(new Date(), enviarPushReal);
    return json({ ok: true, ...resumo }, 200);
  } catch (e) {
    registrarErro("api_lembretes", e);
    return json({ erro: "falha" }, 500);
  }
}
