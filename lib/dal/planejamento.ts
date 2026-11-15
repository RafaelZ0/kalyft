import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { comprasItens, refeicoesPlanejadas } from "@/lib/db/schema";
import { LIMITES_PLANO, type Ingrediente, type PlanejadoExpandido, type TipoPlanejado } from "@/lib/planejamento";
import type { Refeicao } from "@/lib/validacao/comida";
import { ehUuid, exigirId } from "./util";

export type Planejado = {
  id: string;
  data: string;
  refeicao: Refeicao;
  tipo: TipoPlanejado;
  quantidade: number;
  consumido: boolean;
  nome: string;
  receitaId: string | null;
  refeicaoSalvaId: string | null;
  alimento: { tipo: "base" | "usuario"; id: string } | null;
};

/** Itens planejados do período, com o nome atual da receita, refeição salva ou alimento. */
export async function listarPlanejados(userId: string, de: string, ate: string): Promise<Planejado[]> {
  exigirId(userId);
  const r = await db.execute<{
    id: string; data: string; refeicao: string; tipo: string; quantidade: string; consumido_em: string | null;
    receita_id: string | null; refeicao_salva_id: string | null; alimento_base_id: string | null; alimento_usuario_id: string | null; nome: string | null;
  }>(sql`
    select p.id, p.data::text, p.refeicao, p.tipo, p.quantidade::text, p.consumido_em, p.receita_id, p.refeicao_salva_id,
      p.alimento_base_id, p.alimento_usuario_id,
      coalesce(r.nome, s.nome, b.nome, u.nome) as nome
    from refeicoes_planejadas p
    left join receitas r on r.id = p.receita_id and r.user_id = p.user_id
    left join refeicoes_salvas s on s.id = p.refeicao_salva_id and s.user_id = p.user_id
    left join alimentos_base b on b.id = p.alimento_base_id
    left join alimentos_usuario u on u.id = p.alimento_usuario_id and u.user_id = p.user_id
    where p.user_id = ${userId} and p.data between ${de} and ${ate}
    order by p.data, p.criado_em
  `);
  return r.rows.map((l) => ({
    id: l.id,
    data: l.data,
    refeicao: l.refeicao as Refeicao,
    tipo: l.tipo as TipoPlanejado,
    quantidade: Number(l.quantidade),
    consumido: l.consumido_em !== null,
    nome: l.nome ?? "Item",
    receitaId: l.receita_id,
    refeicaoSalvaId: l.refeicao_salva_id,
    alimento: l.alimento_base_id ? { tipo: "base", id: l.alimento_base_id } : l.alimento_usuario_id ? { tipo: "usuario", id: l.alimento_usuario_id } : null,
  }));
}

export type NovoPlanejado = {
  data: string;
  refeicao: Refeicao;
  tipo: TipoPlanejado;
  referenciaId: string;
  tipoAlimento?: "base" | "usuario";
  quantidade: number;
};

/**
 * Planeja um item. O limite por refeição/dia é aplicado na própria inserção (insert … select … where count < N).
 * As chaves compostas garantem no banco que receita, refeição salva e alimento são do próprio usuário.
 * Devolve o id, ou null se a refeição daquele dia já está cheia.
 */
export async function adicionarPlanejado(userId: string, n: NovoPlanejado): Promise<string | null> {
  exigirId(userId);
  if (!ehUuid(n.referenciaId)) throw new Error("Referência inválida.");
  const receita = n.tipo === "receita" ? n.referenciaId : null;
  const salva = n.tipo === "salva" ? n.referenciaId : null;
  const base = n.tipo === "alimento" && n.tipoAlimento === "base" ? n.referenciaId : null;
  const usuario = n.tipo === "alimento" && n.tipoAlimento === "usuario" ? n.referenciaId : null;
  const r = await db.execute<{ id: string }>(sql`
    insert into refeicoes_planejadas (user_id, data, refeicao, tipo, receita_id, refeicao_salva_id, alimento_base_id, alimento_usuario_id, quantidade)
    select ${userId}::uuid, ${n.data}::date, ${n.refeicao}, ${n.tipo}, ${receita}::uuid, ${salva}::uuid, ${base}::uuid, ${usuario}::uuid, ${n.quantidade}
    where (select count(*) from refeicoes_planejadas where user_id = ${userId}::uuid and data = ${n.data}::date and refeicao = ${n.refeicao}) < ${LIMITES_PLANO.itensPorRefeicao}
    returning id
  `);
  return r.rows[0]?.id ?? null;
}

