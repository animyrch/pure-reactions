import { chromium } from 'playwright';

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:5174';
  const path = process.env.PATH_TO_TEST || '/reaction/C1QPlJuBromFBVtmdIpW';
  const url = new URL(path, base).toString();
  console.log('Navigating to', url);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle' });
    console.log('Initial status:', resp?.status());
    // Wait for the button to be available
    const btn = page.locator('text=View all reactions');
    await btn.waitFor({ timeout: 5000 });
      const outer = await btn.evaluate((n) => n.outerHTML);
      console.log('Button outerHTML:', outer);
      await btn.click();
      // give client-side navigation a moment
    await page.waitForTimeout(500);
    const overlay = await page.$('vite-error-overlay');
    if (overlay) {
      const text = await overlay.evaluate((n) => n.innerText);
      console.log('Vite overlay present:', text.slice(0, 1000));
    }
    console.log('After click URL:', page.url());
  } catch (err) {
    console.error('Error during check:', err);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
