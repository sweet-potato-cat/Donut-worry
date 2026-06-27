import SubDonut from './SubDonut'

const DEFAULT_SUBJECTS = ['a', 'b', 'c', 'd', 'e', 'f']
const COLOR = '#fea443'

export default function AssignmentSubDonut({ subjects = DEFAULT_SUBJECTS, onSelect }) {
  return <SubDonut subjects={subjects} color={COLOR} onSelect={onSelect} />
}
