async function getPlaywright() {
  try {
    return await import('playwright')
  } catch {
    throw new Error('Playwright is not installed. Run: npm.cmd install -D playwright')
  }
}

// 페이지를 targetUrl로 이동시키고 로그인 여부를 확인. SSO 리다이렉트가 domcontentloaded
// 이후에도 이어질 수 있어 networkidle까지 기다린 뒤 판단해 오탐(false negative)을 줄임
async function navigateAndCheckAuth(page, targetUrl) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})

  const currentUrl = new URL(page.url())
  if (currentUrl.hostname !== 'khcanvas.khu.ac.kr' || currentUrl.pathname.includes('/login')) {
    return false
  }

  return isCanvasApiAuthenticated(page)
}

async function waitForCanvasLogin(page, targetUrl, { allowManualLogin = true } = {}) {
  if (await navigateAndCheckAuth(page, targetUrl)) return true

  if (await autoSubmitRememberedLogin(page, targetUrl)) return true

  if (!allowManualLogin) return false

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
  return true
}

async function autoSubmitRememberedLogin(page, targetUrl) {
  await page
    .waitForFunction(
      () => {
        const passwordInput = document.querySelector('input[type="password"]')
        const textInput =
          document.querySelector('input[type="text"]') ??
          document.querySelector('input[name*="id" i], input[name*="user" i]')

        return Boolean(passwordInput?.value && textInput?.value)
      },
      null,
      { timeout: 5000 }
    )
    .catch(() => {})

  const submitted = await page
    .evaluate(() => {
      const passwordInput = document.querySelector('input[type="password"]')
      const textInput =
        document.querySelector('input[type="text"]') ??
        document.querySelector('input[name*="id" i], input[name*="user" i]')

      if (!passwordInput?.value || !textInput?.value) {
        return false
      }

      const loginControl =
        [...document.querySelectorAll('button, input[type="submit"], a')]
          .filter((element) => {
            const text = `${element.textContent ?? ''} ${element.value ?? ''}`.trim()
            return /login/i.test(text)
          })
          .find((element) => !element.disabled) ??
        passwordInput.closest('form')?.querySelector('button, input[type="submit"]')

      if (loginControl) {
        loginControl.click()
        return true
      }

      const form = passwordInput.closest('form')
      if (form) {
        form.requestSubmit?.()
        form.submit?.()
        return true
      }

      return false
    })
    .catch(() => false)

  if (!submitted) return false

  console.log('Saved login fields detected. Submitting login automatically.')

  await page
    .waitForFunction(
      () => location.hostname === 'khcanvas.khu.ac.kr' && !location.pathname.includes('/login'),
      null,
      { timeout: 30000 }
    )
    .catch(() => {})

  await page.waitForLoadState('networkidle').catch(() => {})
  return navigateAndCheckAuth(page, targetUrl)
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

export { getPlaywright, waitForCanvasLogin, navigateAndCheckAuth }
