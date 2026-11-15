"use client";

import { useActionState, useState, useTransition } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { LIMITES_PLANO, type TipoPlanejado } from "@/lib/planejamento";
import { REFEICOES, ROTULOS_REFEICAO, type Refeicao } from "@/lib/validacao/comida";
import { buscar } from "../../actions";
import { planejarItem, type EstadoPlanejar } from "../actions";

type Escolha = { tipo: TipoPlanejado; id: string; nome: string; tipoAlimento?: "base" | "usuario" };
type Resultado = { tipo: "base" | "usuario"; id: string; nome: string; marca: string | null; kcal: number | null };

const passoPorcao = 0.5;
const passoGramas = (g: number) => (g < 60 ? 5 : g < 300 ? 10 : 25);

/** Escolha do item e da quantidade. Nada é salvo antes de "Planejar". */
export function AdicionarPlanejado({ data, refeicaoInicial, receitas, salvas }: {
  data: string;
  refeicaoInicial: Refeicao;
  receitas: Array<{ id: string; nome: string }>;
  salvas: Array<{ id: string; nome: string; itens: number }>;
}) {
  const [aba, setAba] = useState<TipoPlanejado>(receitas.length ? "receita" : salvas.length ? "salva" : "alimento");
  const [refeicao, setRefeicao] = useState<Refeicao>(refeicaoInicial);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [buscando, iniciar] = useTransition();
  const [estado, acao, pendente] = useActionState<EstadoPlanejar, FormData>(planejarItem, {});

  const escolher = (e: Escolha) => {
    setEscolha(e);
    setQuantidade(e.tipo === "alimento" ? 100 : 1);
  };
  const mudar = (dir: 1 | -1) =>
    setQuantidade((q) =>
      escolha?.tipo === "alimento"
        ? Math.min(LIMITES_PLANO.gramasMax, Math.max(LIMITES_PLANO.gramasMin, q + dir * passoGramas(q)))
        : Math.min(LIMITES_PLANO.porcoesMax, Math.max(LIMITES_PLANO.porcoesMin, q + dir * passoPorcao)),
    );
  const textoQtd = escolha?.tipo === "alimento" ? `${quantidade.toLocaleString("pt-BR")} g` : escolha?.tipo === "receita" ? `${quantidade.toLocaleString("pt-BR")} ${quantidade === 1 ? "porção" : "porções"}` : `${quantidade.toLocaleString("pt-BR")}×`;

  const opcao = (e: Escolha, detalhe?: string) => (
    <li key={`${e.tipo}-${e.id}`}>
      <button
        type="button"
        onClick={() => escolher(e)}
        aria-pressed={escolha?.id === e.id && escolha.tipo === e.tipo}
        className={`flex min-h-12 w-full items-center justify-between gap-3 border-b border-linha py-2 text-left last:border-b-0 ${escolha?.id === e.id && escolha.tipo === e.tipo ? "font-bold text-marca" : ""}`}
      >
        <span className="min-w-0 truncate">{e.nome}</span>
        {detalhe ? <span className="shrink-0 text-xs text-suave">{detalhe}</span> : null}
      </button>
    </li>
  );

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Refeição</span>
        <select value={refeicao} onChange={(e) => setRefeicao(e.target.value as Refeicao)} className="min-h-12 w-full rounded-xl border border-borda bg-superficie px-3 text-base font-semibold">
          {REFEICOES.map((r) => <option key={r} value={r}>{ROTULOS_REFEICAO[r]}</option>)}
        </select>
      </label>

      <div role="tablist" aria-label="O que planejar" className="grid grid-cols-3 gap-2">
        {(["receita", "salva", "alimento"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={aba === t} onClick={() => setAba(t)} className={`min-h-11 rounded-xl border text-sm font-semibold ${aba === t ? "border-marca text-texto" : "border-linha text-suave"}`}>
            {t === "receita" ? "Receitas" : t === "salva" ? "Salvas" : "Alimento"}
          </button>
        ))}
      </div>

      <section className="app-card">
        {aba === "receita" ? (
          receitas.length ? <ul>{receitas.map((r) => opcao({ tipo: "receita", id: r.id, nome: r.nome }))}</ul> : <p className="text-sm text-suave">Você ainda não tem receitas. Crie em Comida → Receitas.</p>
        ) : aba === "salva" ? (
          salvas.length ? <ul>{salvas.map((s) => opcao({ tipo: "salva", id: s.id, nome: s.nome }, `${s.itens} ${s.itens === 1 ? "item" : "itens"}`))}</ul> : <p className="text-sm text-suave">Você ainda não tem refeições salvas.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Buscar alimento</span>
                <input value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} placeholder="Ex.: banana" maxLength={60} className="min-h-12 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none focus:border-marca" />
              </label>
              <button
                type="button"
                disabled={buscando}
                onClick={() => iniciar(async () => { const r = await buscar(termo); setResultados(r.resultados); setErroBusca(r.erro ?? null); })}
                aria-label="Buscar"
                className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-borda"
              >
                <Search size={18} aria-hidden="true" />
              </button>
            </div>
            {erroBusca ? <p role="alert" className="text-sm text-erro">{erroBusca}</p> : null}
            {resultados ? (
              resultados.length ? <ul>{resultados.slice(0, 15).map((r) => opcao({ tipo: "alimento", id: r.id, nome: r.marca ? `${r.nome} (${r.marca})` : r.nome, tipoAlimento: r.tipo }, r.kcal !== null ? `${Math.round(r.kcal)} kcal/100 g` : undefined))}</ul> : <p className="text-sm text-suave">Nada encontrado.</p>
            ) : null}
          </div>
        )}
      </section>

      {escolha ? (
        <FormDados action={acao} className="app-card space-y-4">
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="refeicao" value={refeicao} />
          <input type="hidden" name="tipo" value={escolha.tipo} />
          <input type="hidden" name="referenciaId" value={escolha.id} />
          <input type="hidden" name="tipoAlimento" value={escolha.tipoAlimento ?? ""} />
          <input type="hidden" name="quantidade" value={quantidade} />
          <p className="font-semibold">{escolha.nome}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-suave">{escolha.tipo === "salva" ? "Vezes" : "Quantidade"}</span>
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => mudar(-1)} aria-label="Diminuir" className="flex size-11 items-center justify-center rounded-xl border border-borda"><Minus size={18} aria-hidden="true" /></button>
              <output className="min-w-24 text-center font-semibold tabular-nums">{textoQtd}</output>
              <button type="button" onClick={() => mudar(1)} aria-label="Aumentar" className="flex size-11 items-center justify-center rounded-xl border border-borda"><Plus size={18} aria-hidden="true" /></button>
            </span>
          </div>
          {estado.erro ? <p role="alert" className="text-sm text-erro">{estado.erro}</p> : null}
          <button type="submit" disabled={pendente} className="action-primary w-full disabled:opacity-60">{pendente ? "Salvando…" : `Planejar no ${ROTULOS_REFEICAO[refeicao].toLowerCase()}`}</button>
        </FormDados>
      ) : null}
    </div>
  );
}
