import { app, shell, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import { registerIpcHandlers } from './ipc.js'

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

let altDown = false
let spaceDown = false
let donutHeld = false

function showDonutWindow() {
  if (!mainWindow) return
  activeSubDonutIndex = null
  mainWindow.setSize(DONUT_SIZE, DONUT_SIZE)
  mainWindow.center()
  mainWindow.show()
  mainWindow.webContents.send('main:show')
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

// Option(Alt)+Space를 누르고 있는 동안 도넛 표시, 떼는 순간 main:confirm 전달
// (globalShortcut은 keyup을 감지하지 못해 uiohook으로 직접 후킹)
function registerHoldListener() {
  uIOhook.on('keydown', (e) => {
    if (e.keycode === UiohookKey.Alt) altDown = true
    if (e.keycode === UiohookKey.Space) spaceDown = true

    if (altDown && spaceDown && !donutHeld) {
      donutHeld = true
      showDonutWindow()
    }
  })

  uIOhook.on('keyup', (e) => {
    if (e.keycode === UiohookKey.Alt) altDown = false
    if (e.keycode === UiohookKey.Space) spaceDown = false

    if (donutHeld && !(altDown && spaceDown)) {
      donutHeld = false
      mainWindow?.webContents.send('main:confirm')
    }
  })

  uIOhook.start()
}

function registerShortcuts() {
  const modifier = process.platform === 'darwin' ? 'Cmd' : 'Ctrl'

  // Main 도넛이 열려있을 때 cmd+1~3 → Sub 도넛 (강의자료/과제/동영상)
  globalShortcut.register(`${modifier}+1`, () => openSubDonut(0))
  globalShortcut.register(`${modifier}+2`, () => openSubDonut(1))
  globalShortcut.register(`${modifier}+3`, () => openSubDonut(2))
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

  ipcMain.on('window:show-donut', () => {
    if (!mainWindow) return
    mainWindow.setSize(DONUT_SIZE, DONUT_SIZE)
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
})
