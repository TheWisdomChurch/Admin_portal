import { chromium } from '@playwright/test';

const sizes = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'large', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 2560, height: 1440 },
];

const browser = await chromium.launch();
for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `/private/tmp/ai-502/-Users-testapp-Documents-TechDev-Admin-portal/212f3dc1-57fc-4466-8a3e-ef9315ea3e15/scratchpad/shots/login-${s.name}.png` });
  await page.close();
}
await browser.close();
console.log('done');
