"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { comiIsso, type EstadoPlanejar } from "./actions";

/** "Comi isso": cria o registro do item planejado (nutrientes recalculados no servidor) sem sair da tela. */
export function BotaoComiIsso({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, pendente] = useActionState<EstadoPlanejar, FormData>(comiIsso, {});
  if (estado.ok) return <p role="status" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-ok"><Check size={16} aria-hidden="true" />{estado.ok}</p>;
  return (
    <FormDados action={acao} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pendente} aria-label={`Comi ${nome}`} className="min-h-11 rounded-xl bg-destaque px-3 text-sm font-bold text-sobre-destaque disabled:opacity-60">
        {pendente ? "Registrando…" : "Comi isso"}
      </button>
      {estado.erro ? <p role="alert" className="text-xs text-erro">{estado.erro}</p> : null}
    </FormDados>
  );
}
