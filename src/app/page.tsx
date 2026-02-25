'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm vibemon-agent, your proactive AI assistant. I can help you run tasks, manage skills, and remember important information. How can I help you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (message: string) => {
    const userMsg: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, userId: 'user_default' }),
      });

      const data = await response.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.response || data.error || 'No response',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${String(e)}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Chat header */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)', background: 'rgba(7,7,15,0.6)' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
          style={{ background: 'linear-gradient(135deg, #7c3aed22, #2563eb22)', border: '1px solid rgba(139,92,246,0.25)' }}
        >
          ⚡
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>vibemon-agent</p>
          <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block status-pulse" />
            Always-on · local-first
          </p>
        </div>
        <div className="ml-auto text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
          {messages.length - 1} messages
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
              >
                ⚡
              </div>
              <div
                className="px-4 py-3 rounded-2xl rounded-bl-md"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex gap-1.5 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
                  <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
                  <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div
        className="border-t px-4 py-4"
        style={{ borderColor: 'var(--border-subtle)', background: 'rgba(7,7,15,0.8)' }}
      >
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} disabled={loading} />
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
            Shift+Enter for new line · memories are stored locally
          </p>
        </div>
      </div>
    </div>
  );
}
