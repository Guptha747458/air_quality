import React, { useState } from 'react';
import { Icon } from './Icon.jsx';
import { QA_QUICK_PICKS } from '../utils/translations.js';

function QuickAnswersComponent({
  onAsk,
  loading = false,
  answer = '',
  language = 'en',
  t,
}) {
  const [question, setQuestion] = useState('');

  const quickPicks = QA_QUICK_PICKS[language] || QA_QUICK_PICKS.en;

  const handleSend = (text = question) => {
    const q = (typeof text === 'string' ? text : question).trim();
    if (!q || loading) return;
    onAsk(q);
  };

  return (
    <section className="card qa-card" aria-labelledby="qa-heading">
      <div className="card-heading">
        <div className="heading-icon blue">
          <Icon name="chat" size={24} />
        </div>
        <div>
          <span>{t.qa_eyebrow}</span>
          <h2 id="qa-heading">{t.qa_title}</h2>
        </div>
      </div>

      <div className="qa-row">
        <textarea
          id="air-question"
          name="question"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t.qa_placeholder}
          aria-label="Ask a question about today's air quality"
        />
        <button
          type="button"
          className="ask-button"
          onClick={() => handleSend()}
          disabled={loading || !question.trim()}
          aria-busy={loading}
        >
          {loading ? t.asking : t.ask}
        </button>
      </div>

      {/* Deduplicated Quick Picks */}
      <div className="qa-suggestions" role="group" aria-label="Quick questions">
        {quickPicks.map((prompt) => (
          <button
            type="button"
            className="qa-pill"
            key={prompt}
            onClick={() => {
              setQuestion(prompt);
              handleSend(prompt);
            }}
          >
            💬 {prompt}
          </button>
        ))}
      </div>

      {answer && (
        <p className="answer" role="region" aria-live="polite" aria-label="Consultation Answer">
          {answer}
        </p>
      )}
    </section>
  );
}

export const QuickAnswers = React.memo(QuickAnswersComponent);
