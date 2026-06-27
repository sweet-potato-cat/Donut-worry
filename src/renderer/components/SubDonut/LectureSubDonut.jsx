import SubDonut from './SubDonut'

const DEFAULT_SUBJECTS = ['a', 'b', 'c', 'd', 'e', 'f']
const COLOR = '#f3feb1'

export default function LectureSubDonut({ subjects = DEFAULT_SUBJECTS, onSelect }) {
  return <SubDonut subjects={subjects} color={COLOR} onSelect={onSelect} />
}
