"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarContextoAcompanhamento, encerrarContextoAcompanhamento, exigirContextoDados } from "@/lib/auth/acompanhamento";
import { exigirAdmin } from "@/lib/auth/sessao";

export async function iniciarAcompanhamento(form: FormData): Promise<void> {
  await exigirAdmin();
  const contexto = await exigirContextoDados();
  if (form.get("contextoId") !== contexto.contextoId) throw new Error("A conta acompanhada mudou. Atualize a página antes de continuar.");
  const aluno = z.uuid().safeParse(form.get("alunoId"));
  if (!aluno.success) throw new Error("Aluno inválido. Atualize a página.");
  await criarContextoAcompanhamento(aluno.data);
  revalidatePath("/", "layout");
  redirect("/hoje");
}

export async function encerrarAcompanhamento(): Promise<void> {
  await encerrarContextoAcompanhamento();
  revalidatePath("/", "layout");
  redirect("/hoje");
}
