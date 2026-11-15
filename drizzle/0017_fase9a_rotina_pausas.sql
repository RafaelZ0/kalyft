CREATE TABLE "pausas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pausas_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "pausas_periodo_check" CHECK ("pausas"."fim" >= "pausas"."inicio" and "pausas"."fim" - "pausas"."inicio" < 90 and "pausas"."inicio" >= date '2000-01-01')
);
--> statement-breakpoint
CREATE TABLE "rotina_ocultos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refeicao" text NOT NULL,
	"alimento_base_id" uuid,
	"alimento_usuario_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rotina_ocultos_alimento_check" CHECK (num_nonnulls("rotina_ocultos"."alimento_base_id", "rotina_ocultos"."alimento_usuario_id") = 1),
	CONSTRAINT "rotina_ocultos_refeicao_check" CHECK ("rotina_ocultos"."refeicao" in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia'))
);
--> statement-breakpoint
ALTER TABLE "pausas" ADD CONSTRAINT "pausas_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_ocultos" ADD CONSTRAINT "rotina_ocultos_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_ocultos" ADD CONSTRAINT "rotina_ocultos_alimento_base_id_alimentos_base_id_fk" FOREIGN KEY ("alimento_base_id") REFERENCES "public"."alimentos_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_ocultos" ADD CONSTRAINT "rotina_ocultos_alimento_usuario_id_user_id_alimentos_usuario_id_user_id_fk" FOREIGN KEY ("alimento_usuario_id","user_id") REFERENCES "public"."alimentos_usuario"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pausas_user_inicio_key" ON "pausas" USING btree ("user_id","inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "rotina_ocultos_base_key" ON "rotina_ocultos" USING btree ("user_id","refeicao","alimento_base_id") WHERE "rotina_ocultos"."alimento_base_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rotina_ocultos_usuario_key" ON "rotina_ocultos" USING btree ("user_id","refeicao","alimento_usuario_id") WHERE "rotina_ocultos"."alimento_usuario_id" is not null;--> statement-breakpoint
-- Editado à mão: alterações feitas no acompanhamento (com edição autorizada) ficam no histórico, como nas demais tabelas.
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.rotina_ocultos FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.pausas FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
