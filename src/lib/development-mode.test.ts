import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadMode(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...originalEnv, ...env };
  return import("./development-mode");
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("Demo Mode selection", () => {
  it("enables the existing mock mode during local development", async () => {
    const mode = await loadMode({ NODE_ENV: "development", VERCEL_ENV: undefined, NEXT_PUBLIC_LOCAL_MOCK_DATA: "true", NEXT_PUBLIC_DEMO_MODE: "false" });
    expect(mode.isDemoMode).toBe(true);
  });

  it("enables explicit Demo Mode on Vercel Preview", async () => {
    const mode = await loadMode({ NODE_ENV: "production", VERCEL_ENV: "preview", NEXT_PUBLIC_LOCAL_MOCK_DATA: "false", NEXT_PUBLIC_DEMO_MODE: "true" });
    expect(mode.isDemoMode).toBe(true);
  });

  it("fails closed on Vercel Production", async () => {
    const mode = await loadMode({ NODE_ENV: "production", VERCEL_ENV: "production", NEXT_PUBLIC_LOCAL_MOCK_DATA: "true", NEXT_PUBLIC_DEMO_MODE: "true" });
    expect(mode.isDemoMode).toBe(false);
  });
});
