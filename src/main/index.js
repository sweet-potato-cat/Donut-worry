import { app, shell, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import { registerIpcHandlers } from './ipc.js'
import { stopSync } from './courses.js'

let mainWindow = null

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
  mainWindow.setSize(DONUT_SIZE, DONUT_SIZE)
  positionWindowAtCursor()
  mainWindow.webContents.send('subdonut:open', { index, cursor: getCursorPointInWindow() })
  mainWindow.show()
}

// 우측 Ctrl/Alt/Cmd도 좌측과 동일하게 취급 (사용자가 어느 쪽을 누르든 조합이 성립하도록)
function normalizeKeycode(keycode) {
  if (keycode === UiohookKey.CtrlRight) return UiohookKey.Ctrl
  if (keycode === UiohookKey.AltRight) return UiohookKey.Alt
  if (keycode === UiohookKey.MetaRight) return UiohookKey.Meta
  return keycode
}

// mac: Option(Alt)+Space, Windows: Ctrl+Alt+D
// 두 경우 모두 "누르고 있는 동안" 도넛을 표시해야 하므로, keyup을 감지 못하는
// globalShortcut 대신 uiohook으로 keydown/keyup을 직접 추적한다.
const HOLD_COMBO =
  process.platform === 'darwin'
    ? [UiohookKey.Alt, UiohookKey.Space]
    : [UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey.D]

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
  return isComboActive(HOLD_COMBO)
}

function registerHoldListener() {
  uIOhook.on('keydown', (e) => {
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

  uIOhook.start()
}

function registerWindowIpc() {
  ipcMain.on('window:hide', () => {
    hideDonutWindow()
  })

  ipcMain.on('window:show-page', () => {
    if (!mainWindow) return
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
  registerHoldListener()

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
})
