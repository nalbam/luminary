interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export default function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1"
        style={
          isUser
            ? { background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }
            : { background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }
        }
      >
        {isUser ? 'U' : '⚡'}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[75%] rounded-2xl px-4 py-3 text-sm"
        style={
          isUser
            ? {
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#f1f5f9',
                borderBottomRightRadius: '6px',
                boxShadow: '0 4px 20px rgba(109,40,217,0.3)',
              }
            : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#e2e8f0',
                borderBottomLeftRadius: '6px',
              }
        }
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        {timestamp && (
          <p
            className="text-xs mt-1.5"
            style={{ color: isUser ? 'rgba(196,181,253,0.7)' : 'var(--text-muted)' }}
          >
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
