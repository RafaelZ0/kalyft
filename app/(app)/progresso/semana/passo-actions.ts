"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirContextoDados as exigirUsuario, executarAcaoAcompanhada } from "@/lib/auth/acompanhamento";
import { gravarPassoSemana, removerPassoSemana } from "@/lib/dal/passos-semana";
import { hojeSaoPaulo } from "@/lib/datas";
import { registrarErro } from "@/lib/log";
import { inicioDaSemana } from "@/lib/progresso-graficos";
import { TEXTO_LIVRE_MAX, TIPOS_PASSO, type Passo } from "@/lib/proximo-passo";
import { semanaSeguinte } from "@/lib/relatorio";
import { refeicao as refeicaoSchema } from "@/lib/validacao/comida";

// Server Actions públicas: sessão, Zod, contexto de acompanhamento. A semana é calculada no servidor ("atual" ou
// "próxima"); o cliente não escolhe datas. Coerência do passo também garantida por CHECK no banco.

export type EstadoPasso = { erro?: string; ok?: string };

const semanaSchema = z.enum(["atual", "proxima"]);
const medivelSchema = z.object({
  tipo: z.enum(TIPOS_PASSO.filter((t) => t !== "livre") as [Exclude<Passo["tipo"], "livre">, ...Exclude<Passo["tipo"], "livre">[]]),
  alvo: z.coerce.number().int().min(1).max(7),
  refeicao: z.union([z.literal(""), refeicaoSchema]),
});
const limpar = (t: string) => t.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

function inicioPedido(semana: "atual" | "proxima"): string {
  const atual = inicioDaSemana(hojeSaoPaulo());
  return semana === "atual" ? atual : semanaSeguinte(atual);
}

export async function escolherPassoSemana(_: EstadoPasso, form: FormData): Promise<EstadoPasso> {
  return executarAcaoAcompanhada(form.get("contextoId"), "escolherPassoSemana", async () => {
    const { userId } = await exigirUsuario();
    const semana = semanaSchema.safeParse(form.get("semana"));
    if (!semana.success) return { erro: "Semana inválida." };
    let passo: Passo;
    const escolha = form.get("escolha");
    if (escolha === "livre") {
      const texto = limpar(String(form.get("texto") ?? ""));
      if (texto.length < 3 || texto.length > TEXTO_LIVRE_MAX) return { erro: `Escreva o passo em 3 a ${TEXTO_LIVRE_MAX} caracteres.` };
      passo = { tipo: "livre", alvo: null, refeicao: null, texto };
    } else {
      // a sugestão escolhida chega como "tipo|alvo|refeicao"
      const [tipo, alvo, refeicao] = typeof escolha === "string" ? escolha.split("|") : [];
      const r = medivelSchema.safeParse({ tipo, alvo, refeicao: refeicao ?? "" });
      if (!r.success) return { erro: "Escolha um dos passos sugeridos ou escreva o seu." };
      if ((r.data.tipo === "refeicao_dias") !== (r.data.refeicao !== "")) return { erro: "Passo inválido." };
      passo = { tipo: r.data.tipo, alvo: r.data.alvo, refeicao: r.data.refeicao === "" ? null : r.data.refeicao, texto: null };
    }
    try {
      await gravarPassoSemana(userId, inicioPedido(semana.data), passo);
    } catch (e) {
      registrarErro("escolherPassoSemana", e);
      return { erro: "Não foi possível salvar agora. Tente de novo." };
    }
    revalidatePath("/progresso/semana");
    return { ok: "Passo escolhido." };
  });
}

export async function removerPassoSemanaAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "removerPassoSemana", async () => {
    const { userId } = await exigirUsuario();
    const semana = semanaSchema.safeParse(form.get("semana"));
    if (!semana.success) return;
    try {
      await removerPassoSemana(userId, inicioPedido(semana.data));
    } catch (e) {
      registrarErro("removerPassoSemana", e);
    }
    revalidatePath("/progresso/semana");
  });
}
