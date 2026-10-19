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
  await expect(page.getByRole("heading", { name: "CRM Enhancement" })).toBeVisible();
  await page.getByRole("button", { name: "Schedule in S1" }).first().click();
  await expect(page.getByRole("button", { name: "CRM Enhancement, S1 to S2" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kkps-pmo:local-mock-data:v1"))).toContain(projectId);
  expect(await page.evaluate(() => localStorage.getItem("kkps-pmo:roadmap-planning:v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("kkps-pmo:effort-estimation:v1"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: "CRM Enhancement, S1 to S2" })).toBeVisible();
  await page.getByRole("button", { name: "CRM Enhancement, S1 to S2" }).click();
  await page.getByRole("button", { name: "Return to backlog" }).click();
  await expect(page.getByRole("heading", { name: "CRM Enhancement" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Unified New Project" })).toHaveCount(1);
  await page.getByRole("link", { name: "Planning" }).click();
  await expect(page.getByRole("heading", { name: "Unified New Project" })).toHaveCount(1);
});

test("edits project-first effort estimates and preserves canonical demand data in Demo Mode", async ({ page }) => {
  await page.getByRole("button", { name: "Effort Estimation" }).click();
  await expect(page.getByRole("heading", { name: "Effort Estimation" })).toBeVisible();
  await page.getByLabel("Search projects").fill("crm");
  await expect(page.getByRole("row", { name: /CRM Enhancement/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Digital Onboarding/ })).toHaveCount(0);
  await page.getByLabel("Search projects").fill("");
  await page.getByRole("button", { name: "Not Estimated", exact: true }).click();
  await expect(page.getByText("3 projects")).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  const projectRow = page.getByRole("row", { name: /CRM Enhancement/ });
  await projectRow.getByRole("button", { name: "Expand" }).click();
  await page.getByLabel("Squad to add to CRM Enhancement").selectOption({ label: "Squad Alpha" });
  await page.getByRole("button", { name: "+ Add Squad" }).first().click();
  await page.getByLabel("CRM Enhancement Squad Alpha Dev MD").fill("12.5");
  await page.getByLabel("CRM Enhancement Squad Alpha QA MD").fill("4.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "CRM Enhancement" }).first()).toContainText("17");
  await page.reload();
  await page.getByRole("button", { name: "Effort Estimation" }).click();
  await page.getByRole("row").filter({ hasText: "CRM Enhancement" }).first().getByRole("button", { name: "Expand" }).click();
  await expect(page.getByLabel("CRM Enhancement Squad Alpha Dev MD")).toHaveValue("12.5");
  await page.getByRole("button", { name: "Roadmap" }).click();
  await expect(page.locator("article").filter({ hasText: "CRM Enhancement" }).first()).toContainText("17 MD");
});

test("member capacity is the only active source and Capacity Timeline stays in Roadmap", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Capacity Timeline" })).toBeVisible();
  await expect(page.getByText("Not Configured", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Squad Capacity Planner" }).click();
  await expect(page.getByText(/identity mapping/i)).toHaveCount(0);
  await expect(page.getByLabel("MD per Sprint")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Capacity Timeline" })).toHaveCount(0);
});

test("completes planner interactions and persists them in Demo Mode", async ({ page }) => {
  await page.getByRole("button", { name: "Squad Capacity Planner" }).click();
  await expect(page.getByRole("heading", { name: "Squad Capacity Planner" })).toBeVisible();
  await page.getByText("Manage Squad Members", { exact: true }).click();
  await page.getByLabel("New member name").fill("Demo Member");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await page.getByLabel("Demo Member default availability").fill("80");
  await expect(page.getByText("Per-Sprint overrides")).toHaveCount(0);
  await page.getByText("Manage Work Types", { exact: true }).click();
  await page.getByLabel("Move Dev down").click();
  await page.getByLabel("Row employee").selectOption({ label: "Demo Member" });
  await page.getByLabel("Row work type").selectOption({ label: "Dev" });
  await page.getByRole("button", { name: "Add Row" }).click();
  await page.getByLabel("Demo Member Dev S1", { exact: true }).fill("60");
  await page.getByLabel("Row work type").selectOption({ label: "SA" });
  await page.getByRole("button", { name: "Add Row" }).click();
  await page.getByLabel("Demo Member SA S1", { exact: true }).fill("50");
  await expect(page.getByRole("row", { name: /Total allocated 110%/ })).toBeVisible();
  await page.getByRole("button", { name: "Copy" }).first().click();
  await page.getByLabel("Copy source Sprint").selectOption({ label: "S1" });
  await page.getByLabel("Copy destination start").fill("2");
  await page.getByLabel("Copy destination end").fill("3");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apply copy" }).click();
  await expect(page.getByLabel("Demo Member Dev S3", { exact: true })).toHaveValue("60");
  await page.getByRole("img", { name: /100% stacked area chart/ }).getByText("S1", { exact: true }).click();
  await expect(page.getByLabel("Demo Member Dev S1", { exact: true }).locator("xpath=ancestor::td")).toHaveClass(/bg-\[#f5f9d7\]/);
  await page.reload();
  await page.getByLabel("Sprint calendar").selectOption({ label: "Local Mock 2027 · 2027-01-04" });
  await page.getByRole("button", { name: "Squad Capacity Planner" }).click();
  await expect(page.getByLabel("Demo Member Dev S3", { exact: true })).toHaveValue("60");
  await expect(page.getByRole("heading", { name: "Manage Capacity Periods" })).toHaveCount(0);
});

test("previews individual Sprint adjustment and creates a separate calendar version", async ({ page }) => {
  await page.getByRole("button", { name: "Sprint Calendar Setup" }).click();
  await page.getByLabel("Sprint count").fill("3");
  await page.getByLabel("S2 start").fill("2027-01-16");
  await expect(page.getByText(/S2 overlaps the previous Sprint/)).toBeVisible();
  await page.getByLabel("S2 start").fill("2027-01-20");
  await page.getByLabel("S2 end").fill("2027-01-31");
  await page.getByLabel("S3 Holiday / Non-working Days").fill("2");
  await expect(page.getByLabel("S3 Holiday / Non-working Days").locator("xpath=ancestor::tr")).toContainText("8");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Confirm and create calendar version" }).click();
  await expect(page.getByText("Compatible · 3 Sprints")).toBeVisible();
  await page.getByLabel("Sprint calendar").selectOption({ label: "Local Mock 2027 · 2027-01-04" });
  await expect(page.getByText("Compatible · 26 Sprints")).toBeVisible();
});

test("one global non-working-day adjustment recalculates member capacity for every squad", async ({ page }) => {
  await page.getByRole("button", { name: "Squad Capacity Planner" }).click();
  await page.getByText("Manage Squad Members", { exact: true }).click();
  await page.getByLabel("New member name").fill("Alpha Member");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await page.getByLabel("Planner squad").selectOption({ label: "Squad Beta" });
  await page.getByLabel("New member name").fill("Beta Member");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await page.getByLabel("Beta Member default availability").fill("50");
  await page.getByRole("button", { name: "Roadmap" }).click();
  await page.getByRole("button", { name: "Sprint Calendar Setup" }).click();
  await page.getByLabel("Sprint count").fill("1");
  await page.getByLabel("S1 Holiday / Non-working Days").fill("2");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Confirm and create calendar version" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Squad Alpha" })).toContainText("0 demand / 8 capacity");
  await expect(page.getByRole("row").filter({ hasText: "Squad Beta" })).toContainText("0 demand / 4 capacity");
});
