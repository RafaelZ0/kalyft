import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { Administrador } from "@/lib/dal/acessos";

export type ContextoDados = {
  userId: string;
  atorId: string;
  titularId: string;
  contextoId: string;
  modo: "proprio" | "acompanhamento";
  podeEditar: boolean;
  podeVerFotos: boolean;
  edicaoAte: Date | null;
  nome: string;
  admin: Administrador | null;
};

export type ExecucaoAcompanhada = { contexto: ContextoDados; sessaoHash: string; operacao: string };
const execucoes = new AsyncLocalStorage<ExecucaoAcompanhada>();

export function obterExecucaoAcompanhada(): ExecucaoAcompanhada | undefined {
  return execucoes.getStore();
}

/** O resolvedor autenticado chama isto somente depois de conferir o marcador. */
export function executarNoContexto<T>(contexto: ContextoDados, sessaoHash: string, operacao: string, executar: () => T): T {
  return execucoes.run({ contexto, sessaoHash, operacao }, executar);
}
