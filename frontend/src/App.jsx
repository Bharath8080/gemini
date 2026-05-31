import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, Copy, Check, Search } from 'lucide-react';
import './App.css';

// Simple and robust parser to format Gemini responses (markdown bold and code blocks) inline
const FormattedContent = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!content) return null;

  // Split by code blocks ```
  const parts = content.split(/(```[\s\S]*?```)/g);

  const handleCopy = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Extract language and code text
          const lines = part.slice(3, -3).split('\n');
          const firstLine = lines[0].trim();
          const language = /^[a-zA-Z0-9#+-]+$/.test(firstLine) ? firstLine : '';
          const codeText = language ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={index} style={{ margin: '1rem 0' }}>
              <div className="code-header">
                <span>{language || 'code'}</span>
                <button
                  className="btn-copy"
                  onClick={() => handleCopy(codeText.trim(), index)}
                >
                  {copiedIndex === index ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre>
                <code>{codeText.trim()}</code>
              </pre>
            </div>
          );
        } else {
          // Standard text. Handle bolding (**text**) and split by newlines for paragraphs
          const paragraphs = part.split('\n');
          return paragraphs.map((para, paraIndex) => {
            if (!para.trim() && paraIndex > 0) return <br key={paraIndex} />;

            const boldParts = para.split(/(\*\*.*?\*\*)/g);
            return (
              <p key={`${index}-${paraIndex}`} style={{ margin: '0.4rem 0' }}>
                {boldParts.map((subpart, subindex) => {
                  if (subpart.startsWith('**') && subpart.endsWith('**')) {
                    return <strong key={subindex}>{subpart.slice(2, -2)}</strong>;
                  }
                  return subpart;
                })}
              </p>
            );
          });
        }
      })}
    </>
  );
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const chatAreaRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom of chat area whenever messages update
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle auto-growing textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isGenerating) return;

    setInput('');
    setError(null);
    setIsGenerating(true);

    const userMessage = { role: 'user', content: trimmedInput };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Append a placeholder message for the model
    const placeholderMessage = { role: 'model', content: '' };
    setMessages([...updatedMessages, placeholderMessage]);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch streaming response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Progressively update the last placeholder message in the state
        setMessages((prevMessages) => {
          const next = [...prevMessages];
          if (next.length > 0) {
            next[next.length - 1] = { role: 'model', content: fullContent };
          }
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      // Remove placeholder message on failure so we don't keep empty bubbles
      setMessages((prevMessages) => prevMessages.slice(0, -1));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <div className="header-title-group">
          <div className={`status-dot ${isGenerating ? 'searching' : error ? 'error' : ''}`} />
          <h1>Gemini Search Console</h1>
        </div>
      </header>

      <div className="chat-area" ref={chatAreaRef}>
        {messages.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-icon">
              <Sparkles size={48} style={{ color: '#a855f7' }} />
            </div>
            <h2 class="welcome-title">Vite React Gemini client</h2>
            <p>
              A high-fidelity streaming interface powered by <strong>FastAPI</strong> and <strong>Gemini 2.5 Flash</strong>. 
              Search is automatically enabled, giving the assistant access to real-time search capabilities.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLast = idx === messages.length - 1;
            const isEmptyModel = !isUser && !msg.content;

            return (
              <div key={idx} className={`message ${isUser ? 'user' : 'model'}`}>
                <span className="message-label">
                  {isUser ? 'You' : 'Gemini'}
                </span>
                <div className="message-content">
                  {isEmptyModel ? (
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    <FormattedContent content={msg.content} />
                  )}
                  
                  {/* Pulse visual indicator when using search capability */}
                  {!isUser && isLast && isGenerating && msg.content && (
                    <div className="search-banner">
                      <Search size={14} className="status-dot searching" />
                      <span>Synthesizing live web search results...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {error && (
          <div className="message model" style={{ alignSelf: 'center' }}>
            <div className="message-content" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>Error: {error}</span>
            </div>
          </div>
        )}
      </div>

      <div className="input-bar">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? "Gemini is searching and generating..." : "Ask anything (search enabled)..."}
            rows={1}
            disabled={isGenerating}
          />
        </div>
        <button
          className="btn-send"
          onClick={sendMessage}
          disabled={!input.trim() || isGenerating}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

export default App;
