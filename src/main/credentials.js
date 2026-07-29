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
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('[credentials] safeStorage.isEncryptionAvailable() is false')
    return null
  }

  try {
    const encrypted = fs.readFileSync(CREDENTIALS_PATH)
    const decrypted = safeStorage.decryptString(encrypted)
    return JSON.parse(decrypted)
  } catch (err) {
    // safeStorage는 macOS 키체인에 앱 서명 기준으로 키를 묶어두므로, 서명이
    // 다른 빌드(예: 언사인드 개발 빌드 ↔ 패키징된 빌드)로 갈아타면 이전에 저장한
    // credentials.enc를 더 이상 복호화하지 못한다. 이 경우 파일은 있지만 내용을
    // 못 읽는 것이므로 "저장 안 함"과 구분해 사용자가 다시 저장하도록 안내한다
    console.error(`[credentials] failed to decrypt credentials.enc: ${err.message}`)
    return null
  }
}

export function getCredentialsStatus() {
  const creds = load()
  return {
    hasCredentials: !!creds,
    id: creds?.id ?? null,
    corrupted: !creds && fs.existsSync(CREDENTIALS_PATH)
  }
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
