import {
  app,
  shell,
  BrowserWindow,
  globalShortcut,
  screen,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import { registerIpcHandlers } from './ipc.js'
import { stopSync } from './courses.js'
import { getMainHotkey } from './settings.js'
import { startScheduler, stopScheduler } from './scheduler.js'

let mainWindow = null
let preferencesWindow = null
let tray = null
let donutEnabled = true

const DONUT_SIZE = 500

function getPageSize() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return { width: Math.round(width * 0.7), height: Math.round(height * 0.7) }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createPreferencesWindow() {
  if (preferencesWindow) {
    preferencesWindow.show()
    preferencesWindow.focus()
    return
  }

  preferencesWindow = new BrowserWindow({
    width: 640,
    height: 520,
    minWidth: 560,
    minHeight: 440,
    title: '환경설정',
    backgroundColor: '#1c1c1e',
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 } }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  preferencesWindow.on('closed', () => {
    preferencesWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    preferencesWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/preferences.html`)
  } else {
    preferencesWindow.loadFile(join(__dirname, '../renderer/preferences.html'))
  }
}

let donutHeld = false
const heldKeys = new Set()

// 창 재배치 직후 OS 커서 위치를 창 기준 좌표로 변환
// (도넛을 다시 그릴 때 마우스가 이미 섹터 위에 있어도 호버를 즉시 반영하기 위함)
function getCursorPointInWindow() {
  if (!mainWindow) return null
  const { x, y } = screen.getCursorScreenPoint()
  const bounds = mainWindow.getBounds()
  return { x: x - bounds.x, y: y - bounds.y }
}

// 창 중심이 현재 마우스 커서 위치에 오도록 배치 (모니터 작업영역을 벗어나지 않게 clamp)
function positionWindowAtCursor() {
  if (!mainWindow) return
  const cursor = screen.getCursorScreenPoint()
  const [width, height] = mainWindow.getSize()
  const { x: dx, y: dy, width: dw, height: dh } = screen.getDisplayNearestPoint(cursor).workArea

  const x = Math.max(dx, Math.min(Math.round(cursor.x - width / 2), dx + dw - width))
  const y = Math.max(dy, Math.min(Math.round(cursor.y - height / 2), dy + dh - height))

  mainWindow.setPosition(x, y)
}

function showDonutWindow() {
  if (!mainWindow) return
  // 페이지를 보다가 다시 호출된 경우 아래에서 꺼둔 alwaysOnTop을 팝업 모드로 복귀
  mainWindow.setAlwaysOnTop(true)
  mainWindow.setSize(DONUT_SIZE, DONUT_SIZE)
  positionWindowAtCursor()
  // 창을 보이기 전에 렌더러 상태부터 리셋시켜, 숨겨져 있던 동안 남아있던
  // 이전 화면이 한 프레임이라도 먼저 노출되지 않게 한다
  mainWindow.webContents.send('main:show', getCursorPointInWindow())
  mainWindow.show()
}

function hideDonutWindow() {
  if (!mainWindow) return
  mainWindow.hide()
}

let subDonutHeldIndex = null

function showSubDonutWindow(index) {
  if (!mainWindow) return
  mainWindow.setAlwaysOnTop(true)
  mainWindow.setSize(DONUT_SIZE, DONUT_SIZE)
  positionWindowAtCursor()
  mainWindow.webContents.send('subdonut:open', { index, cursor: getCursorPointInWindow() })
  mainWindow.show()
}

// 메뉴바 아이콘에서 도넛 단축키 자체를 껐다 켰다 할 수 있게 함
// (다른 앱과 단축키가 충돌하거나 잠깐 방해받고 싶지 않을 때 앱을 끄지 않고도 끌 수 있도록)
function setDonutEnabled(enabled) {
  donutEnabled = enabled
  if (!enabled) {
    // 끄는 순간 눌려 있던 조합/열려 있던 도넛 창 상태를 모두 정리
    donutHeld = false
    subDonutHeldIndex = null
    heldKeys.clear()
    hideDonutWindow()
  }
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: '도넛 단축키 사용',
      type: 'checkbox',
      checked: donutEnabled,
      click: () => setDonutEnabled(!donutEnabled)
    },
    { type: 'separator' },
    { label: '환경설정...', click: () => createPreferencesWindow() },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ])
}

// 패키징된 앱에서는 resources가 app.asar 밖에 실제 파일로 존재하고,
// 개발 중에는 프로젝트 소스를 그대로 가리킨다 (courses.js의 resolveScraperEntry와 동일한 패턴)
function resolveTrayIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png')
}

function createTray() {
  const icon = nativeImage.createFromPath(resolveTrayIconPath()).resize({ width: 18, height: 18 })
  tray = new Tray(icon)
  tray.setToolTip('Donut Worry')
  tray.on('click', () => tray.popUpContextMenu(buildTrayMenu()))
  tray.on('right-click', () => tray.popUpContextMenu(buildTrayMenu()))
}

// 우측 Ctrl/Alt/Cmd도 좌측과 동일하게 취급 (사용자가 어느 쪽을 누르든 조합이 성립하도록)
function normalizeKeycode(keycode) {
  if (keycode === UiohookKey.CtrlRight) return UiohookKey.Ctrl
  if (keycode === UiohookKey.AltRight) return UiohookKey.Alt
  if (keycode === UiohookKey.MetaRight) return UiohookKey.Meta
  return keycode
}

// mac 기본값: Option(Alt)+Space, Windows 기본값: Ctrl+Alt+D
// 두 경우 모두 "누르고 있는 동안" 도넛을 표시해야 하므로, keyup을 감지 못하는
// globalShortcut 대신 uiohook으로 keydown/keyup을 직접 추적한다.
// 환경설정에서 언제든 바꿀 수 있으므로 상수로 캐싱하지 않고 매번 settings에서 읽는다.
function getHoldCombo() {
  return getMainHotkey()
    .map((name) => UiohookKey[name])
    .filter((code) => code !== undefined)
}

// Sub 도넛(강의자료/과제/동영상)도 Main 도넛과 동일하게 누르고 있는 동안만 표시
const SUB_HOLD_COMBOS =
  process.platform === 'darwin'
    ? [
        { index: 0, keys: [UiohookKey.Meta, UiohookKey[1]] },
        { index: 1, keys: [UiohookKey.Meta, UiohookKey[2]] },
        { index: 2, keys: [UiohookKey.Meta, UiohookKey[3]] }
      ]
    : [
        { index: 0, keys: [UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey[1]] },
        { index: 1, keys: [UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey[2]] },
        { index: 2, keys: [UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey[3]] }
      ]

function isComboActive(keys) {
  return keys.every((key) => heldKeys.has(key))
}

function isHoldComboActive() {
  const combo = getHoldCombo()
  return combo.length > 0 && isComboActive(combo)
}

function registerHoldListener() {
  uIOhook.on('keydown', (e) => {
    if (!donutEnabled) return
    heldKeys.add(normalizeKeycode(e.keycode))

    if (isHoldComboActive() && !donutHeld) {
      donutHeld = true
      showDonutWindow()
    }

    if (subDonutHeldIndex === null) {
      const combo = SUB_HOLD_COMBOS.find((c) => isComboActive(c.keys))
      if (combo) {
        subDonutHeldIndex = combo.index
        showSubDonutWindow(combo.index)
      }
    }
  })

  uIOhook.on('keyup', (e) => {
    if (!donutEnabled) return
    heldKeys.delete(normalizeKeycode(e.keycode))

    if (donutHeld && !isHoldComboActive()) {
      donutHeld = false
      mainWindow?.webContents.send('main:confirm')
    }

    if (subDonutHeldIndex !== null && !isComboActive(SUB_HOLD_COMBOS[subDonutHeldIndex].keys)) {
      subDonutHeldIndex = null
      mainWindow?.webContents.send('subdonut:confirm')
    }
  })

  // uiohook의 native start()는 Accessibility 권한이 없으면 동기적으로 예외를
  // 던진다. 여기서 잡지 않으면 app.whenReady() 콜백 나머지(단축키 등록,
  // 스케줄러 시작 등)가 통째로 실행되지 않아 앱이 아무 반응 없이 켜진 것처럼 보임
  try {
    uIOhook.start()
  } catch (err) {
    dialog.showErrorBox(
      '단축키를 사용할 수 없습니다',
      `키보드 입력을 감지하지 못했습니다: ${err.message}\n\n` +
        '시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 donut-worry 권한을 껐다가 다시 켠 뒤, 앱을 완전히 종료하고 재실행해주세요.'
    )
  }
}

function registerWindowIpc() {
  ipcMain.on('window:hide', () => {
    hideDonutWindow()
  })

  ipcMain.on('window:show-page', () => {
    if (!mainWindow) return
    // 페이지는 도넛 팝업과 달리 계속 참고하며 다른 창과 오가는 실제 콘텐츠이므로
    // 항상 위에 떠 있으면 안 됨 (다시 도넛을 열 때 showDonutWindow/showSubDonutWindow가
    // alwaysOnTop을 되돌려놓는다)
    mainWindow.setAlwaysOnTop(false)
    const { width, height } = getPageSize()
    mainWindow.setSize(width, height)
    mainWindow.center()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.donut-worry')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  registerWindowIpc()
  createWindow()
  createTray()
  registerHoldListener()
  startScheduler()
  globalShortcut.register('CommandOrControl+,', createPreferencesWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  uIOhook.stop()
  stopSync()
  stopScheduler()
})
