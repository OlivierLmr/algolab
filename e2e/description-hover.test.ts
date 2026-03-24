import { test, expect } from '@playwright/test'

/**
 * E2E tests for description panel ↔ code panel hover highlighting.
 *
 * When hovering over entries in the description panel (block descriptions,
 * history entries, current description), the corresponding line in the
 * code panel should get the `.code-line-hovered` CSS class.
 */

test.describe('Description hover → code line highlight', () => {
  test.beforeEach(async ({ page }) => {
    // Load Bubble Sort (algo index 0), advance a few steps so we have
    // block descriptions and history entries.
    await page.goto('./#algo=0&step=10')
    await page.waitForSelector('.code-panel', { timeout: 10000 })
    await page.waitForSelector('.description', { timeout: 10000 })
  })

  test('hovering a block description highlights a code line', async ({ page }) => {
    // Find a step with block descriptions
    for (let step = 5; step <= 60; step += 5) {
      await page.goto(`./#algo=0&step=${step}`)
      await page.waitForSelector('.code-panel', { timeout: 5000 })
      if (await page.locator('.description-block').count() > 0) break
    }

    const blockEl = page.locator('.description-block').first()
    await expect(blockEl).toBeVisible()

    // Before hover: no hovered line
    expect(await page.locator('.code-line-hovered').count()).toBe(0)

    // Hover over the block description
    await blockEl.hover()
    await page.waitForTimeout(300)

    // After hover: should see exactly one hovered line
    const hoveredCount = await page.locator('.code-line-hovered').count()
    const blockText = await blockEl.textContent()
    console.log(`Block description text: "${blockText}", hovered lines: ${hoveredCount}`)

    expect(hoveredCount).toBe(1)
  })

  test('hovering a history entry highlights a code line', async ({ page }) => {
    let found = false
    for (let step = 5; step <= 60; step += 3) {
      await page.goto(`./#algo=0&step=${step}`)
      await page.waitForSelector('.code-panel', { timeout: 5000 })
      if (await page.locator('.description-previous').count() > 0) {
        found = true
        break
      }
    }

    if (!found) {
      test.skip()
      return
    }

    const historyEl = page.locator('.description-previous').first()
    await expect(historyEl).toBeVisible()

    expect(await page.locator('.code-line-hovered').count()).toBe(0)

    await historyEl.hover()

    const hoveredLine = page.locator('.code-line-hovered')
    await expect(hoveredLine).toHaveCount(1, { timeout: 2000 })
  })

  test('hovering the current description highlights a code line', async ({ page }) => {
    let found = false
    for (let step = 1; step <= 60; step += 2) {
      await page.goto(`./#algo=0&step=${step}`)
      await page.waitForSelector('.code-panel', { timeout: 5000 })
      if (await page.locator('.description-current').count() > 0) {
        found = true
        break
      }
    }

    if (!found) {
      test.skip()
      return
    }

    const currentEl = page.locator('.description-current').first()
    await expect(currentEl).toBeVisible()

    await currentEl.hover()

    // The current description's line is usually the active line.
    // Both classes should now coexist (active + hovered).
    const hoveredLine = page.locator('.code-line-hovered')
    await expect(hoveredLine).toHaveCount(1, { timeout: 2000 })
  })

  test('mouse leave clears the highlight', async ({ page }) => {
    for (let step = 5; step <= 60; step += 3) {
      await page.goto(`./#algo=0&step=${step}`)
      await page.waitForSelector('.code-panel', { timeout: 5000 })
      if (await page.locator('.description-previous').count() > 0) break
    }

    const historyEl = page.locator('.description-previous').first()
    if (await historyEl.count() === 0) {
      test.skip()
      return
    }

    await historyEl.hover()
    await expect(page.locator('.code-line-hovered')).toHaveCount(1, { timeout: 2000 })

    // Move away
    await page.locator('.code-panel').hover()

    await expect(page.locator('.code-line-hovered')).toHaveCount(0, { timeout: 2000 })
  })

  test('block description hover — debug diagnostics', async ({ page }) => {
    // Detailed diagnostic test for the block description hover bug.
    for (let step = 5; step <= 80; step += 5) {
      await page.goto(`./#algo=0&step=${step}`)
      await page.waitForSelector('.code-panel', { timeout: 5000 })
      if (await page.locator('.description-block').count() > 0) break
    }

    const blockEl = page.locator('.description-block').first()
    if (await blockEl.count() === 0) {
      test.skip()
      return
    }

    // Gather pre-hover state
    const preState = await page.evaluate(() => {
      const blocks = document.querySelectorAll('.description-block')
      const codeLines = document.querySelectorAll('.code-line')
      return {
        blockCount: blocks.length,
        codeLineCount: codeLines.length,
        blockTexts: Array.from(blocks).map(b => b.textContent),
        activeLineIndex: Array.from(codeLines).findIndex(l => l.classList.contains('code-line-active')),
      }
    })
    console.log('Pre-hover state:', JSON.stringify(preState, null, 2))

    // Hover the block description
    await blockEl.hover()
    await page.waitForTimeout(500)

    // Gather post-hover state
    const postState = await page.evaluate(() => {
      const codeLines = document.querySelectorAll('.code-line')
      const hoveredIndices: number[] = []
      codeLines.forEach((l, i) => {
        if (l.classList.contains('code-line-hovered')) hoveredIndices.push(i)
      })
      return {
        hoveredCount: hoveredIndices.length,
        hoveredIndices,
        // Check all code-line classes for debugging
        codeLineClasses: Array.from(codeLines).slice(0, 15).map((l, i) => ({
          index: i,
          text: l.textContent?.trim().substring(0, 40),
          classes: l.className,
        })),
      }
    })
    console.log('Post-hover state:', JSON.stringify(postState, null, 2))

    // Verify the highlight appeared
    expect(postState.hoveredCount).toBe(1)
  })
})
