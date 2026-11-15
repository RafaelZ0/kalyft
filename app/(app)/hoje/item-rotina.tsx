"use client";

import { useActionState, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { ajustarPorcao, type ItemRotina as Item } from "@/lib/rotina";
import type { Refeicao } from "@/lib/validacao/comida";
import { ocultarDaRotinaAcao, registrarDaRotina, type EstadoRotina } from "./actions";

const g = (v: number) => `${v.toLocaleString("pt-BR")} g`;

/** Um alimento habitual: porção ajustável com − e + e registro em um toque, sem sair do Hoje. */
export function ItemRotina({ item, refeicao }: { item: Item; refeicao: Refeicao }) {
  const [gramas, setGramas] = useState(item.gramas);
  const [estado, acao, pendente] = useActionState<EstadoRotina, FormData>(registrarDaRotina, {});
  if (estado.ok) {
    return (
      <li className="flex min-h-16 items-center gap-3 py-2 text-sm font-semibold text-ok" role="status">
        <Check size={20} aria-hidden="true" />{item.nome} · {g(gramas)} registrado
      </li>
    );
  }
  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{item.nome}</span>
          <span className="block text-xs text-suave">em {item.dias} dos últimos 30 dias</span>
        </span>
        <FormDados action={ocultarDaRotinaAcao}>
          <input type="hidden" name="tipo" value={item.tipo} />
          <input type="hidden" name="alimentoId" value={item.alimentoId} />
          <input type="hidden" name="refeicao" value={refeicao} />
          <button type="submit" className="min-h-11 px-2 text-xs font-semibold text-suave underline">Não mostrar</button>
        </FormDados>
      </div>
      <FormDados action={acao} className="flex items-center gap-2">
        <input type="hidden" name="tipo" value={item.tipo} />
        <input type="hidden" name="alimentoId" value={item.alimentoId} />
        <input type="hidden" name="refeicao" value={refeicao} />
        <input type="hidden" name="gramas" value={gramas} />
        <button type="button" onClick={() => setGramas((v) => ajustarPorcao(v, item.gramas, -1))} aria-label={`Diminuir porção de ${item.nome}`} className="flex size-11 items-center justify-center rounded-xl border border-borda">
          <Minus size={18} aria-hidden="true" />
        </button>
        <output aria-live="polite" className="min-w-16 text-center font-semibold tabular-nums">{g(gramas)}</output>
        <button type="button" onClick={() => setGramas((v) => ajustarPorcao(v, item.gramas, 1))} aria-label={`Aumentar porção de ${item.nome}`} className="flex size-11 items-center justify-center rounded-xl border border-borda">
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="submit" disabled={pendente} className="ml-auto min-h-11 rounded-xl bg-destaque px-4 text-sm font-bold text-sobre-destaque disabled:opacity-60">
          {pendente ? "Registrando…" : "Registrar"}
        </button>
      </FormDados>
      {estado.erro ? <p role="alert" className="text-sm text-erro">{estado.erro}</p> : null}
    </li>
  );
}
