"use client";

import { useActionState, useState } from "react";
import { CampoContexto } from "@/components/contexto-dados";
import { responderPedido, revogarAcesso, solicitarAcesso, type EstadoAcompanhamento } from "./actions";

const BOTAO = "min-h-12 rounded-xl border border-borda px-4 font-semibold disabled:opacity-50";
const PRINCIPAL = "min-h-12 rounded-xl bg-destaque px-4 font-bold text-sobre-destaque disabled:opacity-50";

function Resultado({ estado, sucesso }: { estado: EstadoAcompanhamento; sucesso: string }) {
  if (estado.erro) return <p role="alert" className="text-sm text-erro">{estado.erro}</p>;
  if (estado.ok) return <p role="status" className="text-sm text-suave">{sucesso}</p>;
  return null;
}

export function FormularioSolicitacao({ tipo }: { tipo: "edicao" | "fotos" }) {
  const [estado, enviar, pendente] = useActionState(solicitarAcesso, {});
  return (
    <form action={enviar} className="space-y-2">
      <CampoContexto />
      <input type="hidden" name="tipo" value={tipo} />
      <button disabled={pendente || estado.ok} className={`${BOTAO} w-full text-sm`}>
        {pendente ? "Solicitando…" : estado.ok ? "Solicitação enviada" : tipo === "edicao" ? "Solicitar edição" : "Solicitar acesso às fotos"}
      </button>
      <Resultado estado={estado} sucesso="O aluno poderá responder em Ajustes → Acompanhamento." />
    </form>
  );
}

export function FormularioPedido({ pedidoId, tipo }: { pedidoId: string; tipo: "edicao" | "fotos" }) {
  const [estado, enviar, pendente] = useActionState(responderPedido, {});
  const [prazo, definirPrazo] = useState("");
  const data = prazo ? new Date(`${prazo}:00-03:00`) : null;
  const resumo = data && Number.isFinite(data.getTime()) ? new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
  }).format(data) : null;
  return (
    <form action={enviar} className="mt-4 space-y-4">
      <CampoContexto />
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <input type="hidden" name="tipo" value={tipo} />
      <fieldset disabled={pendente || estado.ok} className="space-y-4">
        {tipo === "edicao" ? (
          <label className="block space-y-2">
            <span className="block text-sm font-medium text-suave">Autorizar edição até</span>
            <input type="datetime-local" name="prazo" value={prazo} onChange={(evento) => definirPrazo(evento.target.value)}
              className="min-h-12 w-full min-w-0 rounded-xl border-2 border-borda bg-transparent px-3 text-lg" aria-describedby={`${pedidoId}-prazo`} />
            <span id={`${pedidoId}-prazo`} className="block text-sm text-suave">
              {resumo ? `A edição ficará liberada até ${resumo}, horário de São Paulo.` : "Escolha livremente a data e o horário finais, no horário de São Paulo."}
            </span>
          </label>
        ) : <p className="text-sm text-suave">Ao aceitar, este administrador poderá visualizar suas fotos corporais e notas até você revogar. Essa autorização não permite enviar ou excluir fotos.</p>}
        <p className="text-sm text-suave">Você pode revogar a autorização a qualquer momento.</p>
        <div className="grid grid-cols-2 gap-3">
          <button name="decisao" value="aceitar" className={PRINCIPAL}>{pendente ? "Aguarde…" : "Aceitar"}</button>
          <button name="decisao" value="recusar" className={BOTAO}>Recusar</button>
        </div>
      </fieldset>
      <Resultado estado={estado} sucesso="Resposta registrada." />
    </form>
  );
}

export function FormularioRevogacao({ pedidoId }: { pedidoId: string }) {
  const [estado, enviar, pendente] = useActionState(revogarAcesso, {});
  return (
    <form action={enviar} className="mt-4 space-y-2">
      <CampoContexto />
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <button disabled={pendente || estado.ok} className={`${BOTAO} w-full`}>{pendente ? "Revogando…" : "Revogar autorização"}</button>
      <Resultado estado={estado} sucesso="Autorização revogada." />
    </form>
  );
}
