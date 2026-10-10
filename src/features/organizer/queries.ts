import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task } from "@/lib/types";
import type { Goal, List, ListItem } from "./actions";
import { TASK_COLUMNS } from "./schema";

export async function fetchTasks(supabase: SupabaseClient, options?: { projectId?: string }): Promise<Task[]> {
  let open = supabase.from("tasks").select(TASK_COLUMNS).is("completed_at", null).limit(500);
  let done = supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(100);
  if (options?.projectId) {
    open = open.eq("project_id", options.projectId);
    done = done.eq("project_id", options.projectId);
  }
  const [a, b] = await Promise.all([open, done]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  return [...(a.data ?? []), ...(b.data ?? [])] as Task[];
}

export async function fetchLists(supabase: SupabaseClient): Promise<List[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, kind, list_items(id, list_id, text, done, position, created_at)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const items = ((row.list_items ?? []) as (ListItem & { created_at: string })[])
      .slice()
      .sort((x, y) => x.position - y.position || (x.created_at < y.created_at ? -1 : 1));
    return { id: row.id, name: row.name, kind: row.kind, items } as List;
  });
}

export async function fetchGoals(supabase: SupabaseClient): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, unit, target_value, current_value, due_date, completed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => ({
    ...g,
    target_value: Number(g.target_value),
    current_value: Number(g.current_value),
  })) as Goal[];
}

export async function fetchProjectOptions(supabase: SupabaseClient): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
