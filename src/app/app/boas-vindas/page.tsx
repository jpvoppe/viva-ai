import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppLoading } from "@/components/shell/app-loading";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { requireContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Boas-vindas" };

export default function Page() {
  return (
    <Suspense fallback={<AppLoading />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const ctx = await requireContext({ allowOnboarding: true });
  if (ctx.profile.onboarding_completed_at) redirect("/app");
  return <OnboardingFlow name={ctx.profile.display_name} needsAge={ctx.profile.age_band === null} />;
}
