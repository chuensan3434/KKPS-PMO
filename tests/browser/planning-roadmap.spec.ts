import { expect, test, type Page } from "@playwright/test";

const projectId = "30000000-0000-4000-8000-000000000001";

async function selectCalendar(page: Page) {
  await page.getByLabel("Sprint calendar").selectOption({ label: "Local Mock 2027 · 2027-01-04" });
  await expect(page.getByText(/Compatible · 26 Sprints/)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/planning");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Roadmap Planning" })).toBeVisible();
  await selectCalendar(page);
});

test("loads Project Master records, schedules, persists after refresh, and unschedules without changing effort", async ({ page }) => {
  await expect(page.getByText("CRM Enhancement", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Schedule in S1" }).first().click();
  await expect(page.getByRole("button", { name: "CRM Enhancement, S1 to S2" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kkps-pmo:local-mock-data:v1"))).toContain(projectId);
  expect(await page.evaluate(() => localStorage.getItem("kkps-pmo:roadmap-planning:v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("kkps-pmo:effort-estimation:v1"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: "CRM Enhancement, S1 to S2" })).toBeVisible();
  await page.getByRole("button", { name: "CRM Enhancement, S1 to S2" }).click();
  await page.getByRole("button", { name: "Return to backlog" }).click();
  await expect(page.getByText("CRM Enhancement", { exact: true })).toBeVisible();
});

test("moves, extends, and shrinks a schedule on whole-Sprint boundaries", async ({ page }) => {
  await page.getByRole("button", { name: "Schedule in S1" }).first().click();
  const sprint = (number: number) => page.getByText(`S${number}`, { exact: true }).first().locator("..");
  await page.getByRole("button", { name: "CRM Enhancement, S1 to S2" }).dragTo(sprint(5));
  await expect(page.getByRole("button", { name: "CRM Enhancement, S5 to S6" })).toBeVisible();
  const dropResizeAt = async (number: number) => sprint(number).evaluate((target, id) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/resize-project-id", id);
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  }, projectId);
  await dropResizeAt(8);
  await expect(page.getByRole("button", { name: "CRM Enhancement, S5 to S8" })).toBeVisible();
  await dropResizeAt(5);
  await expect(page.getByRole("button", { name: "CRM Enhancement, S5 to S5" })).toBeVisible();
});

test("a newly created Project appears once in the Roadmap backlog", async ({ page }) => {
  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("tab", { name: "Project Master" }).click();
  await page.getByLabel("Project name").fill("Unified New Project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Unified New Project", { exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Planning" }).click();
  await expect(page.getByText("Unified New Project", { exact: true })).toHaveCount(1);
});

test("Capacity Periods shares the calendar and has no identity mapping UI", async ({ page }) => {
  await page.getByRole("button", { name: "Capacity Periods" }).click();
  await expect(page.getByText(/No identity mapping is required/)).toBeVisible();
  await expect(page.getByText("Identity mapping review")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add period" })).toBeEnabled();
});
