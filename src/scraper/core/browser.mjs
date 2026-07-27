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

// 세션 만료 시 headless 상태를 유지한 채 저장된 자격증명으로 로그인 폼을 직접
// 채워 제출. 자격증명이 없거나 로그인 폼을 찾지 못하면 false를 반환해 호출부가
// 사람이 로그인할 수 있는 창을 띄우는 기존 흐름으로 넘어가게 함
async function attemptAutoLogin(page, targetUrl) {
  const id = process.env.KHU_LOGIN_ID
  const password = process.env.KHU_LOGIN_PASSWORD
  if (!id || !password) {
    console.log('Automatic login skipped: no saved credentials.')
    return false
  }

  const idField = page.locator('#login_user_id')
  const passwordField = page.locator('#login_user_password')

  if ((await idField.count()) === 0 || (await passwordField.count()) === 0) {
    console.log(`Automatic login skipped: login form not found (url: ${page.url()}).`)
    return false
  }

  console.log('Attempting automatic login...')

  const onDialog = (dialog) => dialog.dismiss().catch(() => {})
  page.on('dialog', onDialog)

  try {
    await idField.fill(id)
    await passwordField.fill(password)
    // 로그인 버튼 클릭(synthetic click)은 이 사이트의 실제 제출 로직을 태우지 못함 —
    // 버튼에는 별도 클릭 핸들러가 없고, 페이지의 OnLogon()이 CSRF 토큰을 쿠키에서
    // 읽어 채운 뒤 제출 대상 URL을 gw-cb.php로 바꿔서 폼을 제출하는 구조라
    // 그 함수를 직접 호출해야 실제 로그인 요청이 나감
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page.evaluate(() => window.OnLogon())
    ])
  } catch (error) {
    console.log(`Automatic login submit failed: ${error.message}`)
    return false
  } finally {
    page.off('dialog', onDialog)
  }

  const authenticated = await navigateAndCheckAuth(page, targetUrl)
  if (!authenticated) {
    console.log(
      `Automatic login did not result in an authenticated session (landed on: ${page.url()}, title: "${await page.title().catch(() => '?')}").`
    )
  }
  return authenticated
}

async function waitForCanvasLogin(page, targetUrl) {
  if (await navigateAndCheckAuth(page, targetUrl)) return

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

export { getPlaywright, waitForCanvasLogin, navigateAndCheckAuth, attemptAutoLogin }
