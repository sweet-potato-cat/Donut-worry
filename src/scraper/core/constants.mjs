import path from 'node:path'

export const outputRoot = path.resolve('scraper-output')
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
