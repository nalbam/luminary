'use client';

import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');

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

  return (
    <div className="flex gap-2 items-end">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
        className="flex-1 bg-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 min-h-[50px] max-h-[200px]"
        rows={1}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
      >
        {disabled ? '...' : 'Send'}
      </button>
    </div>
  );
}
