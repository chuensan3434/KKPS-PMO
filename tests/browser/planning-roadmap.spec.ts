import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/planning");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Roadmap Planning" })).toBeVisible();
});

test("schedules, manually edits, and unschedules without changing estimated MD", async ({ page }) => {
  const backlogProject = page.locator('[draggable="true"]', { hasText: "CRM Enhancement" }).first();
  const sprintOne = page.getByText("S1", { exact: true }).first().locator("..");
  await backlogProject.dragTo(sprintOne);
  const details = page.getByRole("heading", { name: "CRM Enhancement" }).last().locator("..", { hasText: "Selected project impact" });
  await expect(page.getByText(/CRM Enhancement · 120 MD · 2 Sprints/)).toBeVisible();

  const start = page.locator("label", { hasText: "Start sprint" }).locator("select");
  const end = page.locator("label", { hasText: "End sprint" }).locator("select");
  await start.selectOption("3");
  await end.selectOption("5");
  await expect(page.getByText(/120 MD · S3–S5 · 3 Sprints/)).toBeVisible();

  await page.getByRole("button", { name: "Return to backlog" }).click();
  await expect(page.getByRole("button", { name: "Schedule in S1" }).first()).toBeVisible();
  await expect(details).not.toBeVisible();
});

test("starting a resize does not live-preview or persist a changed end sprint", async ({ page }) => {
  await page.getByRole("button", { name: "Schedule in S1" }).first().click();
  const resizeHandle = page.getByRole("separator", { name: "Resize CRM Enhancement end sprint" });
  const before = await page.evaluate(() => localStorage.getItem("kkps-pmo:roadmap-planning:v1"));

  await resizeHandle.dispatchEvent("dragstart", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  await resizeHandle.dispatchEvent("dragend");

  await expect(page.getByText(/120 MD · S1–S2 · 2 Sprints/)).toBeVisible();
  const after = await page.evaluate(() => localStorage.getItem("kkps-pmo:roadmap-planning:v1"));
  expect(after).toBe(before);
});

test("moves, extends, and shrinks a scheduled bar on whole-sprint boundaries", async ({ page }) => {
  await page.getByRole("button", { name: "Schedule in S1" }).first().click();
  const sprint = (number: number) => page.getByText(`S${number}`, { exact: true }).first().locator("..");

  await page.getByRole("button", { name: "CRM Enhancement, S1 to S2" }).dragTo(sprint(5));
  await expect(page.getByRole("button", { name: "CRM Enhancement, S5 to S6" })).toBeVisible();

  const dropResizeAt = async (number: number) => sprint(number).evaluate((target, projectId) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/resize-project-id", projectId);
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  }, "crm");

  await dropResizeAt(8);
  await expect(page.getByRole("button", { name: "CRM Enhancement, S5 to S8" })).toBeVisible();

  await dropResizeAt(5);
  await expect(page.getByRole("button", { name: "CRM Enhancement, S5 to S5" })).toBeVisible();
  await expect(page.getByText(/120 MD · 1 Sprint/)).toBeVisible();
});
