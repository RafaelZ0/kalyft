"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirContextoDados as exigirUsuario, executarAcaoAcompanhada } from "@/lib/auth/acompanhamento";
import { gravarAdaptacao, removerAdaptacao } from "@/lib/dal/adaptacoes";
import { planoAtivo } from "@/lib/dal/treino";
import { carregarTreinoDoDia } from "@/lib/dal/treino-do-dia";
import { registrarErro } from "@/lib/log";
import { ehAdaptado, MINUTOS_OPCOES, validarAdaptacao } from "@/lib/treino-adaptado";
import { dataAteHoje } from "@/lib/validacao/treino";

// Server Actions públicas: sessão, Zod, contexto de acompanhamento. A adaptação enviada pelo cliente é conferida
// contra o treino real do dia (itens, séries previstas, alternativas válidas) antes de gravar. O plano não muda.

export type EstadoAdaptar = { erro?: string };

const ajusteSchema = z.object({
  itemId: z.uuid(),
  series: z.number().int().min(1).max(20),
  pular: z.boolean(),
  exercicioId: z.uuid().nullable(),
});
const itensSchema = z.array(ajusteSchema).min(1).max(60);
const minutosSchema = z.union([z.literal(""), z.coerce.number().refine((m) => (MINUTOS_OPCOES as readonly number[]).includes(m))]);

function lerItens(bruto: FormDataEntryValue | null): z.infer<typeof itensSchema> | null {
  if (typeof bruto !== "string" || bruto.length > 20_000) return null;
  try {
    const r = itensSchema.safeParse(JSON.parse(bruto));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function salvarAdaptacao(_: EstadoAdaptar, form: FormData): Promise<EstadoAdaptar> {
  return executarAcaoAcompanhada(form.get("contextoId"), "salvarAdaptacao", async () => {
    const { userId } = await exigirUsuario();
    const data = dataAteHoje.safeParse(form.get("data"));
    const minutos = minutosSchema.safeParse(form.get("minutos") ?? "");
    const itens = lerItens(form.get("itens"));
    if (!data.success || !minutos.success || !itens) return { erro: "Não foi possível ler a adaptação. Atualize a página e tente de novo." };
    let destino: string;
    try {
      const plano = await planoAtivo(userId);
      if (!plano) return { erro: "Você ainda não tem um plano de treino." };
      const dia = await carregarTreinoDoDia(userId, plano, data.data);
      if (!dia) return { erro: "Não há treino neste dia." };
      const validos = validarAdaptacao(dia.completos, itens, dia.exercicios);
      if (!validos) return { erro: "A adaptação não bate com o treino de hoje (talvez o plano tenha mudado). Atualize a página." };
      if (ehAdaptado(dia.completos, validos)) {
        await gravarAdaptacao(userId, data.data, dia.treino.id, minutos.data === "" ? null : minutos.data, validos);
      } else {
        await removerAdaptacao(userId, data.data);
      }
      destino = `/treino?data=${data.data}`;
    } catch (e) {
      registrarErro("salvarAdaptacao", e);
      return { erro: "Não foi possível salvar agora. Tente de novo." };
    }
    revalidatePath("/treino", "layout");
    revalidatePath("/hoje");
    redirect(destino);
  });
}

export async function removerAdaptacaoAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "removerAdaptacao", async () => {
    const { userId } = await exigirUsuario();
    const data = dataAteHoje.safeParse(form.get("data"));
    if (!data.success) return;
    try {
      await removerAdaptacao(userId, data.data);
    } catch (e) {
      registrarErro("removerAdaptacao", e);
    }
    revalidatePath("/treino", "layout");
    revalidatePath("/hoje");
  });
}
