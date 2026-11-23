/**
 * Visual Regression Test Suite for Air Quality Dashboard
 * Framework: Playwright (@playwright/test)
 * Compatible with: Percy, Chromatic, Storybook Visual Test runner
 *
 * Viewports tested:
 * - 320x568   (Mobile - iPhone SE)
 * - 390x844   (Mobile - iPhone 12/13/14)
 * - 768x1024  (Tablet - iPad Portrait)
 * - 1366x768  (Laptop / Desktop standard)
 * - 1920x1080 (Large Desktop - 1080p Full HD)
 */

import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile-small', width: 320, height: 568 },
  { name: 'mobile-medium', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop-hd', width: 1920, height: 1080 },
];

test.describe('Air Quality Dashboard - Visual Regression Suite', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
      });

      // ──────────────────────────────────────────
      // 1. Dashboard State Scenarios
      // ──────────────────────────────────────────
      test('dashboard initial state (unsubmitted/ready)', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.hero')).toBeVisible();
        await expect(page.locator('.setup-card')).toBeVisible();
        await expect(page).toHaveScreenshot(`dashboard-initial-${vp.name}.png`);
      });

      test('dashboard state - Good AQI (0-50)', async ({ page }) => {
        await page.route('**/api/plan', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plan: {
                location: 'Bengaluru',
                summary: 'Clear air day for outdoor recreation.',
                members: [
                  {
                    id: 'adult_1',
                    label: 'Adult 1',
                    vulnerable: false,
                    periods: {
                      morning: { activity: 'Morning jog in park', outdoor: true, why: 'AQI 32 is clean.' },
                      afternoon: { activity: 'Open windows for ventilation', outdoor: true, why: 'Low particle count.' },
                      evening: { activity: 'Evening walk', outdoor: true, why: 'Safe conditions.' },
                    },
                  },
                ],
                indoorAirHacks: ['Keep indoor ventilation open.'],
                sustainableAlternatives: ['Cycle or walk.'],
              },
              source: 'llm',
              fallback: false,
              airQuality: {
                status: 'available',
                aqi: 32,
                pm25: 8,
                pm10: 14,
                forecast: Array.from({ length: 24 }, (_, i) => ({
                  time: `2026-11-23T${String(i).padStart(2, '0')}:00`,
                  pm25: 8 + (i % 5),
                  aqi: 30 + (i % 6),
                })),
              },
              overrides: [],
            }),
          });
        });

        await page.goto('/');
        await page.fill('#location', 'Bengaluru');
        await page.click('.primary-button');
        await expect(page.locator('.health-card')).toBeVisible();
        await expect(page).toHaveScreenshot(`dashboard-good-aqi-${vp.name}.png`);
      });

      test('dashboard state - Hazardous AQI (301+)', async ({ page }) => {
        await page.route('**/api/plan', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plan: {
                location: 'Delhi',
                summary: 'Severe pollution alert.',
                members: [
                  {
                    id: 'child_1',
                    label: 'Child 1',
                    vulnerable: true,
                    periods: {
                      morning: { activity: 'Stay strictly indoors', outdoor: false, why: 'AQI 380 hazardous.' },
                      afternoon: { activity: 'Indoor reading', outdoor: false, why: 'Severe pollution.' },
                      evening: { activity: 'Seal windows and sleep with HEPA', outdoor: false, why: 'Hazardous air.' },
                    },
                  },
                ],
                indoorAirHacks: ['Seal all exterior drafts.', 'Run HEPA on maximum.'],
                sustainableAlternatives: ['Avoid non-essential trips.'],
              },
              source: 'fallback',
              fallback: true,
              airQuality: {
                status: 'available',
                aqi: 380,
                pm25: 310,
                pm10: 480,
                forecast: Array.from({ length: 24 }, (_, i) => ({
                  time: `2026-11-23T${String(i).padStart(2, '0')}:00`,
                  pm25: 300 + (i % 30),
                  aqi: 370 + (i % 25),
                })),
              },
              overrides: [
                { timestamp: new Date().toISOString(), memberId: 'child_1', period: 'morning', action: 'replaced' },
              ],
            }),
          });
        });

        await page.goto('/');
        await page.fill('#location', 'Delhi');
        await page.click('.primary-button');
        await expect(page.locator('.health-card')).toBeVisible();
        await expect(page.locator('.safety-log')).toBeVisible();
        await expect(page).toHaveScreenshot(`dashboard-hazardous-aqi-${vp.name}.png`);
      });

      // ──────────────────────────────────────────
      // 2. Chart State Scenarios
      // ──────────────────────────────────────────
      test('chart state - Loading Skeleton', async ({ page }) => {
        await page.route('**/api/plan', async () => {
          // Never resolve to keep loading state active
          await new Promise(() => {});
        });
        await page.goto('/');
        await page.fill('#location', 'Pune');
        await page.click('.primary-button');
        await expect(page.locator('.primary-button')).toHaveAttribute('aria-busy', 'true');
        await expect(page).toHaveScreenshot(`chart-loading-${vp.name}.png`);
      });

      test('chart state - Partial Data State', async ({ page }) => {
        await page.route('**/api/plan', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plan: {
                location: 'Shimla',
                summary: 'Mountain air report.',
                members: [{ id: 'adult_1', label: 'Adult 1', vulnerable: false, periods: { morning: { activity: 'Walk', outdoor: true } } }],
              },
              source: 'llm',
              fallback: false,
              airQuality: {
                status: 'available',
                aqi: 45,
                pm25: 11,
                // Sparse partial dataset (only 6 hours)
                forecast: Array.from({ length: 6 }, (_, i) => ({
                  time: `2026-11-23T${String(i).padStart(2, '0')}:00`,
                  pm25: 10 + i,
                  aqi: 40 + i,
                })),
              },
              overrides: [],
            }),
          });
        });
        await page.goto('/');
        await page.fill('#location', 'Shimla');
        await page.click('.primary-button');
        await expect(page.locator('.partial-data-banner')).toBeVisible();
        await expect(page).toHaveScreenshot(`chart-partial-${vp.name}.png`);
      });

      // ──────────────────────────────────────────
      // 3. Theme State Scenarios (Light / Dark)
      // ──────────────────────────────────────────
      test('theme state - Dark Mode', async ({ page }) => {
        await page.goto('/');
        // Click theme toggle button
        await page.click('button[aria-label*="dark"]');
        await expect(page.locator('body')).toHaveClass(/dark/);
        await expect(page).toHaveScreenshot(`theme-dark-${vp.name}.png`);
      });

      // ──────────────────────────────────────────
      // 4. Household State Scenarios
      // ──────────────────────────────────────────
      test('household state - Multi-member Family (with Elder, Child, Asthma)', async ({ page }) => {
        await page.goto('/');
        await page.fill('#household-size input', '4');
        await page.fill('#children-count input', '1');
        await page.fill('#elderly-count input', '1');
        await page.fill('#respiratory-count input', '1');
        await page.check('#asthma');
        await expect(page.locator('.household-summary')).toBeVisible();
        await expect(page).toHaveScreenshot(`household-family-${vp.name}.png`);
      });
    });
  }
});
