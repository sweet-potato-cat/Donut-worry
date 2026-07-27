const { execFileSync } = require('child_process')
const path = require('path')

// mac.identity: null로 electron-builder의 자체 서명은 건너뛰지만, 그 상태로 두면
// Electron 바이너리에 원래 박혀있던 ad-hoc 서명이 electron-builder가 나중에 추가한
// 리소스(app.asar, 아이콘 등)를 포함하지 못해 서명이 깨진 상태가 되고, macOS가
// 이를 "손상된 앱"으로 오인해 실행을 거부한다. 최종 번들 전체를 다시 ad-hoc
// 서명해 리소스까지 포함한 유효한 서명으로 갱신한다
exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath])
}
