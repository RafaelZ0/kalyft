CREATE TABLE "jornadas_iniciais" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"revisao" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'em_andamento' NOT NULL,
	"etapa" text DEFAULT 'foco' NOT NULL,
	"rascunho" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preferencias" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tutorial" jsonb DEFAULT '{"estado":"nao_iniciado"}'::jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluido_em" timestamp with time zone,
	CONSTRAINT "jornadas_versao_check" CHECK ("jornadas_iniciais"."versao" between 1 and 100),
	CONSTRAINT "jornadas_revisao_check" CHECK ("jornadas_iniciais"."revisao" >= 0),
	CONSTRAINT "jornadas_estado_check" CHECK ("jornadas_iniciais"."estado" in ('em_andamento', 'adiada', 'concluida')),
	CONSTRAINT "jornadas_etapa_check" CHECK ("jornadas_iniciais"."etapa" in ('foco', 'perfil', 'objetivo', 'rotina', 'atividade', 'treino', 'alimentacao', 'revisao', 'inicio')),
	CONSTRAINT "jornadas_conclusao_check" CHECK (("jornadas_iniciais"."estado" = 'concluida') = ("jornadas_iniciais"."concluido_em" is not null)),
	CONSTRAINT "jornadas_rascunho_check" CHECK (jsonb_typeof("jornadas_iniciais"."rascunho") = 'object' and octet_length("jornadas_iniciais"."rascunho"::text) <= 16384),
	CONSTRAINT "jornadas_preferencias_check" CHECK (jsonb_typeof("jornadas_iniciais"."preferencias") = 'object' and octet_length("jornadas_iniciais"."preferencias"::text) <= 8192),
	CONSTRAINT "jornadas_tutorial_check" CHECK (jsonb_typeof("jornadas_iniciais"."tutorial") = 'object' and octet_length("jornadas_iniciais"."tutorial"::text) <= 2048
        and "jornadas_iniciais"."tutorial" ->> 'estado' is not null
        and "jornadas_iniciais"."tutorial" ->> 'estado' in ('nao_iniciado', 'em_andamento', 'pulado', 'concluido'))
);
--> statement-breakpoint
ALTER TABLE "jornadas_iniciais" ADD CONSTRAINT "jornadas_iniciais_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Editado à mão: gatilho de auditoria do acompanhamento, como nas demais tabelas do usuário. A jornada é da conta
-- própria (as Actions da 2B usarão exigirContaPropria).
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.jornadas_iniciais FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
