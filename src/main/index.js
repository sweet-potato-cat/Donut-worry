import { app, shell, BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc.js'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    show: false,
    frame: false,           // 창 테두리 제거
    transparent: true,      // 투명 창
    alwaysOnTop: true,      // 항상 위에 표시
    skipTaskbar: true,      // 작업표시줄 숨김
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
  // option × 2 → Main Donut 표시/숨김
  // Mac: Alt, Windows: Alt
  let lastAltTime = 0
  globalShortcut.register('Alt', () => {
    const now = Date.now()
    if (now - lastAltTime < 400) {
      // 400ms 안에 두 번 누르면 토글
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
      }
      lastAltTime = 0
    } else {
      lastAltTime = now
    }
  })

  // cmd+1 ~ cmd+4 → Sub Donut (Mac: Cmd, Windows: Ctrl)
  const modifier = process.platform === 'darwin' ? 'Cmd' : 'Ctrl'

  globalShortcut.register(`${modifier}+1`, () => {
    mainWindow?.webContents.send('donut:select', { index: 0 }) // 강의자료
  })
  globalShortcut.register(`${modifier}+2`, () => {
    mainWindow?.webContents.send('donut:select', { index: 1 }) // 과제
  })
  globalShortcut.register(`${modifier}+3`, () => {
    mainWindow?.webContents.send('donut:select', { index: 2 }) // 미시청 동영상
  })
  globalShortcut.register(`${modifier}+4`, () => {
    mainWindow?.webContents.send('donut:select', { index: 3 }) // 공지 요약
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.donut-worry')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC 핸들러 등록 (core.js로 라우팅)
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

// 앱 종료 시 단축키 해제
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})