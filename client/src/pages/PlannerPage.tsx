import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ClipboardPenLine, Flag, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PlannerPage() {
  const note = trpc.planner.note.useQuery();
  const goal = trpc.planner.goal.useQuery();
  const study = trpc.study.stats.useQuery();
  const dashboard = trpc.dashboard.summary.useQuery();
  const utils = trpc.useUtils();
  const [noteText, setNoteText] = useState("");
  const [minutes, setMinutes] = useState(120);
  const [sessions, setSessions] = useState(4);
  useEffect(() => { if (note.data) setNoteText(note.data.content); }, [note.data]);
  useEffect(() => { if (goal.data) { setMinutes(goal.data.targetMinutes); setSessions(goal.data.targetSessions); } }, [goal.data]);
  const saveNote = trpc.planner.saveNote.useMutation({ onSuccess: () => { utils.planner.note.invalidate(); toast.success("Nota salva."); } });
  const saveGoal = trpc.planner.saveGoal.useMutation({ onSuccess: () => { utils.planner.goal.invalidate(); toast.success("Meta semanal atualizada."); } });
  const minutesDone = study.data?.weekMinutes ?? 0;
  const sessionsDone = study.data?.weekSessions ?? 0;
  const goalPercent = Math.min(100, Math.round((minutesDone / Math.max(1, minutes)) * 100));

  return <div className="space-y-6"><header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6CFF]">Planejamento pessoal</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Planner</h1><p className="mt-2 text-sm text-slate-500">Tire as ideias da cabeça e transforme-as em um ritmo possível.</p></header>
    <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]"><article className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25] sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Seu espaço</p><h2 className="mt-1 text-lg font-extrabold">Notas rápidas</h2></div><ClipboardPenLine className="size-5 text-[#5B6CFF]" /></div><Textarea value={noteText} onChange={event => setNoteText(event.target.value)} className="mt-5 min-h-64 resize-none border-0 bg-slate-50 p-4 text-sm leading-6 shadow-none focus-visible:ring-0 dark:bg-white/5" placeholder="Ideias, dúvidas, pontos para revisar..." /><div className="mt-4 flex justify-end"><Button onClick={() => saveNote.mutate({ content: noteText })} disabled={saveNote.isPending}><Save className="size-4" />Salvar nota</Button></div></article>
      <article className="rounded-[24px] bg-[#202657] p-6 text-white"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#B6BEFF]">Meta da semana</p><h2 className="mt-1 text-xl font-extrabold">Foco sustentável</h2></div><Flag className="size-6 text-[#74D7BA]" /></div><div className="mt-8 rounded-2xl bg-white/8 p-4"><div className="flex justify-between text-sm font-bold"><span>{minutesDone} de {minutes} min</span><span className="text-[#74D7BA]">{goalPercent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#74D7BA]" style={{ width: `${goalPercent}%` }} /></div><p className="mt-3 text-xs text-[#C4C9F1]">{sessionsDone} de {sessions} sessões registradas.</p></div><div className="mt-5 grid grid-cols-2 gap-3"><label className="text-xs font-bold text-[#C4C9F1]">Minutos<Input type="number" min={15} max={2400} value={minutes} onChange={event => setMinutes(Number(event.target.value))} className="mt-2 border-white/15 bg-white/10 text-white" /></label><label className="text-xs font-bold text-[#C4C9F1]">Sessões<Input type="number" min={1} max={50} value={sessions} onChange={event => setSessions(Number(event.target.value))} className="mt-2 border-white/15 bg-white/10 text-white" /></label></div><Button className="mt-5 w-full bg-white text-[#202657] hover:bg-[#E7F8F1]" onClick={() => saveGoal.mutate({ targetMinutes: minutes, targetSessions: sessions })} disabled={saveGoal.isPending}><Check className="size-4" />Atualizar meta</Button></article></section>
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25] sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-400">Agenda rápida</p><h2 className="mt-1 text-lg font-extrabold">Próximos prazos</h2></div><CalendarDays className="size-5 text-[#5B6CFF]" /></div>{dashboard.data?.upcoming.length ? <div className="grid gap-3 md:grid-cols-2">{dashboard.data.upcoming.map(item => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><span className="h-9 w-1 rounded-full" style={{ background: item.subject.color }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject.name} · {item.dueDate && format(item.dueDate, "EEEE, dd MMM", { locale: ptBR })}</p></div></div>)}</div> : <p className="text-sm text-slate-500">Nenhum prazo agendado por enquanto.</p>}</section>
  </div>;
}