export async function removerPlanejado(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const r = await db.delete(refeicoesPlanejadas).where(and(eq(refeicoesPlanejadas.id, id), eq(refeicoesPlanejadas.userId, userId))).returning({ id: refeicoesPlanejadas.id });
  return r.length > 0;
}

/** Planejado do próprio usuário, ou null. */
export async function obterPlanejado(userId: string, id: string): Promise<Planejado | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [l] = await db.select({ data: refeicoesPlanejadas.data }).from(refeicoesPlanejadas).where(and(eq(refeicoesPlanejadas.id, id), eq(refeicoesPlanejadas.userId, userId))).limit(1);
  if (!l) return null;
  return (await listarPlanejados(userId, l.data, l.data)).find((p) => p.id === id) ?? null;
}

/** Marca como consumido só se ainda não estava (evita registrar duas vezes). Devolve se marcou. */
export async function marcarConsumido(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const r = await db
    .update(refeicoesPlanejadas)
    .set({ consumidoEm: new Date() })
    .where(and(eq(refeicoesPlanejadas.id, id), eq(refeicoesPlanejadas.userId, userId), isNull(refeicoesPlanejadas.consumidoEm)))
    .returning({ id: refeicoesPlanejadas.id });
  return r.length > 0;
}

/** Desfaz a marcação (usado quando o registro falha depois de marcar). */
export async function desmarcarConsumido(userId: string, id: string): Promise<void> {
  exigirId(userId);
  await db.update(refeicoesPlanejadas).set({ consumidoEm: null }).where(and(eq(refeicoesPlanejadas.id, id), eq(refeicoesPlanejadas.userId, userId)));
}

/** Copia o planejamento de uma semana para a seguinte, só se a de destino estiver vazia. Devolve quantos copiou. */
export async function repetirSemana(userId: string, deInicio: string, paraInicio: string): Promise<number> {
  exigirId(userId);
  const r = await db.execute<{ id: string }>(sql`
    insert into refeicoes_planejadas (user_id, data, refeicao, tipo, receita_id, refeicao_salva_id, alimento_base_id, alimento_usuario_id, quantidade)
    select user_id, data + (${paraInicio}::date - ${deInicio}::date), refeicao, tipo, receita_id, refeicao_salva_id, alimento_base_id, alimento_usuario_id, quantidade
    from refeicoes_planejadas
    where user_id = ${userId}::uuid and data between ${deInicio}::date and ${deInicio}::date + 6
      and not exists (select 1 from refeicoes_planejadas where user_id = ${userId}::uuid and data between ${paraInicio}::date and ${paraInicio}::date + 6)
    returning id
  `);
  return r.rows.length;
}

/**
 * Expande o planejado do período em ingredientes para a lista de compras: receita (ingredientes × porções ÷
 * rendimento), refeição salva (itens × vezes) e alimento (gramas). Tudo filtrado pelo próprio usuário.
 */
