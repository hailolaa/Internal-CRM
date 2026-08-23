import { expect, test, type Page } from "@playwright/test";

const email = process.env.PLAYWRIGHT_USER_EMAIL || process.env.E2E_USER_EMAIL || "";
const password = process.env.PLAYWRIGHT_USER_PASSWORD || process.env.E2E_USER_PASSWORD || "";

test.skip(!email || !password, "Set PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD to run authenticated smoke checks.");

async function signIn(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
}

async function expectUsableRoute(page: Page, route: string, expectedText: RegExp) {
  await page.goto(route);
  await expect(page.locator("body")).toContainText(expectedText);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow, `${route} should not create horizontal overflow`).toBe(false);
}

test.describe("Mission Control critical browser smoke", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("covers dashboard, leads, pipeline, client conversion, tasks and inbox", async ({ page }) => {
    await expectUsableRoute(page, "/app", /Mission Control|Dashboard|Operations/i);
    await expectUsableRoute(page, "/app/leads", /Leads|Prospects/i);
    await expectUsableRoute(page, "/app/crm/pipeline", /Pipeline/i);
    await expectUsableRoute(page, "/app/ops/client-accounts", /Client accounts|Accounts/i);
    await expectUsableRoute(page, "/app/crm/tasks", /Tasks/i);
    await expectUsableRoute(page, "/app/comms/inbox", /Inbox|Conversations/i);
  });

  test("covers Clinic OS onboarding, appointments and reports", async ({ page }) => {
    await expectUsableRoute(page, "/app/ops/delivery", /Delivery|Onboarding|Operations/i);
    await expectUsableRoute(page, "/app/consults", /Consults|Appointments/i);
    await expectUsableRoute(page, "/app/reports/overview", /Reports|Overview/i);
  });
});
