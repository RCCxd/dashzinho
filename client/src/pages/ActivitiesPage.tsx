import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Circle, ExternalLink, Filter, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const types = ["tarefa", "prova", "trabalho", "projeto"] as const;
const priorities = ["baixa", "media", "alta"] as const;
const statuses = ["pendente", "em_andamento", "concluida"] as const;
type ActivityType = (typeof types)[number];
type Priority = (typeof priorities)[number];
type Status = (typeof statuses)[number];
type EditActivity = { id: number; subjectId: number; title: string; description: string | null; type: ActivityType; priority: Priority; status: Status; dueDate: Date | null; resourceUrl: string | null; estimatedMinutes: number };

type FormState = { subjectId: number; title: string; description: string; type: ActivityType; priority: Priority; status: Status; dueDate: string; resourceUrl: string; estimatedMinutes: number };
const blankForm = (subjectId = 0): FormState => ({ subjectId, title: "", description: "", type: "tarefa", priority: "media", status: "pendente", dueDate: "", resourceUrl: "", estimatedMinutes: 30 });

function FieldLabel({ children }: { children: string }) { return <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{children}</label>; }

export default function ActivitiesPage() {
  const me = trpc.auth.me.useQuery();
  const subjects = trpc.subjects.list.useQuery();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"todas" | "concluidas" | "pendentes" | "atrasadas">("todas");
  const [subjectId, setSubjectId] = useState("todas");
  const [type, setType] = useState("todas");
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [deadline, setDeadline] = useState("todas");
  const listInput = { search: search || undefined, state, subjectId: subjectId === "todas" ? undefined : Number(subjectId), type: type === "todas" ? undefined : type as ActivityType, priority: priorityFilter === "todas" ? undefined : priorityFilter as Priority };
  const activities = trpc.activities.list.useQuery(listInput);
  const utils = trpc.useUtils();
  const toggle = trpc.completions.toggle.useMutation({
    onMutate: async ({ activityId }) => {
      await utils.activities.list.cancel(listInput);
      const previous = utils.activities.list.getData(listInput);
      utils.activities.list.setData(listInput, current => current?.map(item => item.id === activityId ? { ...item, completed: !item.completed, completedAt: item.completed ? null : new Date() } : item));
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) utils.activities.list.setData(listInput, context.previous);
      toast.error(error.message);
    },
    onSuccess: result => { utils.activities.list.invalidate(); utils.dashboard.summary.invalidate(); utils.achievements.list.invalidate(); toast.success(result.completed ? "Atividade concluída. Bom trabalho!" : "Atividade reaberta."); if (result.newlyUnlocked.length) toast.success("Nova conquista desbloqueada!"); },
  });
  const remove = trpc.activities.remove.useMutation({ onSuccess: () => { utils.activities.list.invalidate(); utils.dashboard.summary.invalidate(); toast.success("Atividade excluída."); } });
  const create = trpc.activities.create.useMutation({ onSuccess: () => { utils.activities.list.invalidate(); utils.dashboard.summary.invalidate(); toast.success("Atividade criada."); setDialogOpen(false); } });
  const update = trpc.activities.update.useMutation({ onSuccess: () => { utils.activities.list.invalidate(); utils.dashboard.summary.invalidate(); toast.success("Atividade atualizada."); setDialogOpen(false); } });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditActivity | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const isAdmin = me.data?.role === "admin";
  const rows = (activities.data ?? []).filter(item => {
    if (deadline === "com_prazo") return Boolean(item.dueDate);
    if (deadline === "sem_prazo") return !item.dueDate;
    if (deadline === "proximos_7") return Boolean(item.dueDate && item.dueDate >= new Date() && item.dueDate <= new Date(Date.now() + 7 * 86_400_000));
    return true;
  });
  const subjectOptions = subjects.data ?? [];

  const openCreate = () => { setEditing(null); setForm(blankForm(subjectOptions[0]?.id ?? 0)); setDialogOpen(true); };
  const openEdit = (activity: EditActivity) => { setEditing(activity); setForm({ subjectId: activity.subjectId, title: activity.title, description: activity.description ?? "", type: activity.type, priority: activity.priority, status: activity.status, dueDate: activity.dueDate ? format(activity.dueDate, "yyyy-MM-dd") : "", resourceUrl: activity.resourceUrl ?? "", estimatedMinutes: activity.estimatedMinutes }); setDialogOpen(true); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.subjectId) return toast.error("Escolha uma matéria."); const values = { ...form, description: form.description || null, resourceUrl: form.resourceUrl || null, dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`) : null }; if (editing) update.mutate({ id: editing.id, ...values }); else create.mutate(values); };
  const statusLabel = useMemo(() => ({ pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída" }), []);

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6CFF]">Organização</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Atividades</h1><p className="mt-2 text-sm text-slate-500">Filtre o que importa e avance no seu ritmo.</p></div>{isAdmin && <Button className="rounded-xl" onClick={openCreate}><Plus className="size-4" />Nova atividade</Button>}</header>

    <section className="rounded-[22px] border border-slate-200/80 bg-white p-3 dark:border-white/8 dark:bg-[#181a25] sm:p-4"><div className="grid gap-2 lg:grid-cols-[1.5fr_repeat(5,0.7fr)]"><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por título ou matéria" /></div><select value={subjectId} onChange={event => setSubjectId(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="todas">Todas as matérias</option>{subjectOptions.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><select value={type} onChange={event => setType(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="todas">Todos os tipos</option>{types.map(option => <option key={option} value={option}>{option}</option>)}</select><select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="todas">Prioridades</option>{priorities.map(option => <option key={option} value={option}>{option}</option>)}</select><select value={deadline} onChange={event => setDeadline(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="todas">Todos os prazos</option><option value="proximos_7">Próximos 7 dias</option><option value="com_prazo">Com prazo</option><option value="sem_prazo">Sem prazo</option></select><select value={state} onChange={event => setState(event.target.value as typeof state)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="todas">Todos os estados</option><option value="pendentes">Pendentes</option><option value="concluidas">Concluídas por mim</option><option value="atrasadas">Atrasadas</option></select></div></section>

    <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#181a25]">{activities.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />)}</div> : rows.length ? <div className="divide-y divide-slate-100 dark:divide-white/8">{rows.map(activity => { const overdue = !activity.completed && Boolean(activity.dueDate && activity.dueDate < new Date()); return <article key={activity.id} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50/80 dark:hover:bg-white/[.025] sm:flex-row sm:items-center sm:gap-4 sm:p-5"><button onClick={() => toggle.mutate({ activityId: activity.id })} className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition ${activity.completed ? "border-[#1A9D77] bg-[#1A9D77] text-white" : "border-slate-300 text-transparent hover:border-[#5B6CFF] dark:border-white/20"}`} aria-label={activity.completed ? "Reabrir atividade" : "Concluir atividade"}>{activity.completed ? <Check className="size-4" /> : <Circle className="size-3" />}</button><span className="hidden h-10 w-1 rounded-full sm:block" style={{ background: activity.subject.color }} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className={`font-bold ${activity.completed ? "text-slate-400 line-through" : ""}`}>{activity.title}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/8 dark:text-slate-300">{activity.type}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activity.priority === "alta" ? "bg-rose-100 text-rose-700" : activity.priority === "media" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{activity.priority}</span></div><p className="mt-1 truncate text-xs text-slate-500">{activity.subject.name}{activity.description ? ` · ${activity.description}` : ""}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><div className="text-right"><p className={`text-xs font-bold ${overdue ? "text-rose-600" : "text-slate-600 dark:text-slate-300"}`}>{activity.dueDate ? format(activity.dueDate, "dd MMM", { locale: ptBR }) : "Sem prazo"}</p><p className="mt-1 text-[10px] text-slate-400">{activity.estimatedMinutes} min · {statusLabel[activity.status]}</p></div>{activity.resourceUrl && <a href={activity.resourceUrl} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#5B6CFF] dark:hover:bg-white/8" aria-label="Abrir recurso"><ExternalLink className="size-4" /></a>}{isAdmin && <div className="flex gap-1"><button onClick={() => openEdit(activity)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#5B6CFF] dark:hover:bg-white/8" aria-label="Editar"><Pencil className="size-4" /></button><button onClick={() => setDeleting(activity.id)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-400/10" aria-label="Excluir"><Trash2 className="size-4" /></button></div>}</div></article>; })}</div> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><Filter className="mx-auto size-8 text-slate-300" /><h2 className="mt-3 font-bold">Nenhuma atividade encontrada.</h2><p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou {isAdmin ? "crie a primeira atividade." : "aguarde uma nova atividade."}</p>{isAdmin && <Button variant="outline" className="mt-4" onClick={openCreate}>Criar atividade</Button>}</div></div>}</section>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Editar atividade" : "Nova atividade"}</DialogTitle><DialogDescription>Defina o próximo passo da turma com clareza.</DialogDescription></DialogHeader><form onSubmit={submit} className="mt-2 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><FieldLabel>Tipo de atividade</FieldLabel><Input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Resolver lista 3" required /></div><div className="sm:col-span-2"><FieldLabel>Descrição</FieldLabel><Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Instruções, conteúdo ou critério de entrega" /></div><div><FieldLabel>Matéria</FieldLabel><select value={form.subjectId} onChange={event => setForm({ ...form, subjectId: Number(event.target.value) })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required><option value={0}>Selecione</option>{subjectOptions.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div><div><FieldLabel>Tipo</FieldLabel><select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as ActivityType })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">{types.map(option => <option key={option}>{option}</option>)}</select></div><div><FieldLabel>Prioridade</FieldLabel><select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as Priority })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">{priorities.map(option => <option key={option}>{option}</option>)}</select></div><div><FieldLabel>Status editorial</FieldLabel><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as Status })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">{statuses.map(option => <option key={option}>{option.replace("_", " ")}</option>)}</select></div><div><FieldLabel>Prazo</FieldLabel><Input type="date" value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} /></div><div><FieldLabel>Estimativa (minutos)</FieldLabel><Input type="number" min={5} max={1440} value={form.estimatedMinutes} onChange={event => setForm({ ...form, estimatedMinutes: Number(event.target.value) })} /></div><div className="sm:col-span-2"><FieldLabel>Link ou material de apoio</FieldLabel><Input type="url" value={form.resourceUrl} onChange={event => setForm({ ...form, resourceUrl: event.target.value })} placeholder="https://" /></div><div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || update.isPending}>{editing ? "Salvar alterações" : "Criar atividade"}</Button></div></form></DialogContent></Dialog>
    <Dialog open={deleting !== null} onOpenChange={open => !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Excluir atividade?</DialogTitle><DialogDescription>Essa ação removerá a atividade e as conclusões vinculadas a ela.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { if (deleting) remove.mutate({ id: deleting }); setDeleting(null); }}>Excluir</Button></div></DialogContent></Dialog>
  </div>;
}
