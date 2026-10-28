/** Start an isolated QA playthrough through the rendered entry UI. */
export async function startMuseumGame(page, teamId = 1) {
  if (await page.locator('#start-game').isVisible()) {
    await page.locator('#start-game').click();
    if (await page.locator('.invitation-open').count()) {
      await page.locator('.invitation-open').click();
      // The paper becomes clickable before its opening animation finishes; entry is gated on reading.
      await page.waitForFunction(() => document.querySelector('.invitation-open')?.hidden === true);
      await page.locator('.invitation-enter').click();
      await page.locator('.invitation-team-choice').nth(teamId - 1).click();
    } else {
      await page.locator('#team-buttons button').nth(teamId - 1).click();
    }
  } else {
    await page.locator('#team-buttons button').nth(teamId - 1).click();
  }
  await page.waitForFunction(() => !document.getElementById('game').hidden);
}
