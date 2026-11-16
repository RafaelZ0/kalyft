import { ChevronLeft, ChevronRight, Clock, Dumbbell, Moon, Play, Plus, Sparkles } from "lucide-react";
import { FormDados, SomenteContaPropria } from "@/components/contexto-dados";
import Link from "next/link";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarTreinos, obterAgenda, obterSessao, obterTrocas, planoAtivo } from "@/lib/dal/treino";
import { carregarTreinoDoDia } from "@/lib/dal/treino-do-dia";
import { hojeSaoPaulo, rotuloDia, somarDias } from "@/lib/datas";
import { formatarTempo, treinoDoDia } from "@/lib/treino";
import { minutosEstimados } from "@/lib/treino-adaptado";
import { ROTULOS_MOTIVO, dataAteHoje, MOTIVOS } from "@/lib/validacao/treino";
import { desfazerRegistroDoDia, trocarTreinoDoDia } from "./actions";

export const metadata = { title: "Treino · Kalyft" };

export default async function PaginaTreino(props: PageProps<"/treino">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).data;
  const data = dataAteHoje.safeParse(typeof pedido === "string" ? pedido : hoje).data ?? hoje;

  const plano = await planoAtivo(userId);
  const links = (
    <nav aria-label="Treino" className="flex flex-wrap gap-2 text-sm font-semibold">
      {[
        ["/treino/calendario", "Calendário"],
        ["/treino/plano", "Plano"],
        ["/treino/exercicios", "Exercícios"],
      ].map(([href, rotulo]) => (
        <Link key={href} href={href} className="action-secondary whitespace-nowrap">
          {rotulo}
        </Link>
      ))}
    </nav>
  );

  if (!plano) {
    return (
      <div className="page-stack">
        <h1 className="page-heading">Treino</h1>
        <section className="app-card space-y-5" data-tour="treino">
          <span className="icon-badge"><Dumbbell size={22} aria-hidden="true" /></span>
          <div className="space-y-2">
            <h2 className="section-heading">Seu próximo passo começa aqui</h2>
            <p className="page-intro">Crie um plano no seu ritmo ou traga o treino que você já recebeu.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SomenteContaPropria><Link href="/treino/ia" className="action-primary gap-2"><Sparkles size={18} aria-hidden="true" />Criar ou importar com IA</Link></SomenteContaPropria>
            <Link href="/treino/plano" className="action-secondary gap-2"><Plus size={18} aria-hidden="true" />Montar manualmente</Link>
          </div>
          <p className="text-sm text-suave">Organize os exercícios e os dias da semana. Você pode ajustar seu plano depois.</p>
        </section>
        {links}
      </div>
    );
  }

  const [agenda, trocas, treinos, sessao] = await Promise.all([
    obterAgenda(userId),
    obterTrocas(userId, data, data),
    listarTreinos(userId, plano.id),
    obterSessao(userId, data),
  ]);
  const treinoId = treinoDoDia(data, agenda, trocas);
  const dia = treinoId ? await carregarTreinoDoDia(userId, plano, data) : null;
  const treino = dia?.treino ?? null;
  // Itens do dia já com a adaptação aplicada (séries reduzidas, pulados fora, trocas).
  const itens = (dia?.doDia ?? []).map((i) => ({
    ...i,
    nomeDoDia: i.exercicioEscolhido ? (dia!.exercicios.find((e) => e.id === i.exercicioEscolhido)?.nome ?? i.exercicio.nome) : i.exercicio.nome,
  }));
  const pulados = dia ? dia.completos.length - dia.doDia.length : 0;

  return (
    <div className="page-stack">
      <header className="space-y-4" data-tour="treino">
        <h1 className="page-heading">Treino</h1>
        <p className="page-intro">Movimento que cabe na sua rotina.</p>
        <nav aria-label="Dia" className="app-card flex items-center justify-between">
          <Link href={`/treino?data=${somarDias(data, -1)}`} aria-label="Dia anterior" className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-borda text-xl font-bold">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <div className="text-center">
            <p className="text-xl font-bold">{rotuloDia(data, hoje)}</p>
            {data !== hoje ? (
              <Link href="/treino" className="text-sm font-semibold text-marca underline">
                Voltar para hoje
              </Link>
            ) : null}
          </div>
          {data < hoje ? (
            <Link href={`/treino?data=${somarDias(data, 1)}`} aria-label="Próximo dia" className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-borda text-xl font-bold">
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          ) : (
            <span className="min-h-12 min-w-12" aria-hidden="true" />
          )}
        </nav>
        {links}
      </header>

      {sessao ? (
        <section className="app-card space-y-3" aria-live="polite">
          {sessao.status === "feito" ? (
            <p className="text-lg font-bold text-ok"><span aria-hidden="true">✓ </span>Treino feito</p>
          ) : (
            <p className="text-lg font-bold text-aviso"><span aria-hidden="true">! </span>
              Faltou{sessao.motivo ? `: ${ROTULOS_MOTIVO[sessao.motivo as (typeof MOTIVOS)[number]] ?? sessao.motivo}` : ""}
            </p>
          )}
          {sessao.observacao ? <p className="text-suave">{sessao.observacao}</p> : null}
          <FormDados action={desfazerRegistroDoDia}>
            <input type="hidden" name="data" value={data} />
            <button type="submit" className="min-h-11 text-sm font-semibold text-suave underline">
              Desfazer o registro deste dia
            </button>
          </FormDados>
        </section>
      ) : null}

      {treino ? (
        <section aria-labelledby="treino-dia" className="app-card space-y-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-suave"><Dumbbell size={18} aria-hidden="true" />Seu treino do dia</p>
            <h2 id="treino-dia" className="text-2xl font-semibold tracking-tight">{treino.nome}</h2>
            {treino.foco ? <p className="text-suave">{treino.foco}</p> : null}
            {itens.length ? (
              <p className="mt-2 text-sm text-suave">
                {dia?.adaptacao ? <span className="mr-2 rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca">Adaptado para hoje</span> : null}
                cerca de {minutosEstimados(itens)} min (estimativa){pulados > 0 ? ` · ${pulados} ${pulados === 1 ? "exercício pulado" : "exercícios pulados"}` : ""}
              </p>
            ) : null}
          </div>
          {itens.length === 0 ? (
            <p className="text-suave">
              Este treino ainda não tem exercícios. <Link href="/treino/plano" className="underline">Adicionar no plano</Link>
            </p>
          ) : (
            <ol className="divide-y divide-linha">
              {itens.map((i) => (
                <li key={i.id} className="py-4">
                  <p className="font-semibold">{i.nomeDoDia}</p>
                  {i.exercicioEscolhido ? <p className="text-xs text-suave">no lugar de {i.exercicio.nome}</p> : null}
                  <p className="text-sm text-suave">
                    {i.series} × {i.repsMin === i.repsMax ? i.repsMin : `${i.repsMin}–${i.repsMax}`}
                    {i.exercicio.medida === "segundos" ? " s" : ""} · descanso {formatarTempo(i.descansoS)}
                    {i.exercicio.unilateral ? " · cada lado" : ""}
                  </p>
                  {i.observacao ? <p className="text-sm text-suave">{i.observacao}</p> : null}
                </li>
              ))}
            </ol>
          )}
          <div className="grid gap-3">
            <Link
              href={`/treino/sessao?data=${data}`}
              className="action-primary gap-2"
            >
              <Play size={18} aria-hidden="true" />{sessao?.status === "feito" ? "Continuar treino" : "Começar treino"}
            </Link>
            {sessao?.status !== "faltou" ? (
              <Link href={`/treino/adaptar?data=${data}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-borda font-semibold">
                <Clock size={18} aria-hidden="true" />{dia?.adaptacao ? "Ajustar a adaptação" : "Adaptar o treino de hoje"}
              </Link>
            ) : null}
            {!sessao ? (
              <Link href={`/treino/falta?data=${data}`} className="flex min-h-12 items-center justify-center rounded-xl border border-borda font-semibold">
                Não vou treinar
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="app-card space-y-3">
          <span className="icon-badge"><Moon size={22} aria-hidden="true" /></span>
          <h2 className="section-heading">Dia de descanso</h2>
          <p className="text-suave">Recuperar também faz parte da rotina. Se preferir treinar, escolha um treino abaixo.</p>
        </section>
      )}

      <FormDados action={trocarTreinoDoDia} className="app-card space-y-3">
        <input type="hidden" name="data" value={data} />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Trocar o treino deste dia</span>
          <select
            name="treinoId"
            defaultValue={treinoId ?? "descanso"}
            className="min-h-12 w-full rounded-xl border border-borda bg-superficie px-3 text-lg font-semibold"
          >
            {treinos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
            <option value="descanso">Descanso</option>
            <option value="agenda">Voltar ao da agenda</option>
          </select>
        </label>
        <button type="submit" className="min-h-12 w-full rounded-xl border border-borda font-semibold">
          Trocar
        </button>
      </FormDados>
    </div>
  );
}