export async function ingredientesDoPeriodo(userId: string, de: string, ate: string): Promise<PlanejadoExpandido[]> {
  exigirId(userId);
  const r = await db.execute<{ planejado: string; tipo: "base" | "usuario"; alimento_id: string; nome: string; grupo: string | null; gramas: string }>(sql`
    with p as (select * from refeicoes_planejadas where user_id = ${userId}::uuid and data between ${de} and ${ate})
    select p.id as planejado, case when i.alimento_base_id is not null then 'base' else 'usuario' end as tipo,
      coalesce(i.alimento_base_id, i.alimento_usuario_id) as alimento_id, coalesce(b.nome, u.nome, i.nome) as nome, b.grupo,
      (i.gramas * p.quantidade / r.porcoes)::text as gramas
    from p join receitas r on r.id = p.receita_id and r.user_id = p.user_id
    join receita_itens i on i.receita_id = r.id and i.user_id = r.user_id
    left join alimentos_base b on b.id = i.alimento_base_id
    left join alimentos_usuario u on u.id = i.alimento_usuario_id and u.user_id = i.user_id
    where p.tipo = 'receita' and coalesce(i.alimento_base_id, i.alimento_usuario_id) is not null
    union all
    select p.id, case when i.alimento_base_id is not null then 'base' else 'usuario' end,
      coalesce(i.alimento_base_id, i.alimento_usuario_id), coalesce(b.nome, u.nome), b.grupo, (i.gramas * p.quantidade)::text
    from p join refeicoes_salvas_itens i on i.refeicao_salva_id = p.refeicao_salva_id and i.user_id = p.user_id
    left join alimentos_base b on b.id = i.alimento_base_id
    left join alimentos_usuario u on u.id = i.alimento_usuario_id and u.user_id = i.user_id
    where p.tipo = 'salva'
    union all
    select p.id, case when p.alimento_base_id is not null then 'base' else 'usuario' end,
      coalesce(p.alimento_base_id, p.alimento_usuario_id), coalesce(b.nome, u.nome), b.grupo, p.quantidade::text
    from p left join alimentos_base b on b.id = p.alimento_base_id
    left join alimentos_usuario u on u.id = p.alimento_usuario_id and u.user_id = p.user_id
    where p.tipo = 'alimento'
  `);
  const porPlanejado = new Map<string, Ingrediente[]>();
  for (const l of r.rows) {
    const lista = porPlanejado.get(l.planejado) ?? [];
    lista.push({ tipo: l.tipo, alimentoId: l.alimento_id, nome: l.nome ?? "Alimento", grupo: l.grupo, gramas: Number(l.gramas) });
    porPlanejado.set(l.planejado, lista);
  }
  return [...porPlanejado.values()].map((ingredientes) => ({ ingredientes }));
}

// ─── Lista de compras: marcações e itens avulsos ───

export type MarcasDaSemana = { comprados: Set<string>; avulsos: Array<{ id: string; texto: string; comprado: boolean }> };

export async function marcasDaSemana(userId: string, semana: string): Promise<MarcasDaSemana> {
  exigirId(userId);
  const l = await db
    .select({ id: comprasItens.id, chave: comprasItens.chave, texto: comprasItens.texto, comprado: comprasItens.comprado })
    .from(comprasItens)
    .where(and(eq(comprasItens.userId, userId), eq(comprasItens.semana, semana)))
    .orderBy(asc(comprasItens.criadoEm));
  return {
    comprados: new Set(l.filter((x) => x.chave && x.comprado).map((x) => x.chave!)),
    avulsos: l.filter((x) => x.texto !== null).map((x) => ({ id: x.id, texto: x.texto!, comprado: x.comprado })),
  };
}

/** Alterna "comprado" de um item calculado (pela chave do alimento). */
export async function alternarCompradoChave(userId: string, semana: string, chave: string): Promise<void> {
  exigirId(userId);
  await db.execute(sql`
    insert into compras_itens (user_id, semana, chave, comprado) values (${userId}::uuid, ${semana}::date, ${chave}, true)
    on conflict (user_id, semana, chave) where chave is not null do update set comprado = not compras_itens.comprado
  `);
}

/** Adiciona item avulso, respeitando o limite por semana na própria inserção. Devolve se adicionou. */
export async function adicionarAvulso(userId: string, semana: string, texto: string): Promise<boolean> {
  exigirId(userId);
  const r = await db.execute<{ id: string }>(sql`
    insert into compras_itens (user_id, semana, texto)
    select ${userId}::uuid, ${semana}::date, ${texto}
    where (select count(*) from compras_itens where user_id = ${userId}::uuid and semana = ${semana}::date and texto is not null) < ${LIMITES_PLANO.avulsosPorSemana}
    returning id
  `);
  return r.rows.length > 0;
}

export async function alternarAvulso(userId: string, id: string): Promise<void> {
  exigirId(userId);
  if (!ehUuid(id)) return;
  await db.update(comprasItens).set({ comprado: sql`not ${comprasItens.comprado}` }).where(and(eq(comprasItens.id, id), eq(comprasItens.userId, userId)));
}

export async function removerAvulso(userId: string, id: string): Promise<void> {
  exigirId(userId);
  if (!ehUuid(id)) return;
  await db.delete(comprasItens).where(and(eq(comprasItens.id, id), eq(comprasItens.userId, userId)));
}
