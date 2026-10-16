import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("link", { name: "Run my first role free" }).click();
  await ready(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("link", { name: "Open sign-in link" }).click();
}

/** Wait until client components are interactive (cold dev servers hydrate slowly). */
async function ready(page: Page) {
  await page.locator("[data-ready]").first().waitFor({ timeout: 90_000 });
}

async function fillSample(page: Page) {
  await ready(page);
  await page.getByRole("button", { name: "Fill with a sample role" }).click();
  await expect(page.getByLabel("Job title")).toHaveValue("Customer Support Executive");
}

let replies = 0;
/** Send one reply as the candidate and wait until the engine has answered it. */
async function sim(page: Page, text: string, voice = false) {
  const bubbles = page.locator('[data-from="candidate"]');
  await page.getByLabel("Reply").fill(text);
  await page.getByRole("button", { name: voice ? "Send as voice note" : "Send", exact: true }).click();
  replies++;
  await expect(bubbles).toHaveCount(replies);
}

test("recruiter runs a free test role end to end", async ({ page }) => {
  await signUp(page, `e2e-${Date.now()}@example.com`);

  // Onboarding
  await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
  await page.getByLabel("Agency or company name").fill("E2E Staffing");
  await page.getByRole("button", { name: "Continue" }).click();

  // Job + rubric from the sample role
  await fillSample(page);
  await page.getByRole("button", { name: "Save and upload candidates" }).click();

  // CSV upload with preview
  await expect(page.getByRole("heading", { name: "Upload candidates" })).toBeVisible();
  await ready(page);
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures/candidates.csv"));
  await expect(page.getByText("Rows with problems")).toBeVisible();
  await expect(page.getByText("No consent recorded")).toBeVisible();
  await expect(page.getByText("Not a valid Indian mobile")).toBeVisible();
  await page.getByRole("button", { name: "Add 2 candidates" }).click();

  // Free test launch (no payment)
  await expect(page.getByText("Candidates uploaded.")).toBeVisible();
  await page.getByRole("button", { name: "Start free test" }).click();
  await expect(page.getByText("Screening started")).toBeVisible();

  // Candidate answers in the simulator
  await page.getByRole("link", { name: "Phone simulator" }).click();
  await ready(page);
  await expect(page.getByText(/is hiring for Customer Support Executive/)).toBeVisible();
  await sim(page, "YES");
  await expect(page.getByText(/Question 1\/5/)).toBeVisible();
  await sim(page, "Yes, I speak Hindi and English fluently with customers");
  await sim(page, "3 years customer support experience at an e-commerce company");
  await sim(page, "repeat");
  await expect(page.getByText(/Question 3\/5/).nth(1)).toBeVisible();
  await sim(page, "Yes I have used Freshdesk CRM ticketing software", true);
  await sim(page, "Current 18000, expected 22000");
  await sim(page, "Within 2 weeks, yes I can work from the Bengaluru office");
  await expect(page.getByText(/Your answers have been sent to the recruiter/)).toBeVisible();

  // Shortlist, transcript, edit, tag, export
  await page.getByRole("link", { name: /Customer Support Executive/ }).click();
  await page.getByRole("link", { name: "Shortlist" }).first().click();
  const row = page.locator(".card", { hasText: "Asha Rao" }).first();
  await expect(row.getByText("Completed")).toBeVisible();
  await row.getByRole("link", { name: "Asha Rao" }).click();
  await expect(page.getByRole("heading", { name: "Score" })).toBeVisible();
  await expect(page.getByText("Voice note").first()).toBeVisible();
  await page.getByText("Edit score").click();
  await page.getByLabel("Score (0-100)").fill("88");
  await page.getByLabel("Reason (kept in the audit log)").fill("Strong call");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Score updated.")).toBeVisible();
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove from shortlist" })).toBeVisible();

  await page.getByRole("link", { name: /Customer Support Executive/ }).click();
  await page.getByRole("button", { name: "Mark as reviewed" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const csv = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of csv) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  expect(text).toContain("Asha Rao");
  expect(text).toContain(",88,");

  // Client share link shows only shortlisted candidates, without phone numbers
  await page.getByRole("button", { name: "Create link" }).click();
  const shareUrl = (await page.getByText(/\/share\//).textContent())!.match(/https?:\/\/\S+\/share\/[\w-]+/)![0];
  await page.goto(shareUrl);
  await expect(page.getByText("Asha Rao")).toBeVisible();
  await expect(page.getByText("+91")).toHaveCount(0);
});

test("paid job: messages wait for the UPI payment webhook", async ({ page }) => {
  await signUp(page, `e2e-paid-${Date.now()}@example.com`);
  await page.getByLabel("Agency or company name").fill("Paid Staffing");
  await page.getByRole("button", { name: "Continue" }).click();
  await fillSample(page);
  await page.getByLabel(/Free test mode/).uncheck();
  await page.getByRole("button", { name: "Save and upload candidates" }).click();
  await expect(page.getByRole("heading", { name: "Upload candidates" })).toBeVisible();
  await ready(page);
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures/candidates.csv"));
  await page.getByRole("button", { name: "Add 2 candidates" }).click();

  await expect(page.getByRole("button", { name: /Pay ₹1,499 by UPI/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Phone simulator" })).toHaveCount(0);
  await page.getByRole("button", { name: /Pay ₹1,499 by UPI/ }).click();
  await expect(page.getByText("Simulated payment")).toBeVisible();
  await page.getByRole("button", { name: /Pay ₹1,499 \(simulated\)/ }).click();
  await expect(page.getByText("Screening started")).toBeVisible();
  await page.getByRole("link", { name: "Receipt" }).click();
  await expect(page.getByRole("heading", { name: "Payment receipt" })).toBeVisible();
});

test("demo workspace opens with seeded data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "See a demo workspace" }).click();
  await expect(page.getByText("Demo workspace with sample data")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: /Delivery Executive/ }).click();
  await page.getByRole("link", { name: "Shortlist" }).first().click();
  await expect(page.getByText("Rohit Patil")).toBeVisible();
  await expect(page.getByText("Opted out").first()).toBeVisible();
});

test("public pages render", async ({ page }) => {
  for (const [url, heading] of [
    ["/pricing", "One price per job. Pay by UPI."],
    ["/help", "Help"],
    ["/status", "Status"],
    ["/legal/terms", "Terms of Service"],
    ["/legal/privacy", "Privacy Policy"],
    ["/legal/dpa", "Data Processing Terms"],
    ["/legal/refunds", "Refund Policy"],
    ["/legal/candidate-privacy", "If we messaged you about a job"],
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  const res = await page.request.get("/app");
  expect(res.url()).toContain("/login");
});
