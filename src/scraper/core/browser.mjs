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
async function attemptAutoLogin(page) {
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

  // 저장된 자격증명이 실제로 무엇을 담고 있는지는 로그에 남기지 않되(값 자체는
  // 절대 노출하지 않음), 길이 정도는 남겨서 저장/전달 과정에서 잘리거나 공백이
  // 섞여 들어가는 문제가 있었는지 나중에 구분할 수 있게 함
  console.log(
    `Attempting automatic login (id length: ${id.length}, password length: ${password.length}).`
  )

  const hasOnLogon = await page
    .evaluate(() => typeof window.OnLogon === 'function')
    .catch(() => false)
  console.log(`window.OnLogon is a function: ${hasOnLogon}`)

  // 자동화 브라우저임을 사이트가 감지해 로그인 자체를 막는 경우가 있어(예:
  // navigator.webdriver 검사) 이것도 함께 남긴다
  const webdriverFlag = await page.evaluate(() => navigator.webdriver).catch(() => 'unknown')
  console.log(`navigator.webdriver: ${webdriverFlag}`)

  // 로그인 실패 시 alert()로 사유를 띄우는 사이트가 있는데, 기존 코드는 이걸
  // 그냥 무시하고 닫아버려서 실패 원인이 로그에 전혀 안 남았음
  const onDialog = (dialog) => {
    console.log(`Dialog appeared during login: "${dialog.message()}"`)
    dialog.dismiss().catch(() => {})
  }
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

  // OnLogon()의 폼 제출이 사이트 자체의 리다이렉트를 촉발시키는데, 그게 아직
  // 진행 중일 때 navigateAndCheckAuth처럼 우리가 또 page.goto()로 새 네비게이션을
  // 걸면 그 리다이렉트와 경쟁하다 Playwright가 net::ERR_ABORTED로 취소해버린다
  // (매번 재현됨). 그래서 여기서는 새 네비게이션을 걸지 않고, 사이트가 스스로
  // khcanvas.khu.ac.kr(로그인 아닌 경로)에 도달할 때까지 지켜보기만 한 뒤 같은
  // 오리진에서 API로 인증 여부를 확인한다
  let authenticated = false
  try {
    await page.waitForFunction(
      () => location.hostname === 'khcanvas.khu.ac.kr' && !location.pathname.includes('/login'),
      null,
      { timeout: 15000 }
    )
    await page.waitForLoadState('networkidle').catch(() => {})
    authenticated = await isCanvasApiAuthenticated(page)
  } catch (error) {
    console.log(`Automatic login: failed to verify authentication after submit: ${error.message}`)
    return false
  }

  if (!authenticated) {
    const bodyText = await page
      .evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 300))
      .catch(() => '?')
    console.log(
      `Automatic login did not result in an authenticated session (landed on: ${page.url()}, title: "${await page.title().catch(() => '?')}", page text: "${bodyText}").`
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
  // 대시보드류 페이지는 백그라운드 요청이 계속 떠 있어 networkidle이 안 걸릴 수
  // 있으므로(courses.mjs에서 실제로 재현됨) 짧게만 시도하고 못 걸려도 넘어간다
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
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
