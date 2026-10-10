import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

for (const file of [".env.test.local", ".env.local"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

/**
 * Testes ponta a ponta: abrem o app de verdade no navegador.
 * Precisam de um Supabase de TESTE e da IA simulada (veja docs/TESTES.md).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "celular",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } },
      testMatch: /(responsivo|celular|assistente|organizador)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
