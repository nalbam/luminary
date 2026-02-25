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

export default function SkillCard({ skill, onEdit, onDelete, onRun }: SkillCardProps) {
  const tools = (() => {
    try { return JSON.parse(skill.tools || '[]'); } catch { return []; }
  })();

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium">{skill.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${skill.enabled ? 'bg-green-800 text-green-200' : 'bg-gray-700 text-gray-400'}`}>
              {skill.enabled ? 'enabled' : 'disabled'}
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">{skill.goal}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded-full">
              {skill.trigger_type}
            </span>
            {tools.length > 0 && tools.map((t: string) => (
              <span key={t} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {onRun && (
          <button
            onClick={onRun}
            className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Run
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
