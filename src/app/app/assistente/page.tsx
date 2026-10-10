import type { Metadata } from "next";
import { Suspense } from "react";
import { NewChat as NewChatView } from "@/components/chat/fresh-chat";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import Loading from "../loading";

export const metadata: Metadata = { title: "Assistente" };

export default function Page({ searchParams }: { searchParams: Promise<{ projeto?: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <NewChat searchParams={searchParams} />
    </Suspense>
  );
}

async function NewChat({ searchParams }: { searchParams: Promise<{ projeto?: string }> }) {
  await requireContext();
  const projectId = z.uuid().safeParse((await searchParams).projeto);
  let project: { id: string; name: string } | null = null;
  if (projectId.success) {
    const supabase = await createClient();
    const { data } = await supabase.from("projects").select("id, name").eq("id", projectId.data).maybeSingle();
    project = data ?? null;
  }
  return <NewChatView project={project} />;
}
