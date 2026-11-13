CREATE TABLE "acompanhamento_autorizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"administrador_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"solicitado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"decidido_em" timestamp with time zone,
	"expira_em" timestamp with time zone,
	"revogado_em" timestamp with time zone,
	CONSTRAINT "acompanhamento_autorizacoes_par_check" CHECK ("acompanhamento_autorizacoes"."administrador_id" <> "acompanhamento_autorizacoes"."aluno_id"),
	CONSTRAINT "acompanhamento_autorizacoes_tipo_check" CHECK ("acompanhamento_autorizacoes"."tipo" in ('edicao', 'fotos')),
	CONSTRAINT "acompanhamento_autorizacoes_estado_check" CHECK ("acompanhamento_autorizacoes"."estado" in ('pendente', 'aceita', 'recusada', 'revogada')),
	CONSTRAINT "acompanhamento_autorizacoes_prazo_check" CHECK ("acompanhamento_autorizacoes"."tipo" <> 'edicao' or "acompanhamento_autorizacoes"."estado" <> 'aceita' or ("acompanhamento_autorizacoes"."expira_em" is not null and "acompanhamento_autorizacoes"."decidido_em" is not null and "acompanhamento_autorizacoes"."expira_em" > "acompanhamento_autorizacoes"."decidido_em"))
);
--> statement-breakpoint
CREATE TABLE "acompanhamento_contextos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"administrador_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"sessao_hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone DEFAULT now() + interval '12 hours' NOT NULL,
	"encerrado_em" timestamp with time zone,
	CONSTRAINT "acompanhamento_contextos_par_check" CHECK ("acompanhamento_contextos"."administrador_id" <> "acompanhamento_contextos"."aluno_id"),
	CONSTRAINT "acompanhamento_contextos_hash_check" CHECK ("acompanhamento_contextos"."sessao_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "acompanhamento_contextos_prazo_check" CHECK ("acompanhamento_contextos"."expira_em" > "acompanhamento_contextos"."criado_em" and "acompanhamento_contextos"."expira_em" <= "acompanhamento_contextos"."criado_em" + interval '12 hours')
);
--> statement-breakpoint
CREATE TABLE "acompanhamento_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ator_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"autorizacao_id" uuid,
	"contexto_id" uuid,
	"operacao" text NOT NULL,
	"recurso" text NOT NULL,
	"recurso_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acompanhamento_eventos_operacao_check" CHECK (char_length("acompanhamento_eventos"."operacao") between 1 and 40),
	CONSTRAINT "acompanhamento_eventos_recurso_check" CHECK (char_length("acompanhamento_eventos"."recurso") between 1 and 80),
	CONSTRAINT "acompanhamento_eventos_recurso_id_check" CHECK (char_length("acompanhamento_eventos"."recurso_id") <= 200)
);
--> statement-breakpoint
ALTER TABLE "acompanhamento_autorizacoes" ADD CONSTRAINT "acompanhamento_autorizacoes_administrador_id_perfis_user_id_fk" FOREIGN KEY ("administrador_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acompanhamento_autorizacoes" ADD CONSTRAINT "acompanhamento_autorizacoes_aluno_id_perfis_user_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acompanhamento_contextos" ADD CONSTRAINT "acompanhamento_contextos_administrador_id_perfis_user_id_fk" FOREIGN KEY ("administrador_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acompanhamento_contextos" ADD CONSTRAINT "acompanhamento_contextos_aluno_id_perfis_user_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acompanhamento_eventos" ADD CONSTRAINT "acompanhamento_eventos_ator_id_perfis_user_id_fk" FOREIGN KEY ("ator_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acompanhamento_eventos" ADD CONSTRAINT "acompanhamento_eventos_aluno_id_perfis_user_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acompanhamento_eventos" ADD CONSTRAINT "acompanhamento_eventos_autorizacao_id_acompanhamento_autorizacoes_id_fk" FOREIGN KEY ("autorizacao_id") REFERENCES "public"."acompanhamento_autorizacoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acompanhamento_eventos" ADD CONSTRAINT "acompanhamento_eventos_contexto_id_acompanhamento_contextos_id_fk" FOREIGN KEY ("contexto_id") REFERENCES "public"."acompanhamento_contextos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acompanhamento_autorizacoes_admin" ON "acompanhamento_autorizacoes" USING btree ("administrador_id","aluno_id","tipo");--> statement-breakpoint
CREATE INDEX "acompanhamento_autorizacoes_aluno" ON "acompanhamento_autorizacoes" USING btree ("aluno_id","solicitado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "acompanhamento_autorizacoes_pendente" ON "acompanhamento_autorizacoes" USING btree ("administrador_id","aluno_id","tipo") WHERE "acompanhamento_autorizacoes"."estado" = 'pendente';--> statement-breakpoint
CREATE INDEX "acompanhamento_contextos_admin" ON "acompanhamento_contextos" USING btree ("administrador_id");--> statement-breakpoint
CREATE INDEX "acompanhamento_contextos_aluno" ON "acompanhamento_contextos" USING btree ("aluno_id");--> statement-breakpoint
CREATE INDEX "acompanhamento_eventos_aluno" ON "acompanhamento_eventos" USING btree ("aluno_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "acompanhamento_eventos_ator" ON "acompanhamento_eventos" USING btree ("ator_id");
--> statement-breakpoint
-- Um único lock por par/escopo serializa aceite, revogação e escrita.
CREATE FUNCTION public.acompanhamento_travar(p_admin uuid, p_aluno uuid, p_tipo text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_admin::text || ':' || p_aluno::text || ':' || p_tipo, 0));
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.acompanhamento_solicitar(p_admin uuid, p_aluno uuid, p_tipo text, p_chave text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_contagem integer;
BEGIN
  IF p_tipo NOT IN ('edicao', 'fotos') OR p_admin = p_aluno THEN
    RAISE EXCEPTION 'Solicitação inválida.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.acompanhamento_travar(p_admin, p_aluno, p_tipo);
  IF NOT EXISTS (SELECT 1 FROM public.acessos WHERE user_id = p_admin AND status = 'aprovado')
     OR NOT EXISTS (SELECT 1 FROM public.acessos WHERE user_id = p_aluno AND status = 'aprovado') THEN
    RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_id FROM public.acompanhamento_autorizacoes
    WHERE administrador_id = p_admin AND aluno_id = p_aluno AND tipo = p_tipo AND estado = 'pendente';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.limites (chave, janela, contagem)
    VALUES (p_chave, date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', 1)
    ON CONFLICT (chave, janela) DO UPDATE SET contagem = public.limites.contagem + 1
    RETURNING contagem INTO v_contagem;
  IF v_contagem > 10 THEN
    RAISE EXCEPTION 'Limite diário de solicitações atingido.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.acompanhamento_autorizacoes (administrador_id, aluno_id, tipo)
    VALUES (p_admin, p_aluno, p_tipo) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.acompanhamento_decidir(p_aluno uuid, p_pedido uuid, p_decisao text, p_expira timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_pedido public.acompanhamento_autorizacoes%ROWTYPE;
BEGIN
  SELECT * INTO v_pedido FROM public.acompanhamento_autorizacoes WHERE id = p_pedido AND aluno_id = p_aluno;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.acompanhamento_travar(v_pedido.administrador_id, p_aluno, v_pedido.tipo);
  SELECT * INTO v_pedido FROM public.acompanhamento_autorizacoes WHERE id = p_pedido AND aluno_id = p_aluno FOR UPDATE;
  IF v_pedido.estado <> 'pendente' THEN RETURN false; END IF;
  IF p_decisao NOT IN ('aceitar', 'recusar') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
  IF p_decisao = 'aceitar' AND v_pedido.tipo = 'edicao' AND (p_expira IS NULL OR p_expira <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Escolha um prazo futuro para edição.' USING ERRCODE = '22007';
  END IF;
  IF p_decisao = 'aceitar' THEN
    UPDATE public.acompanhamento_autorizacoes SET estado = 'revogada', revogado_em = clock_timestamp()
      WHERE administrador_id = v_pedido.administrador_id AND aluno_id = p_aluno AND tipo = v_pedido.tipo AND estado = 'aceita';
  END IF;
  UPDATE public.acompanhamento_autorizacoes SET
    estado = CASE WHEN p_decisao = 'aceitar' THEN 'aceita' ELSE 'recusada' END,
    decidido_em = clock_timestamp(),
    expira_em = CASE WHEN p_decisao = 'aceitar' AND tipo = 'edicao' THEN p_expira ELSE NULL END
    WHERE id = p_pedido AND aluno_id = p_aluno;
  RETURN true;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.acompanhamento_revogar(p_aluno uuid, p_pedido uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_pedido public.acompanhamento_autorizacoes%ROWTYPE;
BEGIN
  SELECT * INTO v_pedido FROM public.acompanhamento_autorizacoes WHERE id = p_pedido AND aluno_id = p_aluno;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.acompanhamento_travar(v_pedido.administrador_id, p_aluno, v_pedido.tipo);
  UPDATE public.acompanhamento_autorizacoes SET estado = 'revogada', revogado_em = clock_timestamp()
    WHERE id = p_pedido AND aluno_id = p_aluno AND estado = 'aceita';
  RETURN FOUND;
END;
$$;
--> statement-breakpoint
-- Nunca toma o lugar da identidade real: a DAL confere ADMIN_EMAILS na requisição.
-- A função revalida sessão/contexto, aprovação e concessão no relógio do banco.
CREATE FUNCTION public.acompanhamento_validar(p_contexto uuid, p_ator uuid, p_titular uuid, p_sessao_hash text, p_operacao text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_autorizacao uuid;
BEGIN
  IF p_operacao IS NULL OR char_length(p_operacao) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Operação de acompanhamento inválida.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.acompanhamento_travar(p_ator, p_titular, 'edicao');
  IF NOT EXISTS (
    SELECT 1 FROM public.acompanhamento_contextos c
      JOIN public.acessos a ON a.user_id = c.administrador_id AND a.status = 'aprovado'
      JOIN public.acessos t ON t.user_id = c.aluno_id AND t.status = 'aprovado'
      WHERE c.id = p_contexto AND c.administrador_id = p_ator AND c.aluno_id = p_titular
        AND c.sessao_hash = p_sessao_hash AND c.encerrado_em IS NULL AND c.expira_em > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'A conta acompanhada mudou. Atualize a página antes de continuar.' USING ERRCODE = '42501';
  END IF;
    SELECT id INTO v_autorizacao FROM public.acompanhamento_autorizacoes
      WHERE administrador_id = p_ator AND aluno_id = p_titular AND tipo = 'edicao' AND estado = 'aceita'
        AND expira_em > clock_timestamp()
      ORDER BY solicitado_em DESC LIMIT 1;
    IF v_autorizacao IS NULL THEN
      RAISE EXCEPTION 'A autorização terminou. Nenhuma alteração foi salva.' USING ERRCODE = '42501';
    END IF;
  -- O driver ativa esta primitiva somente dentro de uma Action de escrita.
  PERFORM set_config('kalyft.ator_id', p_ator::text, true);
  PERFORM set_config('kalyft.titular_id', p_titular::text, true);
  PERFORM set_config('kalyft.contexto_id', p_contexto::text, true);
  PERFORM set_config('kalyft.autorizacao_id', coalesce(v_autorizacao::text, ''), true);
  PERFORM set_config('kalyft.operacao', 'edicao', true);
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.acompanhamento_auditar()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  v_ator uuid := nullif(current_setting('kalyft.ator_id', true), '')::uuid;
  v_titular uuid := nullif(current_setting('kalyft.titular_id', true), '')::uuid;
  v_autorizacao uuid := nullif(current_setting('kalyft.autorizacao_id', true), '')::uuid;
  v_antes jsonb;
  v_depois jsonb;
  v_recurso_id text;
BEGIN
  IF v_ator IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN v_antes := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_depois := to_jsonb(NEW); END IF;
  IF v_titular IS NULL OR (v_antes IS NOT NULL AND (v_antes->>'user_id')::uuid IS DISTINCT FROM v_titular)
     OR (v_depois IS NOT NULL AND (v_depois->>'user_id')::uuid IS DISTINCT FROM v_titular) THEN
    RAISE EXCEPTION 'Titular divergente do contexto de acompanhamento.' USING ERRCODE = '42501';
  END IF;
  IF current_setting('kalyft.operacao', true) IS DISTINCT FROM 'edicao'
     OR NOT EXISTS (SELECT 1 FROM public.acompanhamento_autorizacoes WHERE id = v_autorizacao
        AND administrador_id = v_ator AND aluno_id = v_titular AND tipo = 'edicao'
        AND estado = 'aceita' AND expira_em > clock_timestamp()) THEN
    RAISE EXCEPTION 'Você está apenas acompanhando. Solicite autorização para alterar.' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME IN ('fotos_corpo', 'aplicacoes', 'tokens_api', 'passos_dia', 'uso_ia', 'relatorios_semanais') THEN
    RAISE EXCEPTION 'Recurso exclusivo da conta própria.' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'perfis' AND (TG_OP <> 'UPDATE'
      OR v_antes->'dia_aplicacao' IS DISTINCT FROM v_depois->'dia_aplicacao'
      OR v_antes->'ia_aceite_versao' IS DISTINCT FROM v_depois->'ia_aceite_versao'
      OR v_antes->'ia_aceite_em' IS DISTINCT FROM v_depois->'ia_aceite_em') THEN
    RAISE EXCEPTION 'Configuração exclusiva da conta própria.' USING ERRCODE = '42501';
  END IF;
  v_recurso_id := coalesce(v_depois->>'id', v_antes->>'id', v_titular::text);
  INSERT INTO public.acompanhamento_eventos(ator_id, aluno_id, autorizacao_id, contexto_id, operacao, recurso, recurso_id)
    VALUES (v_ator, v_titular, v_autorizacao, nullif(current_setting('kalyft.contexto_id', true), '')::uuid,
      TG_OP, TG_TABLE_NAME, v_recurso_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.perfis FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.alimentos_usuario FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.medidas FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.registros_alimentares FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.favoritos FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.refeicoes_salvas FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.refeicoes_salvas_itens FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.exercicios FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.planos_treino FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.treinos FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.treino_exercicios FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.treino_substitutos FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.agenda_treino FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.trocas_treino FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.sessoes_treino FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.series FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.agua FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.pesagens FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.aplicacoes FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.uso_ia FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.gasto_estimado FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.projecoes_peso FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.passos_dia FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.tokens_api FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.relatorios_semanais FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.receitas FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.receita_itens FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();

--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.fotos_corpo FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
