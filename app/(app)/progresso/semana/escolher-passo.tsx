"use client";

import { useActionState, useState } from "react";
import { FormDados } from "@/components/contexto-dados";
import { TEXTO_LIVRE_MAX, textoDoPasso, type Passo } from "@/lib/proximo-passo";
import { escolherPassoSemana, type EstadoPasso } from "./passo-actions";

const valorDe = (p: Passo) => `${p.tipo}|${p.alvo}|${p.refeicao ?? ""}`;

/** Escolha de um passo sugerido ou de um passo escrito pela pessoa. Nada é salvo sem "Escolher este passo". */
export function EscolherPasso({ semana, sugestoes, atual }: { semana: "atual" | "proxima"; sugestoes: Passo[]; atual: Passo | null }) {
  const inicial = atual ? (atual.tipo === "livre" ? "livre" : valorDe(atual)) : sugestoes[0] ? valorDe(sugestoes[0]) : "livre";
  const [escolha, setEscolha] = useState(inicial);
  const [estado, acao, pendente] = useActionState<EstadoPasso, FormData>(escolherPassoSemana, {});
  return (
    <FormDados action={acao} className="space-y-3">
      <input type="hidden" name="semana" value={semana} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Escolha um passo</legend>
        {sugestoes.map((p) => {
          const v = valorDe(p);
          return (
            <label key={v} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-borda px-4 has-[:checked]:border-marca has-[:checked]:font-semibold">
              <input type="radio" name="escolha" value={v} checked={escolha === v} onChange={() => setEscolha(v)} className="size-5 accent-[var(--color-marca)]" />
              {textoDoPasso(p)}
            </label>
          );
        })}
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-borda px-4 has-[:checked]:border-marca has-[:checked]:font-semibold">
          <input type="radio" name="escolha" value="livre" checked={escolha === "livre"} onChange={() => setEscolha("livre")} className="size-5 accent-[var(--color-marca)]" />
          Escrever o meu
        </label>
      </fieldset>
      {escolha === "livre" ? (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Seu passo para a semana</span>
          <input
            name="texto"
            maxLength={TEXTO_LIVRE_MAX}
            defaultValue={atual?.tipo === "livre" ? (atual.texto ?? "") : ""}
            placeholder="Ex.: levar marmita três dias"
            className="min-h-12 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none focus:border-marca"
          />
        </label>
      ) : null}
      {estado.erro ? <p role="alert" className="text-sm text-erro">{estado.erro}</p> : null}
      {estado.ok ? <p role="status" className="text-sm text-ok">{estado.ok}</p> : null}
      <button type="submit" disabled={pendente} className="action-primary w-full disabled:opacity-60">
        {pendente ? "Salvando…" : atual ? "Trocar o passo" : "Escolher este passo"}
      </button>
    </FormDados>
  );
}
