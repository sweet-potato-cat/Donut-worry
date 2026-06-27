import { ipcMain } from 'electron'
import { handle } from './core.js'

/**
 * ipc.js — IPC 채널 관리
 * renderer → main 요청을 core.js로 위임
 *
 * 채널 추가 시: CHANNELS 배열에 문자열만 추가
 */

const CHANNELS = [
  'lecture:sync',
  'lecture:getAll',
  'assignment:sync',
  'assignment:getAll',
  'assignment:complete',
  'video:sync',
  'video:getAll',
  'notice:sync',
  'notice:getAll',
  'notice:read',
  'sync:all',
]

export function registerIpcHandlers() {
  CHANNELS.forEach((channel) => {
    ipcMain.handle(channel, async (_event, payload) => {
      return handle(channel, payload)
    })
  })
}
