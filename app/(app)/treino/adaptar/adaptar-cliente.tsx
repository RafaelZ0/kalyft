"use client";

import { useActionState, useState } from "react";
import { Clock, Minus, Plus, RotateCcw } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { minutosEstimados, MINUTOS_OPCOES, versaoNoTempo, type AjusteItem, type Alternativa, type ItemParaAdaptar } from "@/lib/treino-adaptado";
import { salvarAdaptacao, type EstadoAdaptar } from "./actions";

export type ItemAdaptarTela = ItemParaAdaptar & { nome: string; alternativas: Alternativa[] };

/** Editor da adaptação: tempo disponível, séries com − e +, pular e trocar. Nada é salvo antes de confirmar. */
export function AdaptarCliente({
  data,
  itens,
  inicial,
  minutosInicial,
  minutosCompleto,
}: {
  data: string;
  itens: ItemAdaptarTela[];
  inicial: AjusteItem[];
  minutosInicial: number | null;
  minutosCompleto: number;
}) {
  const [ajustes, setAjustes] = useState<AjusteItem[]>(() => itens.map((i) => inicial.find((a) => a.itemId === i.id) ?? { itemId: i.id, series: i.series, pular: false, exercicioId: null }));
  const [minutos, setMinutos] = useState<number | null>(minutosInicial);
  const [estado, acao, pendente] = useActionState<EstadoAdaptar, FormData>(salvarAdaptacao, {});

  const porId = new Map(itens.map((i) => [i.id, i]));
  const estimativa = minutosEstimados(ajustes.filter((a) => !a.pular).map((a) => ({ ...porId.get(a.itemId)!, series: a.series })));
  const ativos = ajustes.filter((a) => !a.pular).length;
  const mudar = (itemId: string, f: (a: AjusteItem) => AjusteItem) => setAjustes((l) => l.map((a) => (a.itemId === itemId ? f(a) : a)));

  return (
    <FormDados action={acao} className="space-y-6">
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="minutos" value={minutos ?? ""} />
      <input type="hidden" name="itens" value={JSON.stringify(ajustes)} />

      <section aria-labelledby="h-tempo" className="app-card space-y-3">
        <h2 id="h-tempo" className="section-heading flex items-center gap-2"><Clock size={20} className="text-marca" aria-hidden="true" />Quanto tempo você tem?</h2>
        <p className="text-sm text-suave">Treino completo: cerca de {minutosCompleto} min (estimativa).</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tempo disponível">
          {MINUTOS_OPCOES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minutos === m}
              onClick={() => { setMinutos(m); setAjustes((atual) => versaoNoTempo(itens, m, atual)); }}
              className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${minutos === m ? "bg-destaque text-sobre-destaque" : "border border-borda text-suave"}`}
            >
              {m} min
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-exercicios" className="app-card space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="h-exercicios" className="section-heading">Exercícios de hoje</h2>
          <p className="text-sm font-semibold tabular-nums" aria-live="polite">~{estimativa} min</p>
        </div>
        <ul className="divide-y divide-linha">
          {itens.map((item) => {
            const a = ajustes.find((x) => x.itemId === item.id)!;
            const nomeAtual = a.exercicioId ? (item.alternativas.find((x) => x.id === a.exercicioId)?.nome ?? item.nome) : item.nome;
            return (
              <li key={item.id} className={`space-y-3 py-4 ${a.pular ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-semibold ${a.pular ? "line-through" : ""}`}>{nomeAtual}</p>
                    {a.exercicioId ? <p className="text-xs text-suave">no lugar de {item.nome}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => mudar(item.id, (x) => ({ ...x, pular: !x.pular }))}
                    disabled={!a.pular && ativos <= 1}
                    className="min-h-11 shrink-0 rounded-xl border border-borda px-3 text-sm font-semibold disabled:opacity-40"
                  >
                    {a.pular ? "Recolocar" : "Pular hoje"}
                  </button>
                </div>
                {!a.pular ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => mudar(item.id, (x) => ({ ...x, series: Math.max(1, x.series - 1) }))} disabled={a.series <= 1} aria-label={`Menos uma série de ${nomeAtual}`} className="flex size-11 items-center justify-center rounded-xl border border-borda disabled:opacity-40">
                        <Minus size={18} aria-hidden="true" />
                      </button>
                      <output className="min-w-20 text-center text-sm font-semibold tabular-nums">{a.series} de {item.series} séries</output>
                      <button type="button" onClick={() => mudar(item.id, (x) => ({ ...x, series: Math.min(item.series, x.series + 1) }))} disabled={a.series >= item.series} aria-label={`Mais uma série de ${nomeAtual}`} className="flex size-11 items-center justify-center rounded-xl border border-borda disabled:opacity-40">
                        <Plus size={18} aria-hidden="true" />
                      </button>
                    </div>
                    {item.alternativas.length ? (
                      <label className="block">
                        <span className="sr-only">Trocar {item.nome} por</span>
                        <select
                          value={a.exercicioId ?? ""}
                          onChange={(e) => mudar(item.id, (x) => ({ ...x, exercicioId: e.target.value || null }))}
                          className="min-h-11 w-full rounded-xl border border-borda bg-superficie px-3 text-sm font-semibold"
                        >
                          <option value="">{a.exercicioId ? `Voltar para ${item.nome}` : "Trocar por outro…"}</option>
                          {item.alternativas.map((alt) => (
                            <option key={alt.id} value={alt.id}>{alt.nome}{alt.origem === "substituto" ? " (substituto)" : ""}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="text-xs text-suave">Sem substituto nem outro exercício do mesmo grupo para trocar.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => { setMinutos(null); setAjustes(itens.map((i) => ({ itemId: i.id, series: i.series, pular: false, exercicioId: null }))); }}
          className="flex min-h-11 items-center gap-2 text-sm font-semibold text-suave underline"
        >
          <RotateCcw size={16} aria-hidden="true" />Desfazer mudanças
        </button>
      </section>

      {estado.erro ? <p role="alert" className="app-card border-erro text-sm text-erro">{estado.erro}</p> : null}
      <button type="submit" disabled={pendente} className="action-primary w-full disabled:opacity-60">
        {pendente ? "Salvando…" : "Usar esta versão hoje"}
      </button>
      <p className="text-center text-xs text-suave">As durações são estimativas: dependem do seu ritmo e do descanso real.</p>
    </FormDados>
  );
}
