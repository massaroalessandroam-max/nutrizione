import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Message } from '../../types';

export function MessaggiView() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    api.getMessages().then(setMessages).catch(() => setMessages([]));
  }, []);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    setMessages(await api.sendMessage(value));
  };

  return (
    <div className="nm-section">
      <div className="nm-page-title">Messaggi</div>
      <div className="nm-page-sub">Scrivi al tuo nutrizionista, ti risponderà da qui.</div>

      <div className="nm-logged-foods" style={{ marginTop: 16 }}>
        {messages === null && <div className="nm-empty-state">Caricamento…</div>}
        {messages?.length === 0 && <div className="nm-empty-state">Nessun messaggio ancora — scrivi il primo.</div>}
        {messages?.map((m) => (
          <div
            key={m.id}
            className="nm-plan-item-card"
            style={{
              marginLeft: m.sender === 'paziente' ? '20%' : 0,
              marginRight: m.sender === 'paziente' ? 0 : '20%',
              background: m.sender === 'paziente' ? 'var(--good-bg)' : 'var(--card)',
            }}
          >
            <div>{m.text}</div>
            <div className="nm-page-sub" style={{ marginTop: 4 }}>{new Date(m.createdAt).toLocaleString('it-IT')}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          className="nm-text-input"
          placeholder="Scrivi un messaggio…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="nm-modal-btn nm-modal-btn-primary" style={{ flex: 'none', padding: '0 16px' }} onClick={send}>Invia</button>
      </div>
    </div>
  );
}
