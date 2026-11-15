import "server-only";

import webpush from "web-push";

// Envio Web Push com as chaves VAPID das variáveis de ambiente (nunca no navegador, exceto a pública).
// O endpoint e as chaves da inscrição nunca vão para log.

export type InscricaoPush = { endpoint: string; p256dh: string; auth: string };
export type ResultadoPush = "ok" | "expirada" | "falha";
export type CargaPush = { titulo: string; corpo: string; url: string; tag: string };
export type EnviarPush = (inscricao: InscricaoPush, carga: CargaPush) => Promise<ResultadoPush>;

export function configuracaoVapid(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

/** Chave pública VAPID (pode ir para o navegador; é ela que o aparelho usa para se inscrever). */
export function chavePublicaVapid(): string | null {
  return configuracaoVapid()?.publicKey ?? null;
}

/** Envio real. 404/410 = a inscrição não existe mais (o aparelho desinstalou ou revogou). */
export const enviarPushReal: EnviarPush = async (inscricao, carga) => {
  const vapid = configuracaoVapid();
  if (!vapid) return "falha";
  try {
    await webpush.sendNotification(
      { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
      JSON.stringify({ titulo: carga.titulo, corpo: carga.corpo, url: carga.url, tag: carga.tag }),
      { vapidDetails: vapid, TTL: 3600, urgency: "normal", timeout: 10_000 },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return "expirada";
    return "falha";
  }
};
