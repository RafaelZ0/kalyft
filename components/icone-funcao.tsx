import {
  Activity, Bell, Bookmark, CalendarDays, CalendarRange, CalendarX, Camera, ChartColumn, ChefHat, Copy, Droplet, Dumbbell,
  Footprints, History, ListChecks, PersonStanding, Plus, Scale, ScanBarcode, Settings2, ShieldCheck, Sparkles,
  Syringe, Target, Users, Utensils, type LucideIcon,
} from "lucide-react";
import type { IconeFuncao } from "@/lib/busca-funcoes";

// Um ícone por função, todos da mesma família (Lucide), para manter o estilo do app.
const ICONES: Record<IconeFuncao, LucideIcon> = {
  peso: Scale, semana: CalendarDays, fotos: Camera, meta: Target, historico: History, composicao: PersonStanding,
  aplicacao: Syringe, graficos: ChartColumn, adicionar: Plus, agua: Droplet, barras: ScanBarcode, ia: Sparkles,
  receitas: ChefHat, salvas: Bookmark, copiar: Copy, "meus-alimentos": Utensils, treino: Dumbbell, plano: ListChecks,
  exercicios: Activity, calendario: CalendarRange, falta: CalendarX, "treino-ia": Sparkles, atividade: Footprints,
  passos: Footprints, lembretes: Bell, acompanhamento: ShieldCheck, alunos: Users, conta: Settings2,
};

export function IconeFuncao({ icone, size = 22 }: { icone: IconeFuncao; size?: number }) {
  const Icone = ICONES[icone];
  return <Icone size={size} aria-hidden="true" />;
}
