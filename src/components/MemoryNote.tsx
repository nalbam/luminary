interface Note {
  id: string;
  kind: string;
  content: string;
  tags: string[];
  stability: string;
  created_at?: string;
  createdAt?: string;
}

interface MemoryNoteProps {
  note: Note;
}

const kindConfig: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  agent:   { icon: '🤖', color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
  soul:    { icon: '✨', color: '#fb7185', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.25)' },
  user:    { icon: '👤', color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  rule:    { icon: '⚡', color: '#fcd34d', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  summary: { icon: '📝', color: '#c4b5fd', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  log:     { icon: '📋', color: '#67e8f9', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.2)' },
};

const stabilityLabel: Record<string, string> = {
  volatile:  '🔄 volatile',
  stable:    '⚓ stable',
  permanent: '🔒 permanent',
};

export default function MemoryNote({ note }: MemoryNoteProps) {
  const createdAt = note.created_at || note.createdAt;
  const cfg = kindConfig[note.kind] || kindConfig.log;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderTop: `2px solid ${cfg.border}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg font-medium"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <span>{cfg.icon}</span>
          {note.kind}
        </span>
        <span className="text-xs" style={{ color: '#475569' }}>
          {stabilityLabel[note.stability] || note.stability}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#cbd5e1' }}>
        {note.content}
      </p>

      {/* Tags */}
      {(note.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(note.tags || []).map((tag: string) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {createdAt && (
        <p className="text-xs" style={{ color: '#334155' }}>
          {new Date(createdAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
