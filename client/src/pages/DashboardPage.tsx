import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Clock3, ListTodo, Plus, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "wouter";

const tooltipStyle = { borderRadius: 12, border: "1px solid #e6e9f2", boxShadow: "0 12px 28px rgba(15,23,42,.10)", fontSize: 12 };

export default function DashboardPage() {
  const dashboard = trpc.dashboard.summary.useQuery(undefined, { refetchInterval: 30_000 });
  const study = trpc.study.stats.useQuery(undefined, { refetchInterval: 30_000 });
  const data = dashboard.data;

  if (dashboard.isLoading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-[22px] bg-slate-200/70 dark:bg-white/8" />)}</div>;
  if (!data) return <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/15 dark:bg-[#181a25]"><p className="font-bold">Não foi possível carregar o seu panorama.</p><Button className="mt-4" onClick={() => dashboard.refetch()}>Tentar novamente</Button></section>;

  const hours = ((study.data?.weekMinutes ?? 0) / 60).toFixed(1);
  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6CFF]">Visão geral</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Bom ritmo para continuar.</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Acompanhe o que importa hoje, sem perder o compasso.</p></div>
        <Link href="/activities"><Button className="rounded-xl"><Plus className="size-4" />Ver atividades</Button></Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Atividades" value={data.summary.total} caption="no quadro da turma" icon={ListTodo} />
        <MetricCard label="Concluídas" value={data.summary.completed} caption={`${data.summary.progress}% do seu progresso`} icon={CheckCircle2} tone="mint" />
        <MetricCard label="Pendentes" value={data.summary.pending} caption="aguardando seu próximo passo" icon={CircleDashed} tone="amber" />
        <MetricCard label="Atrasadas" value={data.summary.overdue} caption={data.summary.overdue ? "vale priorizar agora" : "nenhuma pendência crítica"} icon={AlertTriangle} tone="rose" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25] sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Prazos em movimento</p><h2 className="mt-1 text-lg font-extrabold">Próximas atividades</h2></div><Link href="/activities" className="text-xs font-bold text-[#5B6CFF] hover:underline">Ver todas</Link></div>
          {data.upcoming.length ? <div className="divide-y divide-slate-100 dark:divide-white/8">{data.upcoming.map(item => { const late = item.dueDate && item.dueDate < new Date(); return <div className="flex items-center gap-3 py-3.5" key={item.id}><span className="h-10 w-1.5 rounded-full" style={{ background: late ? "#D94A66" : item.subject.color }} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{item.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.priority === "alta" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-300"}`}>{item.priority}</span></div><p className="mt-1 text-xs text-slate-500">{item.subject.name} · {item.estimatedMinutes} min</p></div><div className="text-right"><p className={`text-xs font-bold ${late ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>{item.dueDate && formatDistanceToNow(item.dueDate, { addSuffix: true, locale: ptBR })}</p><p className="mt-1 text-[11px] text-slate-400">{item.dueDate && format(item.dueDate, "dd MMM", { locale: ptBR })}</p></div></div>; })}</div> : <div className="grid min-h-48 place-items-center rounded-2xl bg-slate-50 p-6 text-center dark:bg-white/5"><div><CheckCircle2 className="mx-auto size-8 text-[#74D7BA]" /><p className="mt-3 text-sm font-bold">Seu quadro está livre.</p><p className="mt-1 text-xs text-slate-500">Quando houver novos prazos, eles aparecem aqui.</p></div></div>}
        </article>
        <article className="rounded-[24px] bg-[#202657] p-6 text-white"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-2xl bg-white/10"><Clock3 className="size-5 text-[#74D7BA]" /></span><span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider">esta semana</span></div><p className="mt-7 text-sm font-medium text-[#C4C9F1]">Tempo de foco acumulado</p><p className="mt-1 font-mono text-5xl font-black tracking-tighter">{hours}<span className="ml-1 text-lg text-[#B6BEFF]">h</span></p><p className="mt-5 text-xs leading-5 text-[#C4C9F1]">{study.data?.streak ? `Sequência atual: ${study.data.streak} dia${study.data.streak > 1 ? "s" : ""}.` : "Comece um foco hoje e construa sua sequência."}</p><Link href="/focus" className="mt-6 flex items-center gap-2 text-sm font-bold text-[#74D7BA] hover:text-white">Abrir modo foco <ArrowRight className="size-4" /></Link></article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25]"><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Distribuição</p><h2 className="mt-1 font-extrabold">Atividades por matéria</h2></div><div className="h-52">{data.activityDistribution.length ? <ResponsiveContainer><PieChart><Pie data={data.activityDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={4}>{data.activityDistribution.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-400">Crie matérias para visualizar a distribuição.</div>}</div><div className="flex flex-wrap gap-x-3 gap-y-2">{data.activityDistribution.map(item => <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500" key={item.name}><i className="size-2 rounded-full" style={{ background: item.color }} />{item.name}</span>)}</div></article>
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25]"><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Consistência</p><h2 className="mt-1 font-extrabold">Conclusões na semana</h2></div><div className="h-60"><ResponsiveContainer><BarChart data={data.completionSeries}><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="concluídas" radius={[8, 8, 2, 2]} fill="#5B6CFF" /></BarChart></ResponsiveContainer></div></article>
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25] lg:col-span-2 xl:col-span-1"><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Foco</p><h2 className="mt-1 font-extrabold">Horas de estudo</h2></div><div className="h-60"><ResponsiveContainer><BarChart data={data.studySeries}><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="horas" radius={[8, 8, 2, 2]} fill="#74D7BA" /></BarChart></ResponsiveContainer></div></article>
      </section>

      <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-white/8 dark:bg-[#181a25] sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Mapa de progresso</p><h2 className="mt-1 text-lg font-extrabold">Matérias em andamento</h2></div><TrendingUp className="size-5 text-[#5B6CFF]" /></div>{data.subjectProgress.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.subjectProgress.map(subject => <div key={subject.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"><div className="flex justify-between gap-3"><span className="font-bold">{subject.name}</span><span className="font-mono text-xs font-bold" style={{ color: subject.color }}>{subject.progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${subject.progress}%`, background: subject.color }} /></div><p className="mt-2 text-xs text-slate-500">{subject.completed} de {subject.total} atividades concluídas</p></div>)}</div> : <p className="text-sm text-slate-500">Adicione uma matéria para acompanhar o progresso dela aqui.</p>}</section>
    </div>
  );
}
