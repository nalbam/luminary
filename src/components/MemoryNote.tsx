interface Note {
  id: string;
  kind: string;
  content: string;
  tags: string[];
  stability: string;
  confidence: number;
  created_at?: string;
  createdAt?: string;
}

interface MemoryNoteProps {
  note: Note;
}

const kindColors: Record<string, string> = {
  log: 'bg-blue-900 text-blue-200',
  summary: 'bg-purple-900 text-purple-200',
  rule: 'bg-amber-900 text-amber-200',
};

export default function MemoryNote({ note }: MemoryNoteProps) {
  const createdAt = note.created_at || note.createdAt;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kindColors[note.kind] || 'bg-gray-700 text-gray-300'}`}>
          {note.kind}
        </span>
        <span className="text-xs text-gray-500">{note.confidence ? `${Math.round(note.confidence * 100)}%` : ''}</span>
      </div>
      <p className="text-gray-200 text-sm mt-2 whitespace-pre-wrap">{note.content}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {(note.tags || []).map((tag: string) => (
          <span key={tag} className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
            #{tag}
          </span>
        ))}
        <span className="text-xs text-gray-600 ml-auto">{note.stability}</span>
      </div>
      {createdAt && (
        <p className="text-gray-600 text-xs mt-1">{new Date(createdAt).toLocaleString()}</p>
      )}
    </div>
  );
}
