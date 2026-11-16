// Cabeçalho comum dos gráficos: rótulo pequeno, número principal em destaque e uma linha de contexto.
// O gráfico (e a nota de rodapé) vem embaixo. Mesma estrutura em todo o app.
export function CartaoGrafico({
  id,
  rotulo,
  valor,
  unidade,
  contexto,
  nota,
  children,
}: {
  id: string;
  rotulo: string;
  valor?: string | null;
  unidade?: string;
  contexto?: React.ReactNode;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-3">
      <header className="space-y-1">
        <h3 id={id} className="text-sm font-semibold text-suave">{rotulo}</h3>
        {valor ? (
          <p className="text-4xl font-bold leading-none tracking-tight tabular-nums">
            {valor}
            {unidade ? <span className="ml-1 text-lg font-semibold text-suave">{unidade}</span> : null}
          </p>
        ) : null}
        {contexto ? <p className="text-sm text-suave">{contexto}</p> : null}
      </header>
      {children}
      {nota ? <p className="text-xs text-suave">{nota}</p> : null}
    </section>
  );
}

/** Poucos dados para um gráfico: mostra os valores em lista e explica o que falta. */
export function PoucosDados({ itens, mensagem }: { itens: Array<{ rotulo: string; valor: string }>; mensagem: string }) {
  return (
    <div className="space-y-2">
      {itens.length > 0 ? (
        <ul>
          {itens.map((i) => (
            <li key={i.rotulo} className="flex min-h-11 items-center justify-between border-b border-linha text-sm">
              <span className="text-suave">{i.rotulo}</span>
              <span className="font-semibold tabular-nums">{i.valor}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-suave">{mensagem}</p>
    </div>
  );
}
