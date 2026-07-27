import path from 'node:path'

// Electron 앱에서 자식 프로세스로 실행할 때는 process.cwd()가 프로젝트 폴더를
// 가리킨다는 보장이 없으므로, DONUT_OUTPUT_ROOT 환경변수로 절대 경로를 넘겨받는다.
// CLI로 직접 실행할 때(npm run scrape:*)는 기존처럼 현재 디렉토리 기준으로 동작
export const outputRoot = process.env.DONUT_OUTPUT_ROOT
  ? path.resolve(process.env.DONUT_OUTPUT_ROOT)
  : path.resolve('scraper-output')
export const dashboardUrl = 'https://khcanvas.khu.ac.kr/dashboard'
export const weeklyLearningToolId = '196'
export const weeklyMaterialTypes = new Set([
  'file',
  'pdf',
  'ppt',
  'pptx',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'hwp',
  'hwpx',
  'zip'
])
export const ignoredDownloadExtensions = new Set(['html', 'htm', 'php', 'aspx', 'asp', 'jsp', 'do'])
