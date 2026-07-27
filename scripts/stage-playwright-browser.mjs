// mac 빌드 전에 실행: 이 컴퓨터의 Playwright 브라우저 캐시에서 chromium(+headless shell)만
// resources/playwright-browsers/ 로 복사해 앱에 함께 번들링되게 한다.
// 배포 대상 컴퓨터에는 Playwright/브라우저가 설치돼 있지 않으므로, 앱 실행 시
// 이 경로를 PLAYWRIGHT_BROWSERS_PATH로 지정해서 별도 다운로드 없이 바로 쓸 수 있게 함
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

// Playwright 브라우저 캐시 기본 위치는 OS마다 다름
function defaultCacheRoot() {
  if (process.platform === 'darwin')
    return path.join(homedir(), 'Library', 'Caches', 'ms-playwright')
  if (process.platform === 'win32')
    return path.join(process.env.LOCALAPPDATA ?? homedir(), 'ms-playwright')
  return path.join(homedir(), '.cache', 'ms-playwright')
}

const CACHE_ROOT = process.env.PLAYWRIGHT_BROWSERS_PATH || defaultCacheRoot()
const DEST_ROOT = path.resolve('resources', 'playwright-browsers')

if (!existsSync(CACHE_ROOT)) {
  console.error(
    `Playwright 브라우저 캐시를 찾을 수 없습니다: ${CACHE_ROOT}\n` +
      `먼저 'npx playwright install chromium'을 실행해주세요.`
  )
  process.exit(1)
}

const wanted = readdirSync(CACHE_ROOT).filter(
  (name) => name.startsWith('chromium-') || name.startsWith('chromium_headless_shell-')
)

if (wanted.length === 0) {
  console.error(
    `chromium 브라우저가 설치돼 있지 않습니다.\n` +
      `'npx playwright install chromium'을 먼저 실행해주세요.`
  )
  process.exit(1)
}

rmSync(DEST_ROOT, { recursive: true, force: true })
mkdirSync(DEST_ROOT, { recursive: true })

for (const name of wanted) {
  cpSync(path.join(CACHE_ROOT, name), path.join(DEST_ROOT, name), { recursive: true })
  console.log(`복사됨: ${name}`)
}

console.log(`Playwright 브라우저를 ${DEST_ROOT} 에 준비했습니다.`)
