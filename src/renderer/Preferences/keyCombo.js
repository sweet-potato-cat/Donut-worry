/**
 * keyCombo.js — DOM KeyboardEvent.code ↔ uiohook-napi 키 이름 변환
 * 단축키 레코더(ShortcutsTab)에서만 사용. main 프로세스는 이미 변환된
 * uiohook 키 이름 배열만 전달받으므로 이 매핑을 알 필요가 없다.
 */

const STATIC_CODE_MAP = {
  ControlLeft: 'Ctrl',
  ControlRight: 'CtrlRight',
  AltLeft: 'Alt',
  AltRight: 'AltRight',
  ShiftLeft: 'Shift',
  ShiftRight: 'ShiftRight',
  MetaLeft: 'Meta',
  MetaRight: 'MetaRight',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  CapsLock: 'CapsLock',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Comma: 'Comma',
  Period: 'Period',
  Semicolon: 'Semicolon',
  Equal: 'Equal',
  Minus: 'Minus',
  Slash: 'Slash',
  Backquote: 'Backquote',
  BracketLeft: 'BracketLeft',
  BracketRight: 'BracketRight',
  Backslash: 'Backslash',
  Quote: 'Quote'
}

for (let i = 0; i <= 9; i++) {
  STATIC_CODE_MAP[`Digit${i}`] = String(i)
}
for (let c = 65; c <= 90; c++) {
  const letter = String.fromCharCode(c)
  STATIC_CODE_MAP[`Key${letter}`] = letter
}
for (let i = 1; i <= 24; i++) {
  STATIC_CODE_MAP[`F${i}`] = `F${i}`
}

const MODIFIER_NAMES = new Set([
  'Ctrl',
  'CtrlRight',
  'Alt',
  'AltRight',
  'Shift',
  'ShiftRight',
  'Meta',
  'MetaRight'
])

const LABELS = {
  Ctrl: 'Ctrl',
  CtrlRight: 'Ctrl',
  Alt: 'Alt',
  AltRight: 'Alt',
  Shift: 'Shift',
  ShiftRight: 'Shift',
  Meta: 'Meta',
  MetaRight: 'Meta',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  CapsLock: 'Caps',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Equal: '=',
  Minus: '-',
  Slash: '/',
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Quote: "'"
}

// 항상 같은 순서로 표시(수식키 먼저 → 일반 키), 조합 저장 순서와 무관하게 안정적으로 보이도록
const MODIFIER_ORDER = [
  'Ctrl',
  'CtrlRight',
  'Alt',
  'AltRight',
  'Shift',
  'ShiftRight',
  'Meta',
  'MetaRight'
]

export function codeToUiohookKey(code) {
  return STATIC_CODE_MAP[code]
}

export function isModifierKey(name) {
  return MODIFIER_NAMES.has(name)
}

function keyLabel(name) {
  return LABELS[name] ?? name
}

export function comboToLabel(keys) {
  if (!keys || keys.length === 0) return '설정 안 됨'
  const modifiers = MODIFIER_ORDER.filter((name) => keys.includes(name))
  const rest = keys.filter((name) => !isModifierKey(name))
  return [...modifiers, ...rest].map(keyLabel).join(' + ')
}
