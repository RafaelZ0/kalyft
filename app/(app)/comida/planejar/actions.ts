"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirContextoDados as exigirUsuario, executarAcaoAcompanhada } from "@/lib/auth/acompanhamento";
import { obterAlimento } from "@/lib/dal/alimentos";
import {
  adicionarAvulso,
  adicionarPlanejado,
  alternarAvulso,
  alternarCompradoChave,
  desmarcarConsumido,
  marcarConsumido,
  obterPlanejado,
  removerAvulso,
  removerPlanejado,
  repetirSemana,
} from "@/lib/dal/planejamento";
import { obterReceita } from "@/lib/dal/receitas";
import { itensDaRefeicaoSalva } from "@/lib/dal/refeicoes-salvas";
import { criarRegistros, type NovoRegistro } from "@/lib/dal/registros";
import { hojeSaoPaulo } from "@/lib/datas";
import { registrarErro } from "@/lib/log";
import { calcularNutrientes, KCAL_MAX_ITEM } from "@/lib/nutricao";
import { dataPlanejavel, gramasPorPorcao, LIMITES_PLANO, semanaDoPlanejamento, TIPOS_PLANEJADO } from "@/lib/planejamento";
import { refeicao as refeicaoSchema, tipoAlimento } from "@/lib/validacao/comida";

// Server Actions públicas: sessão, Zod, contexto de acompanhamento. Planejado nunca vira consumido sozinho:
// "Comi isso" recalcula os nutrientes do banco e cria o registro; a marcação impede registrar duas vezes.

export type EstadoPlanejar = { erro?: string; ok?: string };
const FALHA = "Não foi possível salvar agora. Tente de novo.";
const limparTexto = (t: string) => t.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

const planejarSchema = z.object({
  data: z.string(),
  refeicao: refeicaoSchema,
  tipo: z.enum(TIPOS_PLANEJADO),
  referenciaId: z.uuid(),
  tipoAlimento: z.union([z.literal(""), tipoAlimento]),
  quantidade: z.coerce.number().finite(),
});

export async function planejarItem(_: EstadoPlanejar, form: FormData): Promise<EstadoPlanejar> {
  return executarAcaoAcompanhada(form.get("contextoId"), "planejarItem", async () => {
    const { userId } = await exigirUsuario();
    const r = planejarSchema.safeParse({
      data: form.get("data"), refeicao: form.get("refeicao"), tipo: form.get("tipo"), referenciaId: form.get("referenciaId"),
      tipoAlimento: form.get("tipoAlimento") ?? "", quantidade: form.get("quantidade"),
    });
    if (!r.success || !dataPlanejavel(r.data.data, hojeSaoPaulo())) return { erro: "Confira o dia, a refeição e o item." };
    const { tipo, quantidade } = r.data;
    const L = LIMITES_PLANO;
    const faixa = tipo === "alimento" ? [L.gramasMin, L.gramasMax] : [L.porcoesMin, L.porcoesMax];
    if (quantidade < faixa[0] || quantidade > faixa[1]) return { erro: tipo === "alimento" ? "Gramas de 1 a 5.000." : "Porções de 0,5 a 10." };
    if (tipo === "alimento" && r.data.tipoAlimento === "") return { erro: "Alimento inválido." };
    try {
      const id = await adicionarPlanejado(userId, {
        data: r.data.data, refeicao: r.data.refeicao, tipo, referenciaId: r.data.referenciaId,
        tipoAlimento: r.data.tipoAlimento === "" ? undefined : r.data.tipoAlimento, quantidade: Math.round(quantidade * 10) / 10,
      });
      if (!id) return { erro: `Essa refeição já tem ${L.itensPorRefeicao} itens planejados.` };
    } catch (e) {
      registrarErro("planejarItem", e); // inclui receita/alimento de outra pessoa (o banco recusa pela chave composta)
      return { erro: "Este item não está disponível." };
    }
    revalidatePath("/comida/planejar", "layout");
    redirect(`/comida/planejar?semana=${semanaDoPlanejamento(r.data.data, hojeSaoPaulo())}#dia-${r.data.data}`);
  });
}

