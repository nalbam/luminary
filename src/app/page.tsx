'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import OnboardingModal, { type OnboardingData } from '@/components/OnboardingModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const USER_ID = 'user_default';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null); // null = loading
  const [agentName, setAgentName] = useState('vibemon-agent');
  const [preferredName, setPreferredName] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Load user profile and conversation history on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${USER_ID}`).then(r => r.json()),
      fetch(`/api/conversations?userId=${USER_ID}`).then(r => r.json()),
    ])
      .then(([userData, historyData]) => {
        const user = userData.user;
        const prefs = user?.preferences ?? {};
        // Require agent name — users with onboarded:true but no agent config see onboarding again
        const isOnboarded = !!prefs.onboarded && !!prefs.agent?.name;
        const aName = prefs.agent?.name || 'vibemon-agent';
        const pName = user?.preferredName || '';

        setAgentName(aName);
        setPreferredName(pName);
        setOnboarded(isOnboarded);

        if (isOnboarded) {
          const history: Message[] = (historyData.messages ?? []).map(
            (m: { role: 'user' | 'assistant'; content: string; created_at: string }) => ({
              role: m.role,
              content: m.content,
              timestamp: m.created_at,
            })
          );

          if (history.length > 0) {
            setMessages(history);
          } else {
            setMessages([{
              role: 'assistant',
              content: `Hi${pName ? `, ${pName}` : ''}! I'm ${aName}. How can I help you today?`,
              timestamp: new Date().toISOString(),
            }]);
          }
        }
      })
      .catch(() => {
        // On error, treat as new user and show onboarding
        setOnboarded(false);
      });
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    if (isInitialLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      isInitialLoad.current = false;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleOnboardingComplete = async (data: OnboardingData) => {
    await fetch(`/api/users/${USER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: data.displayName,
        preferredName: data.preferredName,
        timezone: data.timezone,
        interests: data.interests,
        agent: data.agent,
        onboarded: true,
      }),
    });

    const aName = data.agent.name;
    const pName = data.preferredName;
    setAgentName(aName);
    setPreferredName(pName);
    setOnboarded(true);
    setMessages([{
      role: 'assistant',
      content: `Hi${pName ? `, ${pName}` : ''}! I'm ${aName} — your AI agent. I think, remember, and execute. What can I help you with?`,
      timestamp: new Date().toISOString(),
    }]);
  };

  const handleSend = async (message: string) => {
    setMessages(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, userId: USER_ID }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || data.error || 'No response',
        timestamp: new Date().toISOString(),
      }]);
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

  // Loading state
  if (onboarded === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
          <span className="w-2 h-2 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
          <span className="w-2 h-2 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Onboarding modal */}
      {onboarded === false && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}

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
            ✨
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{agentName}</p>
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block status-pulse" />
              {preferredName ? `Hi, ${preferredName} · ` : ''}Always-on · local-first
            </p>
          </div>
          <div className="ml-auto text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
            {messages.length - 1 > 0 ? `${messages.length - 1} messages` : 'New chat'}
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
                  ✨
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
    </>
  );
}
