import { test, expect } from './fixtures';

test('should load extension and toggle demo mode', async ({
  page,
  context,
  extensionId,
}) => {
  // Go to options page
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  // Find the "Demo mode" checkbox (ID `#checkbox-mock-mode`) and check it if not checked.
  const checkbox = page.locator('#checkbox-mock-mode');
  await expect(checkbox).toBeVisible();

  const isChecked = await checkbox.isChecked();
  if (!isChecked) {
    await checkbox.click();
  }

  // Verify it is checked
  await expect(checkbox).toBeChecked();

  // Verify that the status message "Demo mode active — no real iCloud data" is displayed.
  const statusMessage = page.locator('role=status', {
    hasText: 'Demo mode active — no real iCloud data',
  });
  await expect(statusMessage).toBeVisible();

  // Open a new page/tab in the context and load chrome-extension://${extensionId}/popup.html.
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  // Verify the demo mode banner "Demo mode — no real iCloud data" is visible.
  const demoBanner = popupPage.locator('role=status', {
    hasText: 'Demo mode — no real iCloud data',
  });
  await expect(demoBanner).toBeVisible();

  // Extract the initial generated email address from the span element (span.max-w-\[260px\] or similar).
  const emailSpan = popupPage.locator('span.max-w-\\[260px\\]');
  await expect(emailSpan).toBeVisible();

  // Wait until the email address is loaded (not empty and contains '@')
  await expect(emailSpan).not.toHaveText('');
  await expect(emailSpan).toContainText('@');

  const initialEmail = (await emailSpan.innerText()).trim();
  expect(initialEmail).toBeTruthy();
  expect(initialEmail).toContain('@');

  // Click the refresh button (button[aria-label="Refresh email"])
  const refreshButton = popupPage.locator('button[aria-label="Refresh email"]');
  await expect(refreshButton).toBeVisible();
  await refreshButton.click();

  // Verify that the email address element updates to show a different, valid email address.
  await expect(emailSpan).not.toHaveText(initialEmail);

  const updatedEmail = (await emailSpan.innerText()).trim();
  expect(updatedEmail).toBeTruthy();
  expect(updatedEmail).toContain('@');
  expect(updatedEmail).toMatch(
    /^[a-z]+\.[a-z]+\.\d+@privaterelay\.appleid\.com$/
  );
});
