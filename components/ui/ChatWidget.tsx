'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

const quickReplies = [
  'Check my wait time',
  'How does this system work?',
  'What is my token status?',
  'Where should I go next?',
];

const cannedResponses = {
  waitTime: 'Your estimated wait time is 15 minutes. Please stay nearby and keep your phone ready.',
  tokenStatus: 'Currently serving token A102. Your token will be called shortly.',
  systemHelp:
    'MediQueue manages OPD flow by tracking token numbers, displaying current status, and showing wait time estimates. Stay near the display until your number is shown.',
  nextSteps: 'Please wait until your token appears on the screen, then proceed to the indicated counter. The staff will guide you from there.',
  fallback:
    'I can help with wait time, token status, or how the system works. Try a quick reply or ask a simple question like “How does this work?”.',
};

function getBotResponse(message: string) {
  const normalized = message.trim().toLowerCase();

  if (/wait|waiting|minutes|time/.test(normalized)) {
    return cannedResponses.waitTime;
  }

  if (/token|status|serving|number/.test(normalized)) {
    return cannedResponses.tokenStatus;
  }

  if (/how|work|system|help/.test(normalized)) {
    return cannedResponses.systemHelp;
  }

  if (/where|next|go|proceed|counter/.test(normalized)) {
    return cannedResponses.nextSteps;
  }

  return cannedResponses.fallback;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'bot-welcome',
      role: 'bot',
      text: 'Hello! I am MediQueue Assistant. I can help with wait time, token status, and system guidance.',
    },
  ]);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const canSend = inputValue.trim().length > 0;

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const botMessage: ChatMessage = {
      id: `bot-${Date.now() + 1}`,
      role: 'bot',
      text: getBotResponse(trimmed),
    };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInputValue('');
  };

  const handleQuickReply = (reply: string) => {
    handleSend(reply);
    setIsOpen(true);
  };

  const firstQuickReplies = useMemo(() => quickReplies.slice(0, 4), []);

  return (
    <div className="chat-widget-root">
      {!isOpen && (
        <button
          type="button"
          className="chat-toggle-button"
          onClick={() => setIsOpen(true)}
          aria-label="Open MediQueue Assistant"
        >
          <span className="chat-toggle-icon" aria-hidden="true">💬</span>
        </button>
      )}

      {isOpen && (
        <>
          <div className="chat-overlay" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="chat-panel glass-card-elevated" role="dialog" aria-modal="true" aria-label="MediQueue Assistant chat window">
            <div className="chat-header">
              <div className="chat-title-group">
                <span className="chat-title-icon" aria-hidden="true">🤖</span>
                <div>
                  <div className="chat-title">MediQueue Assistant</div>
                  <div className="chat-subtitle">Ask about wait time, token status, or next steps.</div>
                </div>
              </div>
              <button
                type="button"
                className="chat-close-button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat window"
              >
                ✕
              </button>
            </div>

          <div className="chat-messages" role="log" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.role === 'bot' ? 'chat-message-bot' : 'chat-message-user'}`}
              >
                <div className="chat-message-text">{message.text}</div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>

          <div className="chat-quick-replies">
            {firstQuickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                className="chat-quick-button"
                onClick={() => handleQuickReply(reply)}
              >
                {reply}
              </button>
            ))}
          </div>

          <form
            className="chat-input-row"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend(inputValue);
            }}
          >
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              className="chat-input"
              placeholder="Type your question..."
              aria-label="Chat input"
            />
            <button type="submit" className="chat-send-button" disabled={!canSend}>
              Send
            </button>
          </form>
        </div>
      </>
      )}
    </div>
  );
}
