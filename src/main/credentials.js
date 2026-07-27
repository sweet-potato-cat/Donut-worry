/**
 * credentials.js — 경희대 SSO 자동로그인용 계정 저장 전담
 * safeStorage(OS 키체인 기반)로 암호화해 userData/credentials.enc에 저장.
 * 평문 비밀번호는 디스크에 절대 쓰지 않음. core.js에서만 호출됨.
 */

import fs from 'fs'
import path from 'path'
import { app, safeStorage } from 'electron'

const CREDENTIALS_PATH = path.join(app.getPath('userData'), 'credentials.enc')

function load() {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null
  if (!safeStorage.isEncryptionAvailable()) return null

  try {
    const encrypted = fs.readFileSync(CREDENTIALS_PATH)
    const decrypted = safeStorage.decryptString(encrypted)
    return JSON.parse(decrypted)
  } catch {
    return null
  }
}

export function getCredentialsStatus() {
  const creds = load()
  return { hasCredentials: !!creds, id: creds?.id ?? null }
}

// 평문 비밀번호가 담긴 자격증명. scraper 자식 프로세스로 넘길 때만 사용하고
// 렌더러로는 절대 전달하지 않음 (courses.js에서만 호출)
export function getDecryptedCredentials() {
  return load()
}

export function saveCredentials({ id, password }) {
  if (!id || !password) {
    throw new Error('아이디와 비밀번호를 모두 입력해주세요')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('이 기기에서는 안전한 저장소(키체인)를 사용할 수 없습니다')
  }

  const encrypted = safeStorage.encryptString(JSON.stringify({ id, password }))
  fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true })
  fs.writeFileSync(CREDENTIALS_PATH, encrypted)

  return getCredentialsStatus()
}

export function clearCredentials() {
  if (fs.existsSync(CREDENTIALS_PATH)) fs.unlinkSync(CREDENTIALS_PATH)
  return getCredentialsStatus()
}
