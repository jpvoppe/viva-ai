import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { SessionGate } from "@/components/shell/session-gate";
import { AppLoading } from "@/components/shell/app-loading";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}
