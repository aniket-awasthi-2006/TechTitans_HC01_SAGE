'use client';

import { useMemo, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';

type UserRole = 'doctor' | 'patient' | 'reception';
type Stage = 'role' | 'problem' | 'name' | 'phone' | 'email' | 'done';

type Message = {
  sender: 'bot' | 'user';
  text: string;
};

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'patient', label: 'Patient' },
  { value: 'reception', label: 'Receptionist' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getInitialMessages(): Message[] {
  return [
    {
      sender: 'bot',
      text: 'Hi! I am MediQueue Help Support. I can register your complaint and our team will contact you shortly.',
    },
    {
      sender: 'bot',
      text: 'Please choose who you are: Doctor, Patient, or Receptionist.',
    },
  ];
}

export default function SupportChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('role');
  const [messages, setMessages] = useState<Message[]>(() => getInitialMessages());
  const [input, setInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [problem, setProblem] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const placeholder = useMemo(() => {
    if (stage === 'problem') return 'Describe the issue in detail...';
    if (stage === 'name') return 'Your full name';
    if (stage === 'phone') return 'Phone number';
    if (stage === 'email') return 'Email (or type "skip")';
    return '';
  }, [stage]);

  const pushMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const resetConversation = () => {
    setStage('role');
    setMessages(getInitialMessages());
    setInput('');
    setSelectedRole(null);
    setProblem('');
    setContactName('');
    setContactPhone('');
    setIsSubmitting(false);
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    pushMessage({ sender: 'user', text: ROLE_OPTIONS.find(r => r.value === role)?.label || role });
    pushMessage({
      sender: 'bot',
      text: 'Thanks. Please explain your complaint/query so we can help you quickly.',
    });
    setStage('problem');
  };

  const submitComplaint = async (emailValue: string) => {
    if (!selectedRole) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRole: selectedRole,
          complaint: problem,
          contactName,
          contactPhone,
          contactEmail: emailValue || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const ticketSuffix = String(data.ticketId || '').slice(-6).toUpperCase();
        pushMessage({
          sender: 'bot',
          text: `Your complaint is registered successfully. Reference: ${ticketSuffix || 'TICKET'}. Our support team will contact you shortly.`,
        });
        setStage('done');
      } else {
        pushMessage({
          sender: 'bot',
          text: data.error || 'Unable to submit right now. Please try again.',
        });
      }
    } catch {
      pushMessage({
        sender: 'bot',
        text: 'Network issue while submitting your complaint. Please try again in a moment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSubmitting) return;
    const value = input.trim();

    if (stage === 'problem') {
      if (value.length < 10) {
        pushMessage({ sender: 'bot', text: 'Please share a bit more detail so we can understand the issue better.' });
        return;
      }
      pushMessage({ sender: 'user', text: value });
      setProblem(value);
      setInput('');
      pushMessage({ sender: 'bot', text: 'Please share your full name.' });
      setStage('name');
      return;
    }

    if (stage === 'name') {
      pushMessage({ sender: 'user', text: value });
      setContactName(value);
      setInput('');
      pushMessage({ sender: 'bot', text: 'Please share your contact phone number.' });
      setStage('phone');
      return;
    }

    if (stage === 'phone') {
      if (value.length < 7) {
        pushMessage({ sender: 'bot', text: 'Please enter a valid phone number so we can contact you.' });
        return;
      }
      pushMessage({ sender: 'user', text: value });
      setContactPhone(value);
      setInput('');
      pushMessage({ sender: 'bot', text: 'Please share your email too, or type "skip".' });
      setStage('email');
      return;
    }

    if (stage === 'email') {
      const isSkip = value.toLowerCase() === 'skip';
      if (!isSkip && !EMAIL_REGEX.test(value)) {
        pushMessage({ sender: 'bot', text: 'Please enter a valid email or type "skip".' });
        return;
      }
      pushMessage({ sender: 'user', text: isSkip ? 'Skip email' : value });
      setInput('');
      await submitComplaint(isSkip ? '' : value);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 1200,
          width: 58,
          height: 58,
          borderRadius: '50%',
          border: '1px solid rgba(99,102,241,0.55)',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          color: '#FFFFFF',
          display: isOpen ? 'none' : 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 12px 32px rgba(99,102,241,0.45)',
        }}
        aria-label="Open support chatbot"
      >
        <MessageCircle size={24} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            width: 'min(390px, calc(100vw - 32px))',
            height: 'min(620px, calc(100vh - 40px))',
            zIndex: 1300,
            background: 'rgba(16,23,40,0.98)',
            border: '1px solid rgba(99,102,241,0.35)',
            borderRadius: 18,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 28px 70px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 14px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(99,102,241,0.18)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#A5B4FC',
                }}
              >
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB' }}>Help & Support</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Complaint Assistant</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.04)',
                color: '#9CA3AF',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close support chatbot"
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((message, index) => (
              <div
                key={`${message.sender}-${index}`}
                style={{
                  alignSelf: message.sender === 'bot' ? 'flex-start' : 'flex-end',
                  maxWidth: '88%',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: message.sender === 'bot' ? '#D1D5DB' : '#FFFFFF',
                  background: message.sender === 'bot' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  border: message.sender === 'bot' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(165,180,252,0.4)',
                  borderRadius: 12,
                  padding: '9px 11px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {message.text}
              </div>
            ))}
          </div>

          {stage === 'role' && (
            <div style={{ padding: '0 14px 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROLE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleRoleSelect(option.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(99,102,241,0.38)',
                    background: 'rgba(99,102,241,0.12)',
                    color: '#C4B5FD',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {stage !== 'role' && stage !== 'done' && (
            <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSend(); } }}
                placeholder={placeholder}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#F9FAFB',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => { void handleSend(); }}
                disabled={isSubmitting}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  border: '1px solid rgba(165,180,252,0.5)',
                  background: isSubmitting ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: '#FFFFFF',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          )}

          {stage === 'done' && (
            <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8 }}>
              <button
                onClick={resetConversation}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(99,102,241,0.45)',
                  background: 'rgba(99,102,241,0.14)',
                  color: '#C4B5FD',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Raise Another Complaint
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
