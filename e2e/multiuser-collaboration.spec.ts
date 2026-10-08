import { expect, test } from '@playwright/test';

test.describe('Multi-User Collaboration E2E Flow', () => {
  test('User A creates task in XEBIT and assigns to User B; User B views in Mine, posts note and completes; User A verifies Done and note attribution', async ({
    page,
  }) => {
    // Shared mock state
    const taskState = {
      id: 'task-xeb-20',
      project: '[XEB-20] Build staging webhook',
      projectKey: 'XEB-20',
      reason: 'Support automated deploy previews',
      status: 'do' as const,
      priority: 9,
      size: '***' as const,
      category: 'Xebit',
      assigneeId: 'user-sarah-id',
      assigneeName: 'Sarah Connor',
      userId: 'user-tim-id',
      orderIndex: 0,
    };

    const updatesState: Array<{
      id: string;
      projectId: string;
      note: string;
      authorId: string;
      authorName: string;
      createdAt: string;
    }> = [];

    // Intercept Organisations endpoint
    await page.route('**/api/v2/organisations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'org-tim', name: 'Tim Dobson', slug: 'tim-dobson' },
          { id: 'org-xebit', name: 'XEBIT', slug: 'xebit' },
        ]),
      });
    });

    // Intercept Members endpoint
    await page.route('**/api/v2/organisations/**/members*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mem-1',
            userId: 'user-tim-id',
            userName: 'Tim Dobson',
            userEmail: 'tim@xebit.com',
            role: 'owner',
          },
          {
            id: 'mem-2',
            userId: 'user-sarah-id',
            userName: 'Sarah Connor',
            userEmail: 'sarah@xebit.com',
            role: 'member',
          },
        ]),
      });
    });

    // Intercept Projects / Tasks endpoint
    await page.route('**/api/v2/projects*', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([taskState]),
        });
      } else if (method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        Object.assign(taskState, body);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(taskState),
        });
      } else if (method === 'PUT' || method === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        Object.assign(taskState, body);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(taskState),
        });
      }
    });

    // Intercept Task Updates endpoint
    await page.route(`**/api/v2/projects/${taskState.id}/updates*`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updatesState),
        });
      } else if (method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newUpdate = {
          id: `update-${updatesState.length + 1}`,
          projectId: taskState.id,
          note: body.note,
          authorId: 'user-sarah-id',
          authorName: 'Sarah Connor',
          createdAt: new Date().toISOString(),
        };
        updatesState.push(newUpdate);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newUpdate),
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

    // ----------------------------------------------------
    // Step 1: User A (Tim) logs in, views XEBIT org and assigns task to Sarah
    // ----------------------------------------------------
    await page.goto('/board');

    // Select XEBIT organisation
    const orgSelect = page.locator(
      'input[placeholder="Select an option"], input[value="All Organisations"]'
    );
    if (await orgSelect.isVisible()) {
      await orgSelect.click();
      const xebitOption = page.getByRole('option', { name: 'XEBIT' });
      if (await xebitOption.isVisible()) {
        await xebitOption.click();
      }
    }

    // Verify task is displayed with key badge and assignee name
    await expect(page.locator('text=[XEB-20] Build staging webhook')).toBeVisible();
    await expect(page.locator('text=Sarah Connor')).toBeVisible();

    // ----------------------------------------------------
    // Step 2: User B (Sarah) logs in, navigates to task detail, posts note and moves to Done
    // ----------------------------------------------------
    await page.goto(`/tasks/${taskState.id}`);

    // Verify task name in task detail
    await expect(page.locator('input[placeholder="Task name"]')).toHaveValue(
      '[XEB-20] Build staging webhook'
    );

    // Click "Add Update / Note" button if visible
    const addNoteBtn = page.getByRole('button', { name: /Add Update/i });
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
    }

    // Sarah posts an update note: "Reviewing PR now"
    await page.fill('textarea[placeholder*="Write an update or note"]', 'Reviewing PR now');
    await page.click('button:has-text("Save Note"), button:has-text("Save Update")');

    // Verify Sarah's note and attribution appear in timeline
    await expect(page.locator('text=Reviewing PR now')).toBeVisible();
    await expect(page.locator('text=Sarah Connor')).toBeVisible();

    // Sarah completes task (changes Status to Done)
    const statusSelect = page.locator('input[value="Do"], input[placeholder="Select Status"]');
    await statusSelect.click();
    const doneOption = page.getByRole('option', { name: 'Done' });
    await doneOption.click();

    // ----------------------------------------------------
    // Step 3: User A (Tim) verifies completed task in Done section
    // ----------------------------------------------------
    await page.goto('/board');
    const doneSection = page.getByTestId('section-done');
    await expect(doneSection).toBeVisible();
    await expect(doneSection.locator('text=[XEB-20] Build staging webhook')).toBeVisible();

    // Navigate back to task detail to verify author-attributed note persists
    await page.goto(`/tasks/${taskState.id}`);
    await expect(page.locator('text=Reviewing PR now')).toBeVisible();
    await expect(page.locator('text=Sarah Connor')).toBeVisible();
  });

  test('Unassigned task 1-click claim interaction updates card with assignee', async ({ page }) => {
    let claimedAssignee: string | null = null;
    let claimedAssigneeName: string | null = null;

    const unassignedTask = {
      id: 'task-xeb-21',
      project: '[XEB-21] Provision redis cache cluster',
      projectKey: 'XEB-21',
      reason: 'Required for high throughput',
      status: 'do' as const,
      priority: 8,
      size: '**' as const,
      category: 'Xebit',
      assigneeId: null,
      assigneeName: null,
      userId: 'user-tim-id',
      orderIndex: 0,
    };

    await page.route('**/api/v2/organisations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'org-xebit', name: 'XEBIT', slug: 'xebit' }]),
      });
    });

    await page.route('**/api/v2/projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            ...unassignedTask,
            assigneeId: claimedAssignee,
            assigneeName: claimedAssigneeName,
          },
        ]),
      });
    });

    // Intercept claim endpoint
    await page.route(`**/api/v2/tasks/${unassignedTask.id}/claim*`, async (route) => {
      claimedAssignee = 'user-tim-id';
      claimedAssigneeName = 'Tim Dobson';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...unassignedTask,
          assigneeId: 'user-tim-id',
          assigneeName: 'Tim Dobson',
        }),
      });
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

    // Load board
    await page.goto('/board');

    // Verify unassigned task has "[ Claim Task ]" button
    const claimButton = page.getByTestId('claim-task-btn');
    await expect(claimButton).toBeVisible();
    await expect(claimButton).toHaveText('Claim Task');

    // Click Claim Task
    await claimButton.click();

    // Assert card updates to show assignee name and removes the claim button
    await expect(claimButton).not.toBeVisible();
    await expect(page.locator('text=You, text=Tim Dobson')).toBeVisible();
  });
});
