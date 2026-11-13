import "server-only";

import type { NeonQueryFunction, NeonQueryPromise } from "@neondatabase/serverless";
import { obterExecucaoAcompanhada, type ExecucaoAcompanhada } from "@/lib/acompanhamento/execucao";

type Consulta = NeonQueryPromise<boolean, boolean, unknown>;
type Cliente = NeonQueryFunction<boolean, boolean>;

/** Mantém o contrato lazy do Neon; Drizzle reutiliza essas promises em db.batch. */
export function protegerClienteAcompanhamento<A extends boolean, F extends boolean>(original: NeonQueryFunction<A, F>): NeonQueryFunction<A, F> {
  const raw = original as unknown as Cliente;
  const originais = new WeakMap<object, Consulta>();
  const validar = (execucao: ExecucaoAcompanhada) => raw.query(
    "select acompanhamento_validar($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text)",
    [execucao.contexto.contextoId, execucao.contexto.atorId, execucao.contexto.titularId, execucao.sessaoHash, execucao.operacao],
  );
  function proteger(consulta: Consulta): Consulta {
    const criadaEm = obterExecucaoAcompanhada();
    const executar = () => {
      const execucao = obterExecucaoAcompanhada() ?? criadaEm;
      if (!execucao || execucao.contexto.modo === "proprio") return Promise.resolve(consulta);
      return raw.transaction([validar(execucao), consulta]).then((resultados) => resultados[1]);
    };
    const proxy = new Proxy(consulta, {
      get(target, propriedade, receiver) {
        if (propriedade === "then") return (resolver?: (valor: unknown) => unknown, rejeitar?: (erro: unknown) => unknown) => executar().then(resolver, rejeitar);
        if (propriedade === "catch") return (rejeitar: (erro: unknown) => unknown) => executar().catch(rejeitar);
        if (propriedade === "finally") return (finalizar: () => void) => executar().finally(finalizar);
        return Reflect.get(target, propriedade, receiver);
      },
    });
    originais.set(proxy, consulta);
    return proxy;
  }
  const cliente: Cliente = new Proxy(raw, {
    apply(target, thisArg, argumentos) {
      return proteger(Reflect.apply(target, thisArg, argumentos) as Consulta);
    },
    get(target, propriedade, receiver) {
      if (propriedade === "query") return (...argumentos: Parameters<Cliente["query"]>) => proteger(raw.query(...argumentos));
      if (propriedade === "transaction") return async (...[consultasOuFuncao, opcoes]: Parameters<Cliente["transaction"]>) => {
        const consultas = typeof consultasOuFuncao === "function" ? consultasOuFuncao(cliente) : consultasOuFuncao;
        const consultasRaw = consultas.map((consulta) => originais.get(consulta) ?? consulta) as Consulta[];
        const execucao = obterExecucaoAcompanhada();
        if (!execucao || execucao.contexto.modo === "proprio") return raw.transaction(consultasRaw, opcoes);
        return (await raw.transaction([validar(execucao), ...consultasRaw], opcoes)).slice(1);
      };
      return Reflect.get(target, propriedade, receiver);
    },
  });
  return cliente as unknown as NeonQueryFunction<A, F>;
}
