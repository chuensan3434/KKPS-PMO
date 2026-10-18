import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: `http://127.0.0.1:${port}`, channel: "chromium", trace: "retain-on-failure" },
  webServer: {
    command: `NEXT_PUBLIC_LOCAL_MOCK_DATA=true npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/planning`,
    reuseExistingServer: !process.env.CI,
  },
});
