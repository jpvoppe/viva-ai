"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Award, Check, Copy, Download, Lock, Pencil, Trash2, UserMinus } from "lucide-react";
import { useCopy } from "@/components/chat/markdown";
import { PlanTable } from "@/components/plans/plan-table";
import { useApp } from "@/components/shell/app-context";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, EmptyState, Progress } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { requestPasswordResetAction, signOutAction } from "@/features/auth/actions";
import { openBillingPortalAction, startCheckoutAction } from "@/features/billing/actions";
import {
  createFamilyInviteAction,
  leaveFamilyAction,
  removeFamilyMemberAction,
  revokeFamilyInviteAction,
  type FamilyInvite,
} from "@/features/family/actions";
import {
  addMemoryAction,
  deleteAllMemoriesAction,
  deleteMemoryAction,
  setMemoryEnabledAction,
  updateMemoryAction,
  type Memory,
} from "@/features/memory/actions";
import { useServerState } from "@/hooks/use-server-state";
import { useSpeechRecognitionSupported, useSpeechSynthesisSupported } from "@/hooks/use-speech";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { FAMILY_MAX_PEOPLE, getPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { ResponseStyle, Stats, ThemePreference } from "@/lib/types";
import { deleteAccountAction, sendFeedbackAction, updatePreferencesAction, updateProfileAction } from "./actions";

export type SettingsData = {
  memories: Memory[];
  stats: Stats | null;
  unlocked: { code: string; unlocked_at: string }[];
  prices: { plus: string | null; familia: string | null; configured: boolean; testMode: boolean };
  roster: { user_id: string; display_name: string; is_owner: boolean }[];
  invites: FamilyInvite[];
};

const TABS = ["conta", "preferencias", "memoria", "progresso", "assinatura", "privacidade"] as const;
type TabId = (typeof TABS)[number];

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-6 first:pt-0 last:border-b-0">
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="mt-1 max-w-prose text-ink-soft">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsClient({ data }: { data: SettingsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("aba");
  const tab: TabId = TABS.includes(requested as TabId) ? (requested as TabId) : "conta";
  const checkout = params.get("checkout");

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = new URLSearchParams();
        if (value !== "conta") next.set("aba", value);
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    >
      <TabsList aria-label="Seções das configurações">
        <TabsTrigger value="conta">Conta</TabsTrigger>
        <TabsTrigger value="preferencias">Preferências</TabsTrigger>
        <TabsTrigger value="memoria">Memória</TabsTrigger>
        <TabsTrigger value="progresso">Progresso</TabsTrigger>
        <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
        <TabsTrigger value="privacidade">Privacidade</TabsTrigger>
      </TabsList>
      <TabsContent value="conta">
        <AccountPanel />
      </TabsContent>
      <TabsContent value="preferencias">
        <PreferencesPanel />
      </TabsContent>
      <TabsContent value="memoria">
        <MemoryPanel memories={data.memories} />
      </TabsContent>
      <TabsContent value="progresso">
        <ProgressPanel stats={data.stats} unlocked={data.unlocked} />
      </TabsContent>
      <TabsContent value="assinatura">
        <BillingPanel prices={data.prices} roster={data.roster} invites={data.invites} checkout={checkout} />
      </TabsContent>
      <TabsContent value="privacidade">
        <PrivacyPanel />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Conta
// ---------------------------------------------------------------------------
function AccountPanel() {
  const { ctx, patchContext } = useApp();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);

  return (
    <div>
      <SectionCard title="Seus dados">
        <form
          action={async (formData) => {
            setPending("nome");
            setNameError(null);
            const result = await updateProfileAction({ display_name: formData.get("display_name") });
            setPending(null);
            if (!result.ok) {
              setNameError(result.error);
              return;
            }
            toast.success("Nome atualizado.");
            patchContext({ displayName: String(formData.get("display_name") ?? "").trim() });
          }}
          className="flex max-w-md flex-col gap-4"
        >
          <Field id="conta-nome" label="Como quer ser chamado?" error={nameError}>
            <Input {...fieldAria("conta-nome", nameError)} name="display_name" defaultValue={ctx.profile.display_name} maxLength={80} required />
          </Field>
          <Field id="conta-email" label="E-mail" hint="O e-mail é o seu login e não pode ser alterado por aqui.">
            <Input id="conta-email" value={ctx.email} readOnly aria-readonly="true" aria-describedby="conta-email-ajuda" className="bg-sunken" />
          </Field>
          <div>
            <Button type="submit" loading={pending === "nome"} loadingLabel="Salvando">
              Salvar nome
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Senha" description="Enviamos um link para o seu e-mail. Por ele você cria uma senha nova.">
        <Button
          variant="secondary"
          loading={pending === "senha"}
          loadingLabel="Enviando"
          onClick={async () => {
            setPending("senha");
            const formData = new FormData();
            formData.set("email", ctx.email);
            const result = await requestPasswordResetAction({}, formData);
            setPending(null);
            if (result.error) toast.error(result.error);
            else toast.success("Link enviado para o seu e-mail.");
          }}
        >
          Enviar link para trocar a senha
        </Button>
      </SectionCard>

      <SectionCard title="Fale com a gente" description="Encontrou um problema ou tem uma ideia? Sua mensagem chega à equipe do VIVA.">
        <form
          key={feedbackKey}
          action={async (formData) => {
            setPending("feedback");
            setFeedbackError(null);
            const result = await sendFeedbackAction({ category: formData.get("category"), comment: formData.get("comment") });
            setPending(null);
            if (!result.ok) {
              setFeedbackError(result.error);
              return;
            }
            toast.success("Recebido. Obrigado por ajudar a melhorar o VIVA.");
            setFeedbackKey((k) => k + 1);
          }}
          className="flex max-w-xl flex-col gap-4"
        >
          <Field id="feedback-tipo" label="Assunto">
            <Select id="feedback-tipo" name="category" defaultValue="sugestao">
              <option value="sugestao">Sugestão</option>
              <option value="problema">Problema</option>
              <option value="geral">Outro</option>
            </Select>
          </Field>
          <Field id="feedback-texto" label="Mensagem" error={feedbackError} hint="Não inclua senhas nem dados sensíveis.">
            <Textarea {...fieldAria("feedback-texto", feedbackError, true)} name="comment" rows={4} maxLength={2000} required />
          </Field>
          <div>
            <Button type="submit" variant="secondary" loading={pending === "feedback"} loadingLabel="Enviando">
              Enviar mensagem
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Sessão">
        <Button variant="secondary" onClick={() => void signOutAction()}>
          Sair da conta
        </Button>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preferências
// ---------------------------------------------------------------------------
function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-h-12 rounded-md border px-4 py-2.5 text-left transition-colors",
              selected ? "border-violet bg-tint" : "border-line-strong bg-surface hover:border-ink-muted",
            )}
          >
            <span className="flex items-center justify-between gap-2 font-medium">
              {option.label}
              {selected ? <Check aria-hidden="true" className="size-4 text-violet-text" strokeWidth={3} /> : null}
            </span>
            {option.description ? <span className="mt-0.5 block text-sm text-ink-soft">{option.description}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function PreferencesPanel() {
  const { ctx, patchContext } = useApp();
  const theme = useTheme();
  const toast = useToast();
  const canDictate = useSpeechRecognitionSupported();
  const canSpeak = useSpeechSynthesisSupported();
  const prefs = ctx.preferences;
  const [goalInput, setGoalInput] = useState(ctx.preferences.weekly_task_goal ? String(ctx.preferences.weekly_task_goal) : "");
  const [goalError, setGoalError] = useState<string | null>(null);

  const save = async (patch: Partial<typeof prefs>) => {
    const previous = prefs;
    patchContext({ preferences: patch });
    const result = await updatePreferencesAction(patch);
    if (!result.ok) {
      patchContext({ preferences: previous });
      toast.error(result.error);
      return false;
    }
    return true;
  };

  return (
    <div>
      <SectionCard title="Aparência">
        <ChoiceGroup<ThemePreference>
          label="Tema"
          value={theme.preference}
          onChange={(value) => {
            theme.setPreference(value);
            void save({ theme: value });
          }}
          options={[
            { id: "sistema", label: "Igual ao aparelho" },
            { id: "claro", label: "Claro" },
            { id: "escuro", label: "Escuro" },
          ]}
        />
      </SectionCard>

      <SectionCard title="Estilo das respostas" description="Vale para as próximas mensagens e criações.">
        <ChoiceGroup<ResponseStyle>
          label="Estilo das respostas"
          value={prefs.response_style}
          onChange={(value) => void save({ response_style: value })}
          options={[
            { id: "direto", label: "Direto", description: "Curto, direto ao ponto." },
            { id: "equilibrado", label: "Equilibrado", description: "Na medida do pedido." },
            { id: "detalhado", label: "Detalhado", description: "Passo a passo, com exemplos." },
          ]}
        />
      </SectionCard>

      <SectionCard title="Conversa">
        <div className="max-w-xl">
          <Switch
            id="pref-enter"
            label="Enter envia a mensagem"
            description={
              prefs.enter_to_send
                ? "Shift + Enter cria uma nova linha."
                : "Enter cria uma nova linha. Para enviar, use Ctrl + Enter ou o botão."
            }
            checked={prefs.enter_to_send}
            onCheckedChange={(checked) => void save({ enter_to_send: checked })}
          />
          <Switch
            id="pref-voz"
            label="Ler as respostas em voz alta"
            description={
              canSpeak
                ? "Usa a voz do seu aparelho, sem custo."
                : "Indisponível: este navegador não tem leitura em voz alta."
            }
            checked={prefs.voice_reply && canSpeak}
            disabled={!canSpeak}
            onCheckedChange={(checked) => void save({ voice_reply: checked })}
          />
          <p className="mt-2 text-sm text-ink-muted">
            Ditado por voz: {canDictate ? "disponível neste navegador (botão de microfone na conversa). O áudio é transcrito pelo serviço de fala do navegador." : "indisponível neste navegador. Funciona no Chrome, Edge e Safari."}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Progresso e conquistas" description="Totalmente opcional. Ninguém perde nada por descansar.">
        <div className="max-w-xl">
          <Switch
            id="pref-gamificacao"
            label="Mostrar progresso, sequências e conquistas"
            checked={prefs.gamification_enabled}
            onCheckedChange={(checked) => void save({ gamification_enabled: checked })}
          />
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setGoalError(null);
              const value = goalInput.trim() === "" ? null : Number(goalInput);
              if (value !== null && (!Number.isInteger(value) || value < 1 || value > 100)) {
                setGoalError("Use um número inteiro de 1 a 100, ou deixe vazio.");
                return;
              }
              if (await save({ weekly_task_goal: value })) toast.success(value ? "Meta semanal salva." : "Meta semanal removida.");
            }}
            className="mt-3 flex items-end gap-2"
          >
            <Field id="pref-meta" label="Meta de tarefas por semana" optional error={goalError} className="w-56">
              <Input
                {...fieldAria("pref-meta", goalError)}
                type="number"
                inputMode="numeric"
                value={goalInput}
                onChange={(event) => setGoalInput(event.target.value)}
                disabled={!prefs.gamification_enabled}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={!prefs.gamification_enabled}>
              Salvar meta
            </Button>
          </form>
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memória
// ---------------------------------------------------------------------------
function MemoryPanel({ memories: serverMemories }: { memories: Memory[] }) {
  const { ctx, patchContext } = useApp();
  const toast = useToast();
  const enabled = ctx.preferences.memory_enabled;
  const [memories, setMemories] = useServerState(serverMemories);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const limit = getPlan(ctx.plan).limits.maxMemories;

  const toggle = async (next: boolean) => {
    patchContext({ preferences: { memory_enabled: next } });
    const result = await setMemoryEnabledAction({ enabled: next });
    if (!result.ok) {
      patchContext({ preferences: { memory_enabled: !next } });
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Preferência salva.");
  };

  return (
    <div>
      <SectionCard
        title="Memória personalizada"
        description="Quando ligada, o VIVA usa os itens abaixo para personalizar as respostas. Só entra aqui o que você mandar guardar. O histórico de conversas é separado e continua existindo com a memória desligada."
      >
        <div className="max-w-xl">
          <Switch
            id="memoria-ativa"
            label="Usar a memória nas respostas"
            description={enabled ? "Ligada. Você pode desligar quando quiser." : "Desligada. Os itens guardados não são enviados à IA."}
            checked={enabled}
            onCheckedChange={(next) => void toggle(next)}
          />
        </div>
      </SectionCard>

      <SectionCard title={`O que o VIVA lembra (${memories.length} de ${limit})`}>
        {enabled ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!text.trim()) return;
              setPending(true);
              setError(null);
              const result = await addMemoryAction({ content: text });
              setPending(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMemories((list) => [result.data, ...list]);
              setText("");
              toast.success("Guardado na memória.");
            }}
            className="mb-4 flex max-w-xl flex-col gap-2"
          >
            <Field
              id="memoria-nova"
              label="Adicionar um item"
              error={error}
              hint="Ex.: “Prefiro respostas em tópicos” ou “Estou estudando para o ENEM”. Não guarde senhas nem documentos."
            >
              <Input
                {...fieldAria("memoria-nova", error, true)}
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={500}
                autoComplete="off"
              />
            </Field>
            <div>
              <Button type="submit" variant="secondary" loading={pending} disabled={!text.trim()}>
                Guardar na memória
              </Button>
            </div>
          </form>
        ) : (
          <Alert tone="info" title="A memória está desligada." className="mb-4">
            Ligue acima para adicionar itens. Os que já existem continuam guardados, mas não são usados.
          </Alert>
        )}

        {memories.length === 0 ? (
          <EmptyState icon={<Lock />} title="Nada guardado">
            O VIVA não guardou nenhuma preferência sua.
          </EmptyState>
        ) : (
          <>
            <ul>
              {memories.map((memory) => (
                <li key={memory.id} className="flex items-start gap-1 border-b border-line py-2.5 last:border-b-0">
                  <p className="min-w-0 flex-1 py-1.5">{memory.content}</p>
                  <button
                    type="button"
                    onClick={() => setEditing(memory)}
                    aria-label={`Editar: ${memory.content}`}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await deleteMemoryAction({ id: memory.id });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setMemories((list) => list.filter((m) => m.id !== memory.id));
                      toast.success("Item apagado da memória.");
                    }}
                    aria-label={`Apagar: ${memory.content}`}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setClearOpen(true)}>
                <Trash2 aria-hidden="true" className="size-4" />
                Apagar toda a memória
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Editar item da memória"
        size="sm"
      >
        <form
          key={editing?.id}
          action={async (formData) => {
            if (!editing) return;
            setPending(true);
            const result = await updateMemoryAction({ id: editing.id, content: String(formData.get("content") ?? "") });
            setPending(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setMemories((list) => list.map((m) => (m.id === editing.id ? result.data : m)));
            setEditing(null);
            toast.success("Memória atualizada.");
          }}
          className="flex flex-col gap-4"
        >
          <Field id="memoria-editar" label="O que o VIVA deve lembrar">
            <Textarea id="memoria-editar" name="content" defaultValue={editing?.content} maxLength={500} rows={3} required autoFocus />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar item
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Apagar toda a memória?"
        description="Todos os itens guardados serão apagados. Suas conversas não são afetadas. Não dá para desfazer."
        confirmLabel="Apagar toda a memória"
        danger
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const result = await deleteAllMemoriesAction();
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setMemories([]);
          setClearOpen(false);
          toast.success("Toda a memória foi apagada.");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progresso
// ---------------------------------------------------------------------------
function ProgressPanel({ stats, unlocked }: { stats: Stats | null; unlocked: { code: string; unlocked_at: string }[] }) {
  const { ctx } = useApp();
  if (!ctx.preferences.gamification_enabled || !stats) {
    return (
      <EmptyState icon={<Award />} title="Progresso desligado">
        Você desativou progresso e conquistas. Para voltar a ver, ligue em Preferências.
      </EmptyState>
    );
  }
  const unlockedMap = new Map(unlocked.map((u) => [u.code, u.unlocked_at]));
  const goal = ctx.preferences.weekly_task_goal;
  const totals = stats.totais;
  const numbers: [string, number][] = [
    ["Mensagens enviadas", totals.mensagem_enviada ?? 0],
    ["Tarefas concluídas", totals.tarefa_concluida ?? 0],
    ["Projetos criados", totals.projeto_criado ?? 0],
    ["Cartões revisados", totals.cartao_revisado ?? 0],
    ["Criações salvas", totals.criacao_salva ?? 0],
    ["Questionários feitos", totals.quiz_concluido ?? 0],
  ];

  return (
    <div>
      <SectionCard title="Esta semana" description="Contado a partir do que você realmente fez no VIVA.">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-ink-muted">Dias ativos</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{stats.dias_ativos_semana} de 7</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Tarefas concluídas</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">
              {stats.tarefas_semana}
              {goal ? <span className="text-base font-normal text-ink-muted"> de {goal}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Sequência atual</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">
              {stats.sequencia_atual} {stats.sequencia_atual === 1 ? "dia" : "dias"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Melhor sequência</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">
              {stats.melhor_sequencia} {stats.melhor_sequencia === 1 ? "dia" : "dias"}
            </dd>
          </div>
        </dl>
        {goal ? <Progress className="mt-4 max-w-md" value={stats.tarefas_semana} max={goal} label="Meta semanal de tarefas" /> : null}
        <p className="mt-3 text-sm text-ink-muted">Um dia de descanso não interrompe a sequência.</p>
      </SectionCard>

      <SectionCard title="Desde o início">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {numbers.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title={`Conquistas (${unlockedMap.size} de ${ACHIEVEMENTS.length})`}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ACHIEVEMENTS.map((achievement) => {
            const date = unlockedMap.get(achievement.code);
            return (
              <li
                key={achievement.code}
                className={cn("flex items-center gap-3 rounded-md border p-3", date ? "border-line bg-surface" : "border-dashed border-line-strong")}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    date ? "bg-brand-gradient text-white" : "bg-sunken text-ink-muted",
                  )}
                >
                  {date ? <Award className="size-5" /> : <Lock className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{achievement.title}</span>
                  <span className="block text-sm text-ink-muted">{achievement.description}</span>
                  <span className="block text-sm text-ink-muted">
                    {date
                      ? `Desbloqueada em ${new Intl.DateTimeFormat("pt-BR", { timeZone: ctx.profile.timezone, dateStyle: "medium" }).format(new Date(date))}`
                      : "Ainda não desbloqueada"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assinatura e família
// ---------------------------------------------------------------------------
const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Em período de teste",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  incomplete: "Aguardando pagamento",
  incomplete_expired: "Pagamento não concluído",
  unpaid: "Pagamento não realizado",
  paused: "Pausada",
};

function BillingPanel({
  prices,
  roster,
  invites: serverInvites,
  checkout,
}: {
  prices: SettingsData["prices"];
  roster: SettingsData["roster"];
  invites: FamilyInvite[];
  checkout: string | null;
}) {
  const { ctx, usage } = useApp();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const plan = getPlan(ctx.plan);
  const sub = ctx.subscription;
  const ownsPaid = sub.plan !== "gratuito";
  const viaFamily = ctx.plan === "familia" && !ownsPaid;
  const adult = ctx.profile.age_band === "adulto";

  const subscribe = async (target: "plus" | "familia") => {
    setPending(target);
    const result = await startCheckoutAction({ plan: target });
    if (!result.ok) {
      setPending(null);
      toast.error(result.error);
      return;
    }
    window.location.assign(result.data.url);
  };

  const portal = async () => {
    setPending("portal");
    const result = await openBillingPortalAction();
    if (!result.ok) {
      setPending(null);
      toast.error(result.error);
      return;
    }
    window.location.assign(result.data.url);
  };

  const subscribeButton = (target: "plus" | "familia") =>
    ownsPaid || viaFamily ? null : (
      <Button
        className="w-full"
        variant={target === "plus" ? "primary" : "secondary"}
        loading={pending === target}
        loadingLabel="Abrindo o pagamento"
        disabled={!prices.configured || !adult}
        onClick={() => void subscribe(target)}
      >
        Assinar {getPlan(target).name}
      </Button>
    );

  const usageRows: [string, { used: number; limit: number }][] = [
    ["Mensagens ao assistente", usage.mensagem],
    ["Criações nas ferramentas", usage.geracao],
    ["Arquivos enviados", usage.arquivo],
  ];

  return (
    <div>
      {checkout === "sucesso" ? (
        <Alert tone="sucesso" title="Pagamento recebido." className="mb-6">
          A confirmação chega em instantes. Se o plano ainda aparecer como Gratuito, atualize a página em alguns
          segundos.
        </Alert>
      ) : null}
      {checkout === "cancelado" ? (
        <Alert tone="info" title="Você saiu do pagamento antes de concluir." className="mb-6">
          Nenhuma cobrança foi feita.
        </Alert>
      ) : null}

      <SectionCard title="Seu plano">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-2xl font-semibold">{plan.name}</span>
          {ownsPaid ? <Badge tone={sub.status === "past_due" ? "atencao" : "marca"}>{STATUS_LABEL[sub.status] ?? sub.status}</Badge> : null}
          {viaFamily ? <Badge tone="marca">Pelo plano Família de outra pessoa</Badge> : null}
        </div>
        {ownsPaid && sub.current_period_end ? (
          <p className="mt-2 text-ink-soft">
            {sub.cancel_at_period_end ? "Assinatura cancelada. O acesso continua até " : "Próxima renovação em "}
            {new Intl.DateTimeFormat("pt-BR", { timeZone: ctx.profile.timezone, dateStyle: "long" }).format(new Date(sub.current_period_end))}.
          </p>
        ) : null}
        {sub.has_customer ? (
          <div className="mt-4">
            <Button variant="secondary" onClick={() => void portal()} loading={pending === "portal"} loadingLabel="Abrindo">
              Gerenciar assinatura
            </Button>
            <p className="mt-2 text-sm text-ink-muted">
              Trocar cartão, mudar de plano, ver faturas ou cancelar — tudo em poucos cliques, sem falar com ninguém.
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Uso de hoje" description="Os limites voltam ao normal à meia-noite, no seu fuso.">
        <ul className="flex max-w-md flex-col gap-4">
          {usageRows.map(([label, value]) => (
            <li key={label}>
              <div className="flex items-baseline justify-between gap-3">
                <span>{label}</span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {Math.min(value.used, value.limit)} de {value.limit}
                </span>
              </div>
              <Progress className="mt-1.5" value={value.used} max={value.limit} label={label} />
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Planos">
        {!prices.configured ? (
          <Alert tone="info" title="As assinaturas ainda não foram ativadas neste ambiente." className="mb-4">
            Você pode usar o plano Gratuito normalmente. Nenhuma cobrança é feita.
          </Alert>
        ) : prices.testMode ? (
          <Alert tone="atencao" title="Pagamentos em modo de teste." className="mb-4">
            Nenhuma cobrança real é feita. Use os cartões de teste do Stripe.
          </Alert>
        ) : null}
        {prices.configured && !adult ? (
          <Alert tone="info" title="Assinaturas são para maiores de 18 anos." className="mb-4">
            Um responsável pode assinar o VIVA Família e convidar você.
          </Alert>
        ) : null}
        <PlanTable
          prices={prices}
          current={ctx.plan}
          actions={{ plus: subscribeButton("plus"), familia: subscribeButton("familia") }}
        />
        <p className="mt-3 text-sm text-ink-muted">
          Sem fidelidade: cancele quando quiser em “Gerenciar assinatura”. O acesso vai até o fim do período já pago.
        </p>
      </SectionCard>

      {sub.plan === "familia" ? <FamilyOwnerSection roster={roster} invites={serverInvites} /> : null}
      {viaFamily ? <FamilyMemberSection roster={roster} /> : null}
    </div>
  );
}

function FamilyOwnerSection({ roster: serverRoster, invites: serverInvites }: { roster: SettingsData["roster"]; invites: FamilyInvite[] }) {
  const toast = useToast();
  const [copied, copy] = useCopy();
  const [roster, setRoster] = useServerState(serverRoster);
  const [invites, setInvites] = useServerState(serverInvites);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [removing, setRemoving] = useState<SettingsData["roster"][number] | null>(null);
  const members = roster.filter((r) => !r.is_owner);
  const seats = 1 + members.length + invites.length;

  return (
    <SectionCard
      title={`Família (${seats} de ${FAMILY_MAX_PEOPLE} lugares)`}
      description="Cada pessoa usa a própria conta. Você administra quem participa e a cobrança; não vê conversas, tarefas nem arquivos de ninguém."
    >
      <ul className="mb-4">
        <li className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2">
          <span>Você</span>
          <Badge>Responsável</Badge>
        </li>
        {members.map((member) => (
          <li key={member.user_id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-1">
            <span className="truncate">{member.display_name || "Pessoa sem nome"}</span>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(member)}>
              <UserMinus aria-hidden="true" className="size-4" />
              Remover da família
            </Button>
          </li>
        ))}
        {invites.map((invite) => (
          <li key={invite.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-1">
            <span className="min-w-0">
              <span className="block truncate">{invite.email}</span>
              <span className="block text-sm text-ink-muted">Convite aguardando aceite</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const result = await revokeFamilyInviteAction({ id: invite.id });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setInvites((list) => list.filter((i) => i.id !== invite.id));
                toast.success("Convite cancelado.");
              }}
            >
              Cancelar convite
            </Button>
          </li>
        ))}
      </ul>

      {seats < FAMILY_MAX_PEOPLE ? (
        <form
          key={formKey}
          action={async (formData) => {
            setPending(true);
            setError(null);
            setLink(null);
            const result = await createFamilyInviteAction({ email: formData.get("email") });
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setInvites((list) => [...list, result.data.invite]);
            setLink(result.data.link);
            setFormKey((k) => k + 1);
          }}
          className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Field id="convite-email" label="Convidar por e-mail" error={error} className="flex-1" hint="A pessoa precisa entrar no VIVA com este mesmo e-mail.">
            <Input {...fieldAria("convite-email", error, true)} name="email" type="email" inputMode="email" autoCapitalize="none" required />
          </Field>
          <Button type="submit" variant="secondary" loading={pending} loadingLabel="Criando convite" className="sm:mb-[1.85rem]">
            Criar convite
          </Button>
        </form>
      ) : (
        <p className="text-ink-muted">Todos os lugares estão ocupados.</p>
      )}

      {link ? (
        <Alert
          tone="sucesso"
          title="Convite criado. Envie este link para a pessoa:"
          className="mt-4"
          action={
            <Button size="sm" variant="secondary" onClick={() => void copy(link)}>
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
          }
        >
          <span className="break-all font-mono text-sm">{link}</span>
          <span className="mt-1 block">O link vale por 7 dias e só aparece agora. Se perder, cancele o convite e crie outro.</span>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Remover esta pessoa da família?"
        description={`${removing?.display_name || "A pessoa"} volta para o plano Gratuito. Os dados dela não são apagados.`}
        confirmLabel="Remover da família"
        danger
        loading={pending}
        onConfirm={async () => {
          if (!removing) return;
          setPending(true);
          const result = await removeFamilyMemberAction({ user_id: removing.user_id });
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setRoster((list) => list.filter((r) => r.user_id !== removing.user_id));
          setRemoving(null);
          toast.success("Pessoa removida da família.");
        }}
      />
    </SectionCard>
  );
}

function FamilyMemberSection({ roster }: { roster: SettingsData["roster"] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const owner = roster.find((r) => r.is_owner);
  return (
    <SectionCard
      title="Família"
      description={`Você usa o plano Família${owner?.display_name ? ` de ${owner.display_name}` : ""}. Seus dados são privados: ninguém da família tem acesso a eles.`}
    >
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Sair da família
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sair da família?"
        description="Você volta para o plano Gratuito. Seus dados continuam com você."
        confirmLabel="Sair da família"
        danger
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const result = await leaveFamilyAction();
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setOpen(false);
          toast.success("Você saiu da família.");
          router.refresh();
        }}
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Privacidade
// ---------------------------------------------------------------------------
function PrivacyPanel() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <SectionCard title="Como seus dados são tratados">
        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-ink-soft">
          <li>Conversas, tarefas, projetos e arquivos pertencem à sua conta e não são visíveis para outros usuários.</li>
          <li>As mensagens e os anexos de uma conversa são enviados ao provedor de IA somente para gerar a resposta.</li>
          <li>A memória personalizada só guarda o que você mandar e pode ser desligada ou apagada a qualquer momento.</li>
          <li>A equipe do VIVA acompanha números agregados de uso, não o conteúdo das suas conversas.</li>
        </ul>
        <p className="mt-3">
          <Link href="/privacidade" className="font-medium text-violet-text underline underline-offset-4">
            Ler a Política de privacidade completa
          </Link>
        </p>
      </SectionCard>

      <SectionCard title="Baixar meus dados" description="Um arquivo com tudo o que você criou no VIVA (formato JSON, legível por outros sistemas).">
        <a
          href="/api/account/export"
          download
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 font-medium hover:bg-sunken"
        >
          <Download aria-hidden="true" className="size-4" />
          Baixar meus dados
        </a>
      </SectionCard>

      <SectionCard
        title="Excluir minha conta"
        description="Apaga definitivamente a conta, as conversas, os arquivos, as tarefas, os projetos e a memória. Se houver assinatura, ela é cancelada."
      >
        <Button variant="danger" onClick={() => setOpen(true)}>
          Excluir minha conta
        </Button>
      </SectionCard>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) setError(null);
        }}
        title="Excluir a conta definitivamente?"
        description="Tudo o que você criou no VIVA será apagado. Esta ação não pode ser desfeita."
        size="sm"
      >
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            const result = await deleteAccountAction({ confirmation: String(formData.get("confirmation") ?? "").trim().toUpperCase() });
            // Se der certo, o servidor redireciona para a página inicial.
            if (result && !result.ok) {
              setPending(false);
              setError(result.error);
              toast.error(result.error);
            }
          }}
          className="flex flex-col gap-4"
        >
          <Field id="excluir-confirmacao" label="Para confirmar, digite EXCLUIR" error={error}>
            <Input {...fieldAria("excluir-confirmacao", error)} name="confirmation" autoComplete="off" autoCapitalize="characters" required />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Manter minha conta
            </Button>
            <Button type="submit" variant="danger" loading={pending} loadingLabel="Excluindo">
              Excluir definitivamente
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
