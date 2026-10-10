"use server";

import { z } from "zod";
import { fail, ok, requireActionContext, runAction } from "@/lib/actions";
import type { ActionResult } from "@/lib/types";

/** Liga ou desliga um recurso. O banco confere de novo se quem chama é administrador e registra na auditoria. */
export async function setFeatureFlagAction(input: unknown): Promise<ActionResult> {
  return runAction(
    "admin.recurso",
    z.object({ key: z.string().min(1).max(40), enabled: z.boolean() }),
    input,
    async ({ key, enabled }, { supabase }) => {
      const ctx = await requireActionContext();
      if (ctx?.profile.role !== "admin") return fail("Acesso restrito a administradores.");
      const { error } = await supabase.rpc("admin_set_flag", { p_key: key, p_enabled: enabled });
      if (error) {
        if (error.code === "42501") return fail("Acesso restrito a administradores.");
        throw new Error(error.message);
      }
      return ok(undefined, enabled ? "Recurso ativado." : "Recurso desativado.");
    },
  );
}
