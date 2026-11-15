CREATE TABLE "inscricoes_push" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inscricoes_push_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "inscricoes_push_endpoint_check" CHECK ("inscricoes_push"."endpoint" like 'https://%' and char_length("inscricoes_push"."endpoint") <= 1000),
	CONSTRAINT "inscricoes_push_chaves_check" CHECK (char_length("inscricoes_push"."p256dh") between 20 and 200 and char_length("inscricoes_push"."auth") between 8 and 100)
);
--> statement-breakpoint
CREATE TABLE "lembretes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"refeicao" text,
	"minuto" integer NOT NULL,
	"dias" integer DEFAULT 127 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"silenciar_feito" boolean DEFAULT true NOT NULL,
	"pausado_ate" date,
	"adiado_para" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lembretes_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "lembretes_unico_key" UNIQUE NULLS NOT DISTINCT("user_id","tipo","refeicao","minuto"),
	CONSTRAINT "lembretes_tipo_check" CHECK (("lembretes"."tipo" = 'refeicao' and "lembretes"."refeicao" is not null and "lembretes"."refeicao" in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia'))
        or ("lembretes"."tipo" in ('agua', 'peso', 'treino') and "lembretes"."refeicao" is null)),
	CONSTRAINT "lembretes_minuto_check" CHECK ("lembretes"."minuto" between 0 and 1425 and "lembretes"."minuto" % 15 = 0),
	CONSTRAINT "lembretes_dias_check" CHECK ("lembretes"."dias" between 1 and 127),
	CONSTRAINT "lembretes_pausado_check" CHECK ("lembretes"."pausado_ate" is null or "lembretes"."pausado_ate" >= date '2000-01-01')
);
--> statement-breakpoint
CREATE TABLE "lembretes_envios" (
	"lembrete_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"minuto" integer NOT NULL,
	"adiado" boolean DEFAULT false NOT NULL,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lembretes_envios_lembrete_id_data_minuto_adiado_pk" PRIMARY KEY("lembrete_id","data","minuto","adiado"),
	CONSTRAINT "lembretes_envios_minuto_check" CHECK ("lembretes_envios"."minuto" between 0 and 1439),
	CONSTRAINT "lembretes_envios_data_check" CHECK ("lembretes_envios"."data" >= date '2000-01-01')
);
--> statement-breakpoint
ALTER TABLE "inscricoes_push" ADD CONSTRAINT "inscricoes_push_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes_envios" ADD CONSTRAINT "lembretes_envios_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes_envios" ADD CONSTRAINT "lembretes_envios_lembrete_id_user_id_lembretes_id_user_id_fk" FOREIGN KEY ("lembrete_id","user_id") REFERENCES "public"."lembretes"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inscricoes_push_endpoint_key" ON "inscricoes_push" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "inscricoes_push_user" ON "inscricoes_push" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lembretes_user" ON "lembretes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lembretes_envios_enviado" ON "lembretes_envios" USING btree ("enviado_em");--> statement-breakpoint
-- Editado à mão: gatilho de auditoria do acompanhamento, como nas demais tabelas do usuário. Lembretes e
-- inscrições são da conta própria (o app recusa no acompanhamento antes de chegar aqui).
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.inscricoes_push FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.lembretes FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.lembretes_envios FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