export async function removerPlanejadoAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "removerPlanejado", async () => {
    const { userId } = await exigirUsuario();
    const id = z.uuid().safeParse(form.get("id"));
    if (!id.success) return;
    try {
      await removerPlanejado(userId, id.data);
    } catch (e) {
      registrarErro("removerPlanejado", e);
    }
    revalidatePath("/comida", "layout");
  });
}

/** "Comi isso": cria os registros no dia planejado, com nutrientes recalculados do banco, e marca como consumido. */
export async function comiIsso(_: EstadoPlanejar, form: FormData): Promise<EstadoPlanejar> {
  return executarAcaoAcompanhada(form.get("contextoId"), "comiIsso", async () => {
    const { userId } = await exigirUsuario();
    const id = z.uuid().safeParse(form.get("id"));
    if (!id.success) return { erro: "Item inválido." };
    const p = await obterPlanejado(userId, id.data);
    if (!p) return { erro: "Item não encontrado." };
    if (p.data > hojeSaoPaulo()) return { erro: "Só dá para marcar como comido no dia ou depois." };
    if (p.consumido) return { ok: "Já estava registrado." };

    const novos: NovoRegistro[] = [];
    try {
      if (p.tipo === "alimento" && p.alimento) {
        const a = await obterAlimento(userId, p.alimento.tipo, p.alimento.id);
        const n = a ? calcularNutrientes(a, p.quantidade) : null;
        if (!a || !n) return { erro: "Este alimento não está mais disponível ou está sem calorias na tabela." };
        novos.push({ data: p.data, refeicao: p.refeicao, tipo: p.alimento.tipo, alimentoId: p.alimento.id, nome: a.marca ? `${a.nome} (${a.marca})` : a.nome, gramas: p.quantidade, medidaTexto: null, nutrientes: n });
      } else if (p.tipo === "receita" && p.receitaId) {
        const rec = await obterReceita(userId, p.receitaId);
        const porPorcao = rec ? gramasPorPorcao(rec.receita.pesoFinalG, rec.receita.porcoes) : null;
        const alimentoId = rec?.receita.alimentoUsuarioId ?? null;
        const a = alimentoId ? await obterAlimento(userId, "usuario", alimentoId) : null;
        const gramas = porPorcao ? Math.round(porPorcao * p.quantidade * 10) / 10 : 0;
        const n = a ? calcularNutrientes(a, gramas) : null;
        if (!a || !n || !alimentoId) return { erro: "A receita não está disponível para registrar (abra e salve a receita de novo)." };
        novos.push({ data: p.data, refeicao: p.refeicao, tipo: "usuario", alimentoId, nome: a.nome, gramas, medidaTexto: `${p.quantidade.toLocaleString("pt-BR")} ${p.quantidade === 1 ? "porção" : "porções"}`, nutrientes: n });
      } else if (p.tipo === "salva" && p.refeicaoSalvaId) {
        const itens = (await itensDaRefeicaoSalva(userId, p.refeicaoSalvaId)) ?? [];
        for (const it of itens) {
          const tipo = it.alimentoBaseId ? ("base" as const) : ("usuario" as const);
          const alimentoId = (it.alimentoBaseId ?? it.alimentoUsuarioId)!;
          const a = await obterAlimento(userId, tipo, alimentoId);
          const gramas = Math.round(Number(it.gramas) * p.quantidade * 10) / 10;
          const n = a ? calcularNutrientes(a, gramas) : null;
          if (a && n) novos.push({ data: p.data, refeicao: p.refeicao, tipo, alimentoId, nome: a.marca ? `${a.nome} (${a.marca})` : a.nome, gramas, medidaTexto: null, nutrientes: n });
        }
        if (novos.length === 0) return { erro: "Nenhum item desta refeição salva pôde ser registrado." };
      }
      if (novos.length === 0) return { erro: "Este item não está disponível." };
      if (novos.some((x) => x.nutrientes.kcal > KCAL_MAX_ITEM)) return { erro: "Quantidade grande demais. Ajuste o planejamento." };
    } catch (e) {
      registrarErro("comiIsso", e);
      return { erro: FALHA };
    }
    // Marca antes de gravar (impede registrar duas vezes com dois toques); se gravar falhar, desmarca.
    if (!(await marcarConsumido(userId, p.id))) return { ok: "Já estava registrado." };
    try {
      await criarRegistros(userId, novos);
    } catch (e) {
      registrarErro("comiIsso", e);
      await desmarcarConsumido(userId, p.id);
      return { erro: FALHA };
    }
    revalidatePath("/comida", "layout");
    revalidatePath("/hoje");
    return { ok: "Registrado no diário." };
  });
}

