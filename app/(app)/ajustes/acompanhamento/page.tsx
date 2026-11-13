import Link from "next/link";
import { exigirContaPropria } from "@/lib/auth/acompanhamento";
import { listarAutorizacoes, listarHistorico } from "@/lib/dal/acompanhamento";
import { FormularioPedido, FormularioRevogacao } from "./formularios";

export const metadata = { title: "Acompanhamento · Kalyft" };

const horario = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const rotulos: Record<string, string> = {
  criar: "Criação", create: "Criação", atualizar: "Alteração", update: "Alteração", editar: "Alteração",
  excluir: "Exclusão", delete: "Exclusão", salvar: "Alteração", solicitar: "Solicitação", aceitar: "Aceite", recusar: "Recusa", revogar: "Revogação",
  perfil: "Perfil", metas: "Metas", meta: "Meta", agua: "Água", treino: "Treino", treinos: "Treinos", alimento: "Alimento", alimentos: "Alimentos",
  registro: "Alimentação", registros: "Alimentação", receita: "Receita", receitas: "Receitas", medidas: "Pesagens", corpo: "Evolução", fotos: "Fotos", edicao: "Edição",
};

export default async function PaginaAcompanhamento({ searchParams }: { searchParams: Promise<{ pagina?: string; erro?: string }> }) {
  const contexto = await exigirContaPropria();
  const parametros = await searchParams;
  const pagina = Math.min(100_000, Math.max(1, Number.parseInt(parametros.pagina ?? "1", 10) || 1));
  const [autorizacoes, historico] = await Promise.all([
    listarAutorizacoes(contexto.titularId), listarHistorico(contexto.titularId, pagina),
  ]);
  const agora = new Date();
  const pendentes = autorizacoes.filter((pedido) => pedido.estado === "pendente");
  const anteriores = autorizacoes.filter((pedido) => pedido.estado !== "pendente");
  const erro = parametros.erro === "contexto" ? "A conta acompanhada mudou ou o acompanhamento terminou. Volte para sua conta e abra a tela novamente."
    : parametros.erro === "edicao" ? "A autorização de edição terminou. Nenhuma alteração foi salva." : null;

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <Link href="/ajustes" className="inline-flex min-h-11 items-center text-sm font-semibold text-suave">← Ajustes</Link>
        <h1 className="text-4xl font-black tracking-tight">Acompanhamento</h1>
        <p className="text-suave">Administradores podem acompanhar seus dados gerais de alimentação, treino e evolução. Você controla a autorização para editar e para visualizar fotos.</p>
        <p className="text-sm text-suave">Fotos permanecem bloqueadas até seu aceite específico. A edição sempre tem um prazo escolhido por você.</p>
      </div>
      {erro ? <p role="alert" className="rounded-2xl border-2 border-marca p-4 text-erro">{erro}</p> : null}

      <section aria-labelledby="pedidos" className="space-y-4">
        <h2 id="pedidos" className="text-2xl font-bold">Solicitações{pendentes.length ? ` (${pendentes.length})` : ""}</h2>
        {pendentes.length ? <ul className="space-y-4">
          {pendentes.map((pedido) => <li key={pedido.id} className="rounded-2xl border-2 border-linha p-4">
            <p className="text-lg font-bold">{pedido.administradorNome || "Administrador"}</p>
            <p className="mt-1 font-semibold">{pedido.tipo === "edicao" ? "Solicitou autorização para editar seus dados" : "Solicitou acesso às fotos corporais"}</p>
            <p className="mt-1 text-sm text-suave">{horario.format(pedido.solicitadoEm)} · São Paulo</p>
            <FormularioPedido pedidoId={pedido.id} tipo={pedido.tipo} />
          </li>)}
        </ul> : <p className="text-suave">Nenhuma solicitação pendente.</p>}
      </section>

      <section aria-labelledby="autorizacoes" className="space-y-4">
        <h2 id="autorizacoes" className="text-2xl font-bold">Suas autorizações</h2>
        {anteriores.length ? <ul className="space-y-4">
          {anteriores.map((pedido) => {
            const expirada = pedido.estado === "aceita" && pedido.tipo === "edicao" && (!pedido.expiraEm || pedido.expiraEm <= agora);
            const ativa = pedido.estado === "aceita" && !expirada;
            const estado = expirada ? "Expirada" : { aceita: "Autorizada", recusada: "Recusada", revogada: "Revogada", pendente: "Pendente" }[pedido.estado];
            return <li key={pedido.id} className="rounded-2xl border-2 border-linha p-4">
              <p className="text-lg font-bold">{pedido.administradorNome || "Administrador"}</p>
              <p className="mt-1 font-semibold">{pedido.tipo === "edicao" ? "Edição de dados" : "Visualização de fotos"} · {estado}</p>
              {pedido.tipo === "edicao" && pedido.expiraEm ? <p className="mt-1 text-sm text-suave">Prazo: {horario.format(pedido.expiraEm)} · São Paulo</p> : null}
              {pedido.tipo === "fotos" && ativa ? <p className="mt-1 text-sm text-suave">Válida até você revogar. Revogar bloqueia novas visualizações, mas não apaga fotos já vistas ou salvas.</p> : null}
              {ativa ? <FormularioRevogacao pedidoId={pedido.id} /> : null}
            </li>;
          })}
        </ul> : <p className="text-suave">Você ainda não respondeu a solicitações.</p>}
      </section>

      <section aria-labelledby="historico" className="space-y-4">
        <h2 id="historico" className="text-2xl font-bold">Histórico do acompanhamento</h2>
        <p className="text-sm text-suave">Autor, operação, recurso e horário. Os valores dos seus dados não são copiados para este histórico.</p>
        {historico.length ? <ul className="divide-y divide-linha">
          {historico.map((evento) => <li key={evento.id} className="space-y-1 py-4">
            <p className="font-semibold">{evento.atorNome || "Administrador"}</p>
            <p>{rotulos[evento.operacao] ?? evento.operacao} · {rotulos[evento.recurso] ?? evento.recurso}</p>
            <p className="text-sm text-suave">{horario.format(evento.criadoEm)} · São Paulo</p>
          </li>)}
        </ul> : <p className="text-suave">Nenhuma operação nesta página do histórico.</p>}
        <nav aria-label="Páginas do histórico" className="flex items-center justify-between gap-3">
          {pagina > 1 ? <Link href={`/ajustes/acompanhamento?pagina=${pagina - 1}`} className="inline-flex min-h-12 items-center rounded-full border-2 border-borda px-4 font-semibold">Anterior</Link> : <span />}
          <span className="text-sm text-suave">Página {pagina}</span>
          {historico.length === 20 ? <Link href={`/ajustes/acompanhamento?pagina=${pagina + 1}`} className="inline-flex min-h-12 items-center rounded-full border-2 border-borda px-4 font-semibold">Próxima</Link> : <span />}
        </nav>
      </section>
    </div>
  );
}
