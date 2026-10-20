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

  await page.getByRole("button", { name: "Expand CRM Enhancement" }).click();
  await page.getByLabel("Squad to add").selectOption({ label: "Squad Alpha" });
  await page.getByRole("button", { name: "Add Squad" }).click();
  await page.getByLabel("CRM Enhancement Dev MD").fill("12.5");
  await page.getByLabel("CRM Enhancement QA MD").fill("4.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Total 17 MD/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Expand CRM Enhancement" }).click();
  await expect(page.getByLabel("CRM Enhancement Dev MD")).toHaveValue("12.5");
});

test("manages 205 projects with compact table controls", async ({ page }) => {
  await resetDemo(page);
  await expect(page.getByText("3 active projects")).toBeVisible();
  await page.evaluate(() => {
    const key = "kkps-pmo:local-mock-data:v1";
    const store = JSON.parse(localStorage.getItem(key) ?? "null");
    const created = "2027-01-01T00:00:00.000Z";
    for (let index = 1; index <= 202; index += 1) {
      store.projects.push({
        id: `50000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        project_name: `Scale Project ${String(index).padStart(3, "0")}`,
        description: `Scale test project ${index}`,
        business_unit: index % 2 === 0 ? "Retail" : "Operations",
        owner_name: `Owner ${index}`,
        target_date: `2027-${String((index % 12) + 1).padStart(2, "0")}-15`,
        status: index % 3 === 0 ? "completed" : "active",
        metadata: {}, archived_at: null, created_at: created, updated_at: created,
      });
    }
    localStorage.setItem(key, JSON.stringify(store));
  });
  await page.reload();
  await expect(page.getByText("205 active projects")).toBeVisible();
  await expect(page.getByText("Showing 1–25 of 205")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 9")).toBeVisible();
  await page.getByLabel("Projects per page").selectOption("50");
  await expect(page.getByText("Showing 1–50 of 205")).toBeVisible();

  await page.getByLabel("Search projects").fill("Scale Project 200");
  await expect(page.getByRole("button", { name: "Expand Scale Project 200" })).toBeVisible();
  await page.getByLabel("Search projects").fill("");
  await page.getByLabel("Filter by business unit").selectOption("Retail");
  await page.getByLabel("Filter by status").selectOption("completed");
  await expect(page.getByText(/of 33$/)).toBeVisible();
  await page.getByLabel("Filter by status").selectOption("");
  await page.getByLabel("Filter by business unit").selectOption("");

  await page.getByRole("button", { name: /Target Date/ }).click();
  await expect(page.getByRole("columnheader", { name: /Target Date/ })).toHaveAttribute("aria-sort", "ascending");
  const expand = page.getByRole("button", { name: "Expand CRM Enhancement" });
  await expand.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Multi-Squad Effort Estimation" })).toBeVisible();
  await page.screenshot({ path: "test-results/projects-table-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project name").fill("New Portfolio Item");
  await page.getByRole("textbox", { name: "Business unit", exact: true }).fill("Digital");
  await page.getByRole("button", { name: "Save Project" }).click();
  await expect(page.getByRole("button", { name: "Collapse New Portfolio Item" })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Project name", exact: true }).fill("Updated Portfolio Item");
  await page.getByRole("button", { name: "Save Project" }).click();
  await expect(page.getByRole("button", { name: "Collapse Updated Portfolio Item" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive", exact: true }).last().click();
  await expect(page.getByText("Updated Portfolio Item", { exact: true })).toHaveCount(0);
});

test("uses the Sprint Roadmap as the primary planning experience", async ({ page }) => {
  await resetDemo(page, `/planning?project=${projectId}`);
  await expect(page.getByRole("heading", { name: "Quarterly Roadmap" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Quarter Plan" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Annual Sprint Timeline" })).toBeVisible();
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
      await page.screenshot({ path: "test-results/projects-table-mobile.png", fullPage: true });
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByText("Planning", { exact: true })).toBeVisible();
    }
  });
}
