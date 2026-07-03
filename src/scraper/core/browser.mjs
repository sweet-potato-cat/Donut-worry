async function getPlaywright() {
  try {
    return await import('playwright')
  } catch {
    throw new Error('Playwright is not installed. Run: npm.cmd install -D playwright')
  }
}

async function waitForCanvasLogin(page, targetUrl) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })

  const currentUrl = new URL(page.url())

  if (
    currentUrl.hostname === 'khcanvas.khu.ac.kr' &&
    !currentUrl.pathname.includes('/login') &&
    (await isCanvasApiAuthenticated(page))
  ) {
    return
  }

  console.log('Login page detected.')
  console.log('Please log in in the opened browser. Waiting up to 5 minutes...')

  await page.waitForFunction(
    () => location.hostname === 'khcanvas.khu.ac.kr' && !location.pathname.includes('/login'),
    null,
    { timeout: 300000 }
  )
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(
    async () => {
      try {
        const response = await fetch('/api/v1/users/self', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })

        return response.ok
      } catch {
        return false
      }
    },
    null,
    { timeout: 300000 }
  )
}

async function isCanvasApiAuthenticated(page) {
  try {
    return await page.evaluate(async () => {
      const response = await fetch('/api/v1/users/self', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      })

      return response.ok
    })
  } catch {
    return false
  }
}

export { getPlaywright, waitForCanvasLogin }
