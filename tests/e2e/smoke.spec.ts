import { expect, test, type Browser } from "@playwright/test";

const MOBILE = { width: 380, height: 820 };
const SHOTS = "docs/screenshots";

async function contextWithLocale(browser: Browser, locale: "cs" | "en") {
  const ctx = await browser.newContext({ viewport: MOBILE });
  await ctx.addCookies([
    { name: "locale", value: locale, url: "http://localhost:3000" },
  ]);
  return ctx;
}

test("healthz reports DB + transactions", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.transactions).toBe(true);
});

test("home renders localized chrome and switches language", async ({ page }) => {
  await page.setViewportSize(MOBILE);

  await page.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3000" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("The whole life of a group trip")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/home-380-en.png`, fullPage: true });

  // Switch to Czech via the language switcher and confirm chrome changes.
  await page.getByRole("button", { name: "Čeština" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await expect(page.getByText("Celý život skupinového výletu")).toBeVisible();
});

test("design gallery renders all primitives at 380px (EN + CS)", async ({ browser }) => {
  for (const locale of ["en", "cs"] as const) {
    const ctx = await contextWithLocale(browser, locale);
    const page = await ctx.newPage();
    await page.goto("/gallery");

    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    // Section headers (mono uppercase labels) — all primitive groups present.
    for (const label of ["Buttons", "Status badges", "Avatars", "bottom nav"]) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
    // Status badges: tones rendered (label sits next to an aria-hidden glyph,
    // so match on substring rather than exact text).
    await expect(page.getByText("settled", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("provisional", { exact: false }).first()).toBeVisible();

    await page.screenshot({ path: `${SHOTS}/gallery-380-${locale}.png`, fullPage: true });
    await ctx.close();
  }
});

test("design gallery on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/gallery");
  await expect(page.getByText("Design system")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/gallery-desktop.png`, fullPage: true });
});