export async function repetirSemanaAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "repetirSemana", async () => {
    const { userId } = await exigirUsuario();
    const hoje = hojeSaoPaulo();
    const para = semanaDoPlanejamento(form.get("semana"), hoje);
    const de = semanaDoPlanejamento(new Date(Date.parse(`${para}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10), hoje);
    if (de === para) return; // a semana anterior está fora da janela
    try {
      await repetirSemana(userId, de, para);
    } catch (e) {
      registrarErro("repetirSemana", e);
    }
    revalidatePath("/comida/planejar", "layout");
  });
}

// ─── Lista de compras ───

const chaveSchema = z.string().regex(/^(base|usuario):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

export async function alternarCompradoAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "alternarComprado", async () => {
    const { userId } = await exigirUsuario();
    const chave = chaveSchema.safeParse(form.get("chave"));
    if (!chave.success) return;
    try {
      await alternarCompradoChave(userId, semanaDoPlanejamento(form.get("semana"), hojeSaoPaulo()), chave.data);
    } catch (e) {
      registrarErro("alternarComprado", e);
    }
    revalidatePath("/comida/planejar/compras");
  });
}

export async function adicionarAvulsoAcao(_: EstadoPlanejar, form: FormData): Promise<EstadoPlanejar> {
  return executarAcaoAcompanhada(form.get("contextoId"), "adicionarAvulso", async () => {
    const { userId } = await exigirUsuario();
    const texto = limparTexto(String(form.get("texto") ?? ""));
    if (texto.length < 1 || texto.length > LIMITES_PLANO.textoAvulsoMax) return { erro: `Escreva o item em até ${LIMITES_PLANO.textoAvulsoMax} caracteres.` };
    try {
      if (!(await adicionarAvulso(userId, semanaDoPlanejamento(form.get("semana"), hojeSaoPaulo()), texto))) return { erro: `A lista já tem ${LIMITES_PLANO.avulsosPorSemana} itens avulsos.` };
    } catch (e) {
      registrarErro("adicionarAvulso", e);
      return { erro: FALHA };
    }
    revalidatePath("/comida/planejar/compras");
    return { ok: "Adicionado." };
  });
}

export async function alternarAvulsoAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "alternarAvulso", async () => {
    const { userId } = await exigirUsuario();
    const id = z.uuid().safeParse(form.get("id"));
    if (!id.success) return;
    try {
      await alternarAvulso(userId, id.data);
    } catch (e) {
      registrarErro("alternarAvulso", e);
    }
    revalidatePath("/comida/planejar/compras");
  });
}

export async function removerAvulsoAcao(form: FormData): Promise<void> {
  return executarAcaoAcompanhada(form.get("contextoId"), "removerAvulso", async () => {
    const { userId } = await exigirUsuario();
    const id = z.uuid().safeParse(form.get("id"));
    if (!id.success) return;
    try {
      await removerAvulso(userId, id.data);
    } catch (e) {
      registrarErro("removerAvulso", e);
    }
    revalidatePath("/comida/planejar/compras");
  });
}
