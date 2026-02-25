interface Skill {
  id: string;
  name: string;
  goal: string;
  trigger_type: string;
  tools?: string;
  enabled: number;
  created_at: string;
}

interface SkillCardProps {
  skill: Skill;
  onEdit?: () => void;
  onDelete?: () => void;
  onRun?: () => void;
}

const triggerColors: Record<string, { bg: string; text: string; dot: string }> = {
  manual:   { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa', dot: '#8b5cf6' },
  schedule: { bg: 'rgba(34,211,238,0.1)',   text: '#67e8f9', dot: '#22d3ee' },
  event:    { bg: 'rgba(251,191,36,0.1)',   text: '#fcd34d', dot: '#f59e0b' },
};

export default function SkillCard({ skill, onEdit, onDelete, onRun }: SkillCardProps) {
  const tools: string[] = (() => {
    try { return JSON.parse(skill.tools || '[]'); } catch { return []; }
  })();
  const tc = triggerColors[skill.trigger_type] || triggerColors.manual;

  return (
    <div
      className="group relative rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${tc.dot}`,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.055)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>{skill.name}</h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: tc.bg, color: tc.text }}
            >
              {skill.trigger_type}
            </span>
            {!skill.enabled && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(100,116,139,0.15)', color: '#64748b' }}>
                disabled
              </span>
            )}
          </div>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#64748b' }}>{skill.goal}</p>
        </div>
      </div>

      {/* Tools */}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t: string) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-lg font-mono"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {onRun && (
          <button
            onClick={onRun}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150"
            style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.2)'; }}
          >
            <span>▶</span> Run
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150 ml-auto"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
