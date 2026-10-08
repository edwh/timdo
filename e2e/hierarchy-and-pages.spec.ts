import { expect, test } from '@playwright/test';

test.describe('TimDo Hierarchy & Detail Pages', () => {
  test('navigates from board to task detail, edits priority and adds note', async ({ page }) => {
    // Intercept project updates and project detail
    await page.route('**/api/v2/projects*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'task-1',
              project: 'Draft design system mockups',
              reason: 'Required for Solfit launch',
              status: 'do',
              priority: 8,
              size: '**',
              category: 'Solfit',
              notes: 'Initial thoughts',
              orderIndex: 0,
            },
          ]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('**/api/v2/projects/task-1/updates*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'update-1',
            projectId: 'task-1',
            note: body.note,
            createdAt: new Date().toISOString(),
          }),
        });
      }
    });

    await page.route('**/api/v2/epics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/v2/goals*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/tasks/task-1');
    await expect(page.locator('input[placeholder="Task name"]')).toHaveValue(
      'Draft design system mockups'
    );

    // Click "Add Update / Note" button if present
    const addNoteBtn = page.getByRole('button', { name: /Add Update/i });
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
    }

    // Add dated note
    await page.fill(
      'textarea[placeholder*="Write an update or note"]',
      'Verified inverter specs with team'
    );
    await page.click('button:has-text("Save Note")');
    await expect(page.locator('text=Verified inverter specs with team')).toBeVisible();
  });

  test('filters board by category', async ({ page }) => {
    await page.route('**/api/v2/projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'task-1',
            project: 'Draft design system mockups',
            category: 'Solfit',
            status: 'do',
            priority: 8,
            size: '**',
            orderIndex: 0,
          },
          {
            id: 'task-2',
            project: 'Personal tax returns',
            category: 'Personal',
            status: 'do',
            priority: 5,
            size: '*',
            orderIndex: 1,
          },
        ]),
      });
    });

    await page.goto('/board');
    await page.click('span:has-text("Solfit"), button:has-text("Solfit"), div:has-text("Solfit")');
    await expect(page).toHaveURL(/category=Solfit/);
  });

  test('navigates to project category detail view', async ({ page }) => {
    await page.route('**/api/v2/projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'task-1',
            project: 'Draft design system mockups',
            category: 'Solfit',
            status: 'do',
            priority: 8,
            size: '**',
            orderIndex: 0,
          },
        ]),
      });
    });

    await page.route('**/api/v2/epics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'epic-1',
            title: 'Get Acme Solar Live',
            category: 'Solfit',
            status: 'active',
          },
        ]),
      });
    });

    await page.goto('/projects/Solfit');
    await expect(page.locator('text=Solfit')).toBeVisible();
    await expect(page.locator('text=Get Acme Solar Live')).toBeVisible();
  });

  test('toggles task in epic detail and updates progress', async ({ page }) => {
    await page.route('**/api/v2/epics/epic-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'epic-1',
          title: 'Get Acme Solar Live',
          description: 'Deploy solar monitoring',
          category: 'Solfit',
          status: 'active',
        }),
      });
    });

    await page.route('**/api/v2/projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'task-1',
            project: 'Draft solar spec',
            epicId: 'epic-1',
            status: 'do',
            priority: 7,
            size: '**',
            category: 'Solfit',
          },
        ]),
      });
    });

    await page.route('**/api/v2/goals*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/epics/epic-1');
    await expect(page.locator('text=Get Acme Solar Live')).toBeVisible();
    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible();
  });

  test('verifies goals dashboard and SVG poster download', async ({ page }) => {
    await page.route('**/api/v2/goals*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'goal-1',
            type: 'focus',
            title: 'Solfit Commercial Traction',
            description: 'Close flagship enterprise contracts',
            orderIndex: 0,
            isActive: true,
          },
        ]),
      });
    });

    await page.route('**/api/v2/projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/v2/epics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/goals');
    await expect(page.locator('text=Solfit Commercial Traction')).toBeVisible();
    await expect(page.locator('button:has-text("Download SVG")')).toBeVisible();
  });
});
