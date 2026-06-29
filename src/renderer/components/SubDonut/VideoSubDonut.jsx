import SubDonut from './SubDonut'

const DEFAULT_SUBJECTS = ['a', 'b', 'c', 'd', 'e', 'f']
const COLOR = '#90ccfb'

export default function VideoSubDonut({ subjects = DEFAULT_SUBJECTS, onSelect }) {
  return <SubDonut subjects={subjects} color={COLOR} onSelect={onSelect} />
}
