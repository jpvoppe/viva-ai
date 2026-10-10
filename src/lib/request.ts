import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";

/** Identificador anônimo do visitante (hash do IP) para limite de requisições. */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}
