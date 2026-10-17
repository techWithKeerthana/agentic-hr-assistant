export default function FollowUpChips({ questions, onSend }) {
  if (!questions?.length) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-11">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSend(q)}
          className="px-3 py-1.5 rounded-full text-xs transition-colors border"
          style={{
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          {q}
        </button>
      ))}
    </div>
  )
}
