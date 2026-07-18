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

function showDonutWindow() {
  if (!mainWindow) return
  activeSubDonutIndex = null
  mainWindow.setSize(DONUT_SIZE, DONUT_SIZE)
  mainWindow.center()
  mainWindow.show()
  mainWindow.webContents.send('main:show', getCursorPointInWindow())
}

function hideDonutWindow() {
  if (!mainWindow) return
  activeSubDonutIndex = null
  mainWindow.hide()
}

let activeSubDonutIndex = null

function openSubDonut(index) {
  if (!mainWindow) return

  if (mainWindow.isVisible() && activeSubDonutIndex === index) {
    activeSubDonutIndex = null
    hideDonutWindow()
    return
  }

  activeSubDonutIndex = index
  mainWindow.setSize(DONUT_SIZE, DONUT_SIZE)
  mainWindow.center()
  mainWindow.show()
  mainWindow.webContents.send('subdonut:open', { index })
}

// 우측 Ctrl/Alt도 좌측과 동일하게 취급 (사용자가 어느 쪽을 누르든 조합이 성립하도록)
function normalizeKeycode(keycode) {
  if (keycode === UiohookKey.CtrlRight) return UiohookKey.Ctrl
  if (keycode === UiohookKey.AltRight) return UiohookKey.Alt
  return keycode
}

// mac: Option(Alt)+Space, Windows: Ctrl+Alt+D
// 두 경우 모두 "누르고 있는 동안" 도넛을 표시해야 하므로, keyup을 감지 못하는
// globalShortcut 대신 uiohook으로 keydown/keyup을 직접 추적한다.
const HOLD_COMBO =
  process.platform === 'darwin'
    ? [UiohookKey.Alt, UiohookKey.Space]
    : [UiohookKey.Ctrl, UiohookKey.Alt, UiohookKey.D]

function isHoldComboActive() {
  return HOLD_COMBO.every((key) => heldKeys.has(key))
}

function registerHoldListener() {
  uIOhook.on('keydown', (e) => {
    heldKeys.add(normalizeKeycode(e.keycode))

    if (isHoldComboActive() && !donutHeld) {
      donutHeld = true
      showDonutWindow()
    }
  })

  uIOhook.on('keyup', (e) => {
    heldKeys.delete(normalizeKeycode(e.keycode))

    if (donutHeld && !isHoldComboActive()) {
      donutHeld = false
      mainWindow?.webContents.send('main:confirm')
    }
  })

  uIOhook.start()
}

function registerShortcuts() {
  if (process.platform === 'darwin') {
    // Main 도넛이 열려있을 때 cmd+1~3 → Sub 도넛 (강의자료/과제/동영상)
    globalShortcut.register('Cmd+1', () => openSubDonut(0))
    globalShortcut.register('Cmd+2', () => openSubDonut(1))
    globalShortcut.register('Cmd+3', () => openSubDonut(2))
  } else {
    // Windows: Main 도넛은 registerHoldListener의 Ctrl+Alt+D 홀드 감지로 처리하고,
    // Sub 도넛은 Mac과 동일하게 누를 때마다 열고/닫는 토글 단축키로 유지한다.
    globalShortcut.register('Ctrl+Alt+1', () => openSubDonut(0))
    globalShortcut.register('Ctrl+Alt+2', () => openSubDonut(1))
    globalShortcut.register('Ctrl+Alt+3', () => openSubDonut(2))
  }
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
  registerShortcuts()
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
