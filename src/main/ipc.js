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
  'course:list',
  'course:listFiles',
  'course:openFile',
  'course:sync',
  'course:syncStatus',
  'assignment:sync',
  'assignment:getAll',
  'assignment:complete',
  'assignment:listCourses',
  'assignment:listByCourse',
  'assignment:open',
  'video:sync',
  'video:getAll',
  'video:listCourses',
  'video:listByCourse',
  'video:open',
  'notice:sync',
  'notice:getAll',
  'notice:read',
  'notice:list',
  'notice:open',
  'sync:all',
  'settings:get',
  'settings:setMainHotkey',
  'settings:resetMainHotkey',
  'timetable:list',
  'timetable:add',
  'timetable:remove',
  'grading:listCourses',
  'credentials:get',
  'credentials:save',
  'credentials:clear'
]

export function registerIpcHandlers() {
  CHANNELS.forEach((channel) => {
    ipcMain.handle(channel, async (_event, payload) => {
      return handle(channel, payload)
    })
  })
}
