import { app, shell, BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc.js'

let mainWindow = null

function createWindow() { 
  // Hello
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
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

let lastOptionPressTime = 0

function toggleMainDonut() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
    mainWindow.webContents.send('main:show')
  }
}

function openSubDonut(index) {
  if (!mainWindow?.isVisible()) return
  mainWindow.webContents.send('subdonut:open', { index })
}

function registerShortcuts() {
  const modifier = process.platform === 'darwin' ? 'Cmd' : 'Ctrl'

  // Option(Alt)+Space 두 번 누르면 Main 도넛 토글
  globalShortcut.register('Alt+Space', () => {
    const now = Date.now()
    if (now - lastOptionPressTime < 1000) {
      toggleMainDonut()
      lastOptionPressTime = 0
    } else {
      lastOptionPressTime = now
    }
  })

  // Main 도넛이 열려있을 때 cmd+1~3 → Sub 도넛 (강의자료/과제/동영상)
  globalShortcut.register(`${modifier}+1`, () => openSubDonut(0))
  globalShortcut.register(`${modifier}+2`, () => openSubDonut(1))
  globalShortcut.register(`${modifier}+3`, () => openSubDonut(2))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.donut-worry')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()
  registerShortcuts()

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
})