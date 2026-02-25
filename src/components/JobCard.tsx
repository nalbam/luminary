interface Job {
  id: string;
  skill_id?: string;
  trigger_type: string;
  status: string;
  input?: string;
  result?: string;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface JobCardProps {
  job: Job;
  onClick?: () => void;
  selected?: boolean;
}

const statusConfig: Record<string, { dot: string; bg: string; text: string; pulse?: boolean }> = {
  queued:    { dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  text: '#fcd34d' },
  running:   { dot: '#3b82f6', bg: 'rgba(59,130,246,0.12)', text: '#93c5fd', pulse: true },
  succeeded: { dot: '#10b981', bg: 'rgba(16,185,129,0.12)', text: '#6ee7b7' },
  failed:    { dot: '#ef4444', bg: 'rgba(239,68,68,0.12)',   text: '#fca5a5' },
  canceled:  { dot: '#64748b', bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
};

export default function JobCard({ job, onClick, selected }: JobCardProps) {
  const cfg = statusConfig[job.status] || statusConfig.canceled;

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 cursor-pointer transition-all duration-200"
      style={{
        background: selected ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: selected ? '0 0 16px rgba(109,40,217,0.12)' : 'none',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Status dot */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.pulse ? 'status-pulse' : ''}`}
              style={{ background: cfg.dot }}
            />
            <span className="text-xs font-mono truncate" style={{ color: '#64748b' }}>
              {job.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: cfg.bg, color: cfg.text }}
            >
              {job.status}
            </span>
            <span className="text-xs" style={{ color: '#475569' }}>
              {job.trigger_type}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs" style={{ color: '#475569' }}>
            {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs" style={{ color: '#334155' }}>
            {new Date(job.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
      {job.error && (
        <p className="text-xs mt-2 truncate" style={{ color: '#f87171' }}>⚠ {job.error}</p>
      )}
    </div>
  );
}
