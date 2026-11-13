"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirContaPropria as exigirUsuario } from "@/lib/auth/acompanhamento";
import { excluirFotoCorpo, inserirFotoCorpo } from "@/lib/dal/fotos-corpo";
import { ehUuid } from "@/lib/dal/util";
import { hojeSaoPaulo } from "@/lib/datas";
import { LIMITES_FOTO_CORPO, POSICOES, validarFotoCorpo } from "@/lib/foto-corpo";
import { registrarErro } from "@/lib/log";

// Server Actions públicas: sessão, Zod, JPEG conferido pelos bytes (e metadados removidos de novo aqui),
// limite de 60 aplicado no banco e exclusão só da própria foto. A foto nunca vai para a IA.

export type EstadoFoto = { erro?: string; ok?: boolean };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esquema = z.object({
  data: z.string().regex(ISO).refine((d) => d >= "2000-01-01" && !Number.isNaN(Date.parse(d)), "Data inválida."),
  posicao: z.enum(POSICOES),
  nota: z.string().max(400).optional(),
});

export async function enviarFotoCorpo(_: EstadoFoto, form: FormData): Promise<EstadoFoto> {
  const { userId } = await exigirUsuario();
  const dados = esquema.safeParse({ data: form.get("data"), posicao: form.get("posicao"), nota: form.get("nota") ?? undefined });
  if (!dados.success) return { erro: "Confira a data e a posição da foto." };
  if (dados.data.data > hojeSaoPaulo()) return { erro: "A data da foto não pode ser no futuro." };
  const nota = (dados.data.nota ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, LIMITES_FOTO_CORPO.notaMax);

  const arquivo = form.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha uma foto." };
  if (arquivo.size > LIMITES_FOTO_CORPO.bytesMax * 2) return { erro: "A foto é grande demais." };
  const v = validarFotoCorpo(new Uint8Array(await arquivo.arrayBuffer()));
  if (!v.ok) return { erro: v.erro };

  try {
    const id = await inserirFotoCorpo(userId, { data: dados.data.data, posicao: dados.data.posicao, nota: nota || null, bytes: v.jpeg.bytes });
    if (!id) return { erro: `Você já tem ${LIMITES_FOTO_CORPO.maximo} fotos, que é o limite. Exclua alguma antiga para enviar outra.` };
  } catch (e) {
    registrarErro("fotos-corpo:inserir", e);
    return { erro: "Não consegui salvar a foto. Tente de novo." };
  }
  revalidatePath("/progresso/fotos");
  return { ok: true };
}

export async function excluirFotoCorpoAcao(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = form.get("id");
  if (typeof id === "string" && ehUuid(id)) await excluirFotoCorpo(userId, id);
  revalidatePath("/progresso/fotos");
}
