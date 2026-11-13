"use client";

import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

type CampoProps = {
  nome: string;
  rotulo: string;
  valor?: string | null;
  erro?: string;
  tipo?: "text" | "email" | "password" | "date";
  teclado?: "numeric" | "decimal" | "email" | "text";
  sufixo?: string;
  autoComplete?: string;
  maxLength?: number;
  dica?: string;
};

/** Campo de texto grande para toque. Números usam teclado numérico, sem setinhas. */
export function Campo({
  nome,
  rotulo,
  valor,
  erro,
  tipo = "text",
  teclado,
  sufixo,
  autoComplete = "off",
  maxLength,
  dica,
}: CampoProps) {
  const idErro = erro ? `${nome}-erro` : undefined;
  const idDica = dica ? `${nome}-dica` : undefined;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-suave">{rotulo}</span>
      <span className="flex items-center gap-3 rounded-xl border border-borda bg-fundo px-3 focus-within:border-marca focus-within:ring-1 focus-within:ring-marca">
        <input
          name={nome}
          type={tipo}
          inputMode={teclado}
          defaultValue={valor ?? ""}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[idErro, idDica].filter(Boolean).join(" ") || undefined}
          className="min-h-12 w-full bg-transparent py-3 text-base font-medium outline-none placeholder:text-suave"
        />
        {sufixo ? <span className="shrink-0 text-suave">{sufixo}</span> : null}
      </span>
      {dica ? <span id={idDica} className="mt-1.5 block text-sm text-suave">{dica}</span> : null}
      {erro ? (
        <span id={idErro} className="mt-1 block text-sm text-erro">
          <AlertCircle size={16} className="mr-1 inline" aria-hidden="true" />{erro}
        </span>
      ) : null}
    </label>
  );
}

type OpcoesProps = {
  nome: string;
  rotulo: string;
  opcoes: ReadonlyArray<{ valor: string; rotulo: string }>;
  valor?: string | null;
  erro?: string;
};

/** Escolha única em botões grandes (radio estilizado). */
export function Opcoes({ nome, rotulo, opcoes, valor, erro }: OpcoesProps) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-suave">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label key={o.valor} className="cursor-pointer">
            <input
              type="radio"
              name={nome}
              value={o.valor}
              defaultChecked={valor === o.valor}
              className="peer sr-only"
            />
            <span className="flex min-h-12 items-center rounded-xl border border-borda px-4 text-sm font-semibold text-suave peer-checked:border-marca peer-checked:bg-marca-suave peer-checked:text-marca peer-focus-visible:outline-2 peer-focus-visible:outline-destaque">
              {o.rotulo}
            </span>
          </label>
        ))}
      </div>
      {erro ? <span className="mt-1 block text-sm text-erro"><AlertCircle size={16} className="mr-1 inline" aria-hidden="true" />{erro}</span> : null}
    </fieldset>
  );
}

export function BotaoEnviar({ children, pendente }: { children: React.ReactNode; pendente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="action-primary w-full"
    >
      {pending ? <><LoaderCircle size={18} className="motion-safe:animate-spin" aria-hidden="true" />{pendente ?? "Salvando…"}</> : children}
    </button>
  );
}

export function BotaoSecundario({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="action-secondary"
    >
      {children}
    </button>
  );
}

export function Aviso({ children, tipo = "erro" }: { children: React.ReactNode; tipo?: "erro" | "ok" }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border border-current/25 p-3 text-sm font-medium ${tipo === "erro" ? "text-erro" : "text-ok"}`}
    >
      {tipo === "erro" ? <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}{children}
    </p>
  );
}
