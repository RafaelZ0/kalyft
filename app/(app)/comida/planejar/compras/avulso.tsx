"use client";

import { useActionState, useRef } from "react";
import { FormDados } from "@/components/contexto-dados";
import { LIMITES_PLANO } from "@/lib/planejamento";
import { adicionarAvulsoAcao, type EstadoPlanejar } from "../actions";

/** Item avulso na lista (ex.: papel-toalha). Limpa o campo depois de adicionar. */
export function AdicionarAvulso({ semana }: { semana: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState<EstadoPlanejar, FormData>(async (anterior, form) => {
    const r = await adicionarAvulsoAcao(anterior, form);
    if (r.ok) formRef.current?.reset();
    return r;
  }, {});
  return (
    <FormDados ref={formRef} action={acao} className="flex items-start gap-2">
      <input type="hidden" name="semana" value={semana} />
      <label className="min-w-0 flex-1">
        <span className="sr-only">Outro item</span>
        <input name="texto" maxLength={LIMITES_PLANO.textoAvulsoMax} placeholder="Ex.: café, papel-toalha" className="min-h-12 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none focus:border-marca" />
        {estado.erro ? <span role="alert" className="mt-1 block text-sm text-erro">{estado.erro}</span> : null}
      </label>
      <button type="submit" disabled={pendente} className="min-h-12 rounded-xl border border-borda px-4 font-semibold disabled:opacity-60">Adicionar</button>
    </FormDados>
  );
}
