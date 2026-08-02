import { test, expect, type Page } from './fixtures';

/**
 * The browser caps browser-action popups at 600px tall. Nothing in the popup may
 * push the document past this, or the footer actions fall below the fold.
 */
const POPUP_MAX_HEIGHT = 600;

/** Turns on demo mode through the options UI, the way a user would. */
const enableMockMode = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const checkbox = page.locator('#checkbox-mock-mode');
  if (!(await checkbox.isChecked())) {
    await checkbox.click();
  }
  await expect(checkbox).toBeChecked();
};

const openManager = async (popupPage: Page, extensionId: string) => {
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.getByRole('button', { name: /Manage emails/i }).click();
  await expect(
    popupPage.getByRole('tree', { name: 'Hide My Email aliases' })
  ).toBeVisible();
};

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

  // Extract the initial generated email address.
  const emailSpan = popupPage.getByTestId('generated-email');
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

/**
 * A browser-action popup sizes itself to its content, so any content height
 * derived from `100vh` is circular and settles wherever it happens to start —
 * which is what made the manager render squashed. These pages are ordinary tabs
 * and cannot reproduce the popup's auto-resize, but they can pin the property
 * that makes auto-resize converge: the manager's height must be the same
 * whatever the viewport is, and must fit the popup's 600px cap.
 */
test('sizes the alias manager independently of the viewport height', async ({
  page,
  context,
  extensionId,
}) => {
  await enableMockMode(page, extensionId);

  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 740, height: POPUP_MAX_HEIGHT });
  await openManager(popupPage, extensionId);

  const readLayout = () =>
    popupPage.evaluate(() => {
      const panel = document.querySelector('.popup-list-panel');
      return {
        panelHeight: Math.round(panel?.getBoundingClientRect().height ?? 0),
        // body, not documentElement: documentElement.scrollHeight is floored at
        // the viewport height and so cannot detect a document that is too short.
        contentHeight: document.body.scrollHeight,
      };
    });

  const atFullHeight = await readLayout();

  // A popup mid-authentication can be far shorter than its final size. The
  // manager must not shrink to match it.
  await popupPage.setViewportSize({ width: 740, height: 220 });
  const atStartupHeight = await readLayout();

  expect(atStartupHeight.panelHeight).toBeGreaterThan(0);
  expect(atStartupHeight).toEqual(atFullHeight);
  expect(atFullHeight.contentHeight).toBeLessThanOrEqual(POPUP_MAX_HEIGHT);
});

test('keeps every manager action reachable within the popup', async ({
  page,
  context,
  extensionId,
}) => {
  await enableMockMode(page, extensionId);

  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 740, height: POPUP_MAX_HEIGHT });
  await openManager(popupPage, extensionId);

  // Checked at the startup height too: a popup opened mid-authentication settles
  // well short of the 600px cap, and a manager sized off `100vh` is at its
  // smallest — and most likely to clip — exactly there.
  for (const height of [POPUP_MAX_HEIGHT, 220]) {
    await popupPage.setViewportSize({ width: 740, height });

    // The footer sits below the alias panel, so it is the first thing to fall
    // off the bottom if the panel is sized past the popup's budget.
    const footerBottom = await popupPage
      .getByRole('button', { name: /Generate new email/i })
      .evaluate((el) => el.getBoundingClientRect().bottom);
    expect(footerBottom, `footer at viewport ${height}`).toBeLessThanOrEqual(
      POPUP_MAX_HEIGHT
    );

    // The detail pane is a fixed height, so anything overflowing it must be
    // scrollable — otherwise `overflow: hidden` makes it permanently unreachable.
    const unreachable = await popupPage.evaluate(() => {
      const pane =
        document.querySelector('.popup-list-panel')?.lastElementChild;
      if (!pane) {
        return ['detail pane not found'];
      }
      const scrollable = ['auto', 'scroll'].includes(
        getComputedStyle(pane).overflowY
      );
      const paneBottom = pane.getBoundingClientRect().bottom;
      return [...pane.querySelectorAll('button')]
        .filter(
          (el) => !scrollable && el.getBoundingClientRect().bottom > paneBottom
        )
        .map((el) => el.textContent?.trim() ?? '');
    });
    expect(unreachable, `clipped actions at viewport ${height}`).toEqual([]);
  }

  await popupPage.setViewportSize({ width: 740, height: POPUP_MAX_HEIGHT });

  // Prove it end to end: the last action in the pane is genuinely clickable.
  await popupPage
    .getByRole('button', { name: /Edit label & note/i })
    .click({ timeout: 5000 });
  await expect(
    popupPage.getByPlaceholder('Add a short reminder (optional)')
  ).toBeVisible();
});

test('keeps the signed-out popup compact', async ({ context, extensionId }) => {
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 740, height: POPUP_MAX_HEIGHT });
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popupPage.getByText('Sign in to iCloud')).toBeVisible();

  // The login prompt must not stretch the document to the viewport, or the
  // popup opens at full height and never shrinks back.
  const contentHeight = await popupPage.evaluate(
    () => document.body.scrollHeight
  );
  expect(contentHeight).toBeLessThan(POPUP_MAX_HEIGHT);
});
