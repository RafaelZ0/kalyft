import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const hash = (v: string) => createHash("sha256").update(v, "utf8").digest();

/** Confere "Authorization: Bearer <segredo>" em tempo constante. Segredo ausente ou curto (< 32) nunca confere. */
export function segredoConfere(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || segredo.length < 32 || !cabecalho) return false;
  const m = /^Bearer (\S+)$/.exec(cabecalho.trim());
  if (!m) return false;
  return timingSafeEqual(hash(m[1]), hash(segredo));
}
