'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const canSend = value.trim() && !disabled;

  return (
    <div
      className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${canSend ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: canSend ? '0 0 20px rgba(109,40,217,0.12)' : 'none',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Message Lumi…"
        className="flex-1 bg-transparent text-sm resize-none focus:outline-none disabled:opacity-40 leading-relaxed"
        style={{ color: '#e2e8f0', caretColor: '#8b5cf6', minHeight: '24px' }}
        rows={1}
      />
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-dim)' }}>
          ↵ send
        </span>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
          style={
            canSend
              ? { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 14px rgba(109,40,217,0.45)' }
              : { background: 'rgba(255,255,255,0.06)' }
          }
        >
          {disabled ? (
            <svg className="w-4 h-4 animate-spin" style={{ color: '#8b5cf6' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" style={{ color: canSend ? '#f1f5f9' : '#475569' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
