"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirContaPropria } from "@/lib/auth/acompanhamento";
import { atualizarTutorial, obterTutorial } from "@/lib/dal/jornada";
import { registrarErro } from "@/lib/log";
import { IDS_PASSO, passosPara } from "@/lib/tutorial-inicial";

// Passeio pelo app: só na conta própria. O passo vem do formulário, mas só vale se estiver no roteiro da pessoa.
// Pular e concluir ficam guardados; nada é registrado nem premiado por assistir.

/** Começa (ou recomeça) o passeio no primeiro passo. */
export async function iniciarTutorialAcao(): Promise<void> {
  const { userId } = await exigirContaPropria();
  const { area } = await obterTutorial(userId);
  const primeiro = passosPara(area)[0];
  try {
    await atualizarTutorial(userId, { estado: "em_andamento", passo: primeiro.id as (typeof IDS_PASSO)[number] });
  } catch (e) {
    registrarErro("iniciarTutorial", e);
  }
  revalidatePath("/", "layout");
  redirect(primeiro.rota);
}

/** Vai para um passo do roteiro (próximo, anterior ou "continuar" depois de pausar). */
export async function irParaPassoAcao(form: FormData): Promise<void> {
  const { userId } = await exigirContaPropria();
  const id = z.enum(IDS_PASSO).safeParse(form.get("passo"));
  const { area } = await obterTutorial(userId);
  const passo = id.success ? passosPara(area).find((p) => p.id === id.data) : undefined;
  if (!passo) return;
  try {
    await atualizarTutorial(userId, { estado: "em_andamento", passo: passo.id as (typeof IDS_PASSO)[number] });
  } catch (e) {
    registrarErro("irParaPasso", e);
    return;
  }
  revalidatePath("/", "layout");
  redirect(passo.rota);
}

async function encerrar(estado: "pulado" | "concluido") {
  const { userId } = await exigirContaPropria();
  try {
    await atualizarTutorial(userId, { estado });
  } catch (e) {
    registrarErro("encerrarTutorial", e);
  }
  revalidatePath("/", "layout");
}

export async function pularTutorialAcao(): Promise<void> {
  await encerrar("pulado");
}

export async function concluirTutorialAcao(): Promise<void> {
  await encerrar("concluido");
}
