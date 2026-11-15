"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { adiarLembreteAcao, hojeNaoAcao, type EstadoLembrete } from "./ajustes/lembretes/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Faixa mostrada quando a pessoa abre o app pela notificação: adiar 30 min ou "hoje não". */
export function FaixaLembrete() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.get("lembrete");
  const [fechada, setFechada] = useState(false);

  const limparUrl = () => {
    const resto = new URLSearchParams(params.toString());
    resto.delete("lembrete");
    const q = resto.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const [aviso, setAviso] = useState<string | null>(null);
  const [estado, enviar, pendente] = useActionState(async (anterior: EstadoLembrete, form: FormData) => {
    const adiar = form.get("op") === "adiar";
    const r = await (adiar ? adiarLembreteAcao : hojeNaoAcao)(anterior, form);
    if (r.ok) {
      setAviso(adiar ? "Combinado: lembro de novo em 30 minutos." : "Tudo bem, hoje este lembrete não toca mais.");
      limparUrl();
    }
    return r;
  }, {});

  if (aviso) return <p role="status" className="mb-4 rounded-xl border border-linha p-3 text-sm font-medium">{aviso}</p>;
  if (!id || !UUID.test(id) || fechada) return null;

  return (
    <form action={enviar} className="mb-4 space-y-3 rounded-2xl border border-linha p-4" aria-label="Lembrete">
      <input type="hidden" name="id" value={id} />
      <p className="font-semibold">Agora não é um bom momento?</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" name="op" value="adiar" disabled={pendente} className="action-secondary">Lembrar em 30 min</button>
        <button type="submit" name="op" value="hoje" disabled={pendente} className="action-secondary">Hoje não</button>
      </div>
      <button type="button" onClick={() => { setFechada(true); limparUrl(); }} className="min-h-11 text-sm font-semibold text-suave">Fechar</button>
      {estado.erro ? <p role="alert" className="text-sm text-erro">{estado.erro}</p> : null}
    </form>
  );
}
