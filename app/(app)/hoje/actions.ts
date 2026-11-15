"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirContextoDados as exigirUsuario, executarAcaoAcompanhada } from "@/lib/auth/acompanhamento";
import { obterAlimento } from "@/lib/dal/alimentos";
import { marcarPausa, ultimaAtividade } from "@/lib/dal/pausas";
import { criarRegistros } from "@/lib/dal/registros";
import { ocultarDaRotina, reexibirNaRotina } from "@/lib/dal/rotina";
import { hojeSaoPaulo } from "@/lib/datas";
import { registrarErro } from "@/lib/log";
import { calcularNutrientes, GRAMAS_MAX, KCAL_MAX_ITEM } from "@/lib/nutricao";
import { detectarPausa, limitarPausa } from "@/lib/retomar";
import { refeicao, tipoAlimento } from "@/lib/validacao/comida";

// Server Actions públicas do Hoje: sessão, Zod, contexto de acompanhamento (leitura não grava) e nutrientes
// sempre recalculados do banco. A data é a de hoje no servidor; o cliente não escolhe o dia.

export type EstadoRotina = { ok?: string; erro?: string };

const FALHA = "Não foi possível salvar agora. Tente de novo.";
const gramas = z.coerce.number().finite().min(1).max(GRAMAS_MAX);
const itemSchema = z.object({ tipo: tipoAlimento, alimentoId: z.uuid(), refeicao });

export async function registrarDaRotina(_: EstadoRotina, form: FormData): Promise<EstadoRotina> {
  return executarAcaoAcompanhada(form.get("contextoId"), "registrarDaRotina", async () => {
    const { userId } = await exigirUsuario();
    const r = itemSchema.extend({ gramas }).safeParse({
      tipo: form.get("tipo"), alimentoId: form.get("alimentoId"), refeicao: form.get("refeicao"), gramas: form.get("gramas"),
    });
    if (!r.success) return { erro: "Confira a porção e tente de novo." };
    const { tipo, alimentoId, gramas: g } = r.data;
    try {
      const alimento = await obterAlimento(userId, tipo, alimentoId);
      if (!alimento) return { erro: "Este alimento não está mais disponível." };
      const nutrientes = calcularNutrientes(alimento, g);
      if (!nutrientes) return { erro: "Este alimento está sem calorias na tabela e não pode ser registrado." };
      if (nutrientes.kcal > KCAL_MAX_ITEM) return { erro: "Quantidade grande demais para um item." };
      const nome = alimento.marca ? `${alimento.nome} (${alimento.marca})` : alimento.nome;
      await criarRegistros(userId, [{ data: hojeSaoPaulo(), refeicao: r.data.refeicao, tipo, alimentoId, nome, gramas: g, medidaTexto: null, nutrientes }]);
      revalidatePath("/hoje");
      revalidatePath("/comida");
      return { ok: `${nome} registrado.` };
    } catch (e) {
      registrarErro("registrarDaRotina", e);
      return { erro: FALHA };
    }
  });
}

export async function ocultarDaRotinaAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "ocultarDaRotina", async () => {
    const { userId } = await exigirUsuario();
    const r = itemSchema.safeParse({ tipo: form.get("tipo"), alimentoId: form.get("alimentoId"), refeicao: form.get("refeicao") });
    if (!r.success) return;
    try {
      await ocultarDaRotina(userId, r.data.refeicao, r.data.tipo, r.data.alimentoId);
    } catch (e) {
      registrarErro("ocultarDaRotina", e);
    }
    revalidatePath("/hoje");
    revalidatePath("/comida/meus-alimentos");
  });
}

export async function reexibirNaRotinaAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "reexibirNaRotina", async () => {
    const { userId } = await exigirUsuario();
    const id = z.uuid().safeParse(form.get("id"));
    if (!id.success) return;
    try {
      await reexibirNaRotina(userId, id.data);
    } catch (e) {
      registrarErro("reexibirNaRotina", e);
    }
    revalidatePath("/hoje");
    revalidatePath("/comida/meus-alimentos");
  });
}

/** Marca a pausa atual. O período é recalculado no servidor a partir da última atividade (o cliente não manda datas). */
export async function marcarPausaAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "marcarPausa", async () => {
    const { userId } = await exigirUsuario();
    const hoje = hojeSaoPaulo();
    try {
      const ultima = await ultimaAtividade(userId, hoje);
      const pausa = detectarPausa(ultima ? [ultima] : [], hoje);
      if (!pausa) return;
      const p = limitarPausa(pausa);
      await marcarPausa(userId, p.inicio, p.fim);
    } catch (e) {
      registrarErro("marcarPausa", e);
    }
    revalidatePath("/hoje");
    revalidatePath("/treino/calendario");
  });
}
