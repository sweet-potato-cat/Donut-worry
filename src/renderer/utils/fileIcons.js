import { BiFileBlank, BiSolidFilePdf, BiSolidFileArchive } from 'react-icons/bi'

export function iconForFile(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return BiSolidFilePdf
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return BiSolidFileArchive
  return BiFileBlank
}
