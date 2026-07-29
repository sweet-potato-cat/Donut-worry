/**
 * settings.js — 환경설정(단축키/시간표) 저장 전담
 * userData/settings.json에 JSON으로 저장. core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

const DEFAULT_MAIN_HOTKEY = process.platform === 'darwin' ? ['Alt', 'Space'] : ['Ctrl', 'Alt', 'D']

const DEFAULTS = {
  mainHotkey: DEFAULT_MAIN_HOTKEY,
  timetable: []
}

let cache = null

function load() {
  if (cache) return cache
  if (!fs.existsSync(SETTINGS_PATH)) {
    cache = { ...DEFAULTS }
    return cache
  }
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    cache = {
      mainHotkey: Array.isArray(raw.mainHotkey) ? raw.mainHotkey : DEFAULTS.mainHotkey,
      timetable: Array.isArray(raw.timetable) ? raw.timetable : []
    }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

function persist() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(cache, null, 2), 'utf-8')
}

export function getSettings() {
  return { ...load() }
}

export function getMainHotkey() {
  return load().mainHotkey
}

export function setMainHotkey(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('잘못된 단축키 조합입니다')
  }
  load().mainHotkey = keys
  persist()
  return load().mainHotkey
}

export function resetMainHotkey() {
  load().mainHotkey = DEFAULT_MAIN_HOTKEY
  persist()
  return load().mainHotkey
}

export function getLoginItemStatus() {
  return { openAtLogin: app.getLoginItemSettings().openAtLogin }
}

export function setLoginItemStatus(enabled) {
  app.setLoginItemSettings({ openAtLogin: !!enabled })
  return getLoginItemStatus()
}

export function listTimetable() {
  return load().timetable
}

export function addTimetableEntry({ day, time, label }) {
  const entry = { id: crypto.randomUUID(), day, time, label: label ?? '' }
  load().timetable.push(entry)
  persist()
  return entry
}

export function removeTimetableEntry(id) {
  const settings = load()
  settings.timetable = settings.timetable.filter((entry) => entry.id !== id)
  persist()
  return settings.timetable
}
