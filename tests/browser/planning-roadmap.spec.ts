import { expect, test, type Page } from "@playwright/test";

const projectId = "30000000-0000-4000-8000-000000000001";

async function resetDemo(page: Page, route = "/projects") {
  await page.goto(route);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function selectCalendar(page: Page) {
  await page.getByLabel("Sprint calendar").selectOption({ label: "Local Mock 2027 · 2027-01-04" });
  await expect(page.getByText("S26", { exact: true }).first()).toBeVisible();
}

test("uses Projects as the single intake and effort workspace", async ({ page }) => {
  await resetDemo(page);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByText("Projects", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Effort Estimation/i })).toHaveCount(0);

  await page.getByLabel("Squad to add").selectOption({ label: "Squad Alpha" });
  await page.getByRole("button", { name: "Add Squad" }).click();
  await page.getByLabel("CRM Enhancement Dev MD").fill("12.5");
  await page.getByLabel("CRM Enhancement QA MD").fill("4.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Total 17 MD/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("CRM Enhancement Dev MD")).toHaveValue("12.5");
});

test("keeps quarter intent separate from confirmed Sprint demand", async ({ page }) => {
  await resetDemo(page, `/planning?project=${projectId}`);
  await expect(page.getByRole("heading", { name: "Quarterly Roadmap" })).toBeVisible();
  await page.getByLabel("Quarter plan start").selectOption("1");
  await page.getByLabel("Quarter plan end").selectOption("2");
  await page.getByRole("button", { name: "Save Quarter Plan" }).click();
  await expect(page.getByRole("button", { name: /Q1–Q2 Quarter-level/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Capacity Timeline" })).toHaveCount(0);

  await selectCalendar(page);
  await expect(page.getByRole("heading", { name: "Capacity Timeline" })).toBeVisible();
  await page.getByRole("button", { name: "Schedule in S1" }).first().click();
  await expect(page.getByRole("button", { name: "CRM Enhancement, S1 to S2" })).toBeVisible();
});

test("does not show a Sprint schedule editor for an unscheduled deep link", async ({ page }) => {
  await resetDemo(page, `/planning?project=${projectId}`);
  await expect(page.getByText("S–S", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Return to backlog" })).toHaveCount(0);
});

test("preserves capacity planning beneath Planning", async ({ page }) => {
  await resetDemo(page, "/planning");
  await selectCalendar(page);
  await page.getByRole("tab", { name: "Squad Capacity" }).click();
  await expect(page.getByRole("heading", { name: "Squad Capacity Planner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Annual Allocation Matrix" })).toBeVisible();
  await expect(page.getByLabel("Scrollable annual allocation matrix")).toBeVisible();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
  test(`has no page-level horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await resetDemo(page);
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.width === 390) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByText("Planning", { exact: true })).toBeVisible();
    }
  });
}
