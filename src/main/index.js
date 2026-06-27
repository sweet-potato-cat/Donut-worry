import { app, shell, BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc.js'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

function registerShortcuts() {
  const modifier = process.platform === 'darwin' ? 'Cmd' : 'Ctrl'

  globalShortcut.register(`${modifier}+1`, () => {
    mainWindow?.webContents.send('donut:select', { index: 0 })
  })
  globalShortcut.register(`${modifier}+2`, () => {
    mainWindow?.webContents.send('donut:select', { index: 1 })
  })
  globalShortcut.register(`${modifier}+3`, () => {
    mainWindow?.webContents.send('donut:select', { index: 2 })
  })
  globalShortcut.register(`${modifier}+4`, () => {
    mainWindow?.webContents.send('donut:select', { index: 3 })
  })
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