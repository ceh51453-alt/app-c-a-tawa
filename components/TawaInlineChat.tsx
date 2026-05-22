import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Send, Loader2, Check, Sparkles } from 'lucide-react';

interface TawaInlineChatProps {
  title: string;
  subtitle: string;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onSendMessage: (message: string) => Promise<void>;
  loading: boolean;
  streamBuffer: string;
  themeColor?: string;
  placeholderText?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  suggestions?: string[];
  renderActionBadge?: (msg: ChatMessage) => React.ReactNode;
}

export const TawaInlineChat: React.FC<TawaInlineChatProps> = ({
  title,
  subtitle,
  chatMessages,
  loading,
  streamBuffer,
  themeColor = 'indigo',
  placeholderText = 'Nhờ Tawa chỉnh sửa nội dung...',
  emptyStateTitle = 'Tawa sẵn sàng hỗ trợ',
  emptyStateDescription = 'Hãy mô tả những gì bạn muốn chỉnh sửa hoặc thêm mới.',
  suggestions = [],
  onSendMessage,
  renderActionBadge,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamBuffer]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSendMessage(text);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (loading) return;
    await onSendMessage(suggestion);
  };

  return (
    <div className="flex flex-col h-full bg-[#04060f]/40 border-l border-white/[0.04] shrink-0" style={{ width: '420px' }}>
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04] flex items-center gap-3 shrink-0 bg-slate-950/20">
        <div className="relative">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-indigo-500/30">
            <img 
              src="https://files.catbox.moe/xa7h6o.jpg" 
              alt="Tawa" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border border-[#04060f] animate-pulse"></div>
        </div>
        <div>
          <h3 className="font-bold text-slate-200 text-xs tracking-wide uppercase">{title}</h3>
          <p className="text-[10px] text-slate-500">{subtitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-[#04060f]/10">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 max-w-sm mx-auto space-y-4">
            <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-indigo-500/20 mb-2">
              <img src="https://files.catbox.moe/xa7h6o.jpg" alt="Tawa" className="w-full h-full object-cover" />
            </div>
            <h4 className="font-bold text-slate-300 text-sm">{emptyStateTitle}</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">{emptyStateDescription}</p>
            
            {suggestions.length > 0 && (
              <div className="glass-panel border-white/[0.04] bg-white/[0.01] p-4 rounded-2xl w-full text-[10px] text-left space-y-1.5">
                <p className="font-semibold mb-1 text-slate-300 flex items-center gap-1"><Sparkles size={10} className="text-indigo-400" /> Gợi ý:</p>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="block w-full text-left text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/5 px-2 py-1 rounded-lg transition-colors"
                  >
                    • {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden border ${
              msg.role === 'system' ? 'bg-red-950/40 border-red-500/20' : 'bg-slate-900 border-white/[0.05]'
            }`}>
              {msg.role === 'user' ? (
                <img src="https://files.catbox.moe/6uqe51.jpg" alt="User" className="w-full h-full object-cover" />
              ) : msg.role === 'assistant' ? (
                <img src="https://files.catbox.moe/xa7h6o.jpg" alt="Tawa" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] font-bold text-red-400">SYS</span>
              )}
            </div>

            <div className="max-w-[85%] space-y-2">
              <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed border ${
                msg.role === 'user'
                  ? `bg-gradient-to-r from-${themeColor}-600 to-pink-600 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.15)]`
                  : msg.role === 'system'
                    ? 'bg-red-950/20 border-red-900/30 text-red-200'
                    : 'glass-panel border-white/[0.05] bg-white/[0.015] text-slate-200'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Action badges */}
                {renderActionBadge && renderActionBadge(msg)}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 animate-bounce">
              <img src="https://files.catbox.moe/xa7h6o.jpg" alt="Tawa" className="w-full h-full object-cover" />
            </div>
            <div className="glass-panel border-white/[0.05] bg-white/[0.015] text-slate-300 rounded-2xl px-4 py-2.5 text-xs shadow-md max-w-[85%]">
              {streamBuffer ? (
                <div className="whitespace-pre-wrap font-mono text-[10px] text-purple-200">{streamBuffer}</div>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-purple-400" />
                  <span>Tawa đang suy nghĩ...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="!mt-0" />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/[0.04] bg-[#04060f]/60 shrink-0">
        <div className={`flex items-end gap-2 bg-slate-900/50 border border-white/[0.05] p-2 rounded-2xl max-w-3xl mx-auto focus-within:border-${themeColor}-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all`}>
          <textarea
            ref={textareaRef}
            placeholder={placeholderText}
            className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-200 placeholder-slate-500 resize-none py-1.5 px-2.5 max-h-[100px] min-h-[34px] leading-relaxed outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={`h-[32px] w-[32px] rounded-xl flex items-center justify-center shrink-0 transition click-bounce ${
              !input.trim() || loading
                ? 'bg-slate-800/40 text-slate-600'
                : `bg-${themeColor}-600 hover:bg-${themeColor}-500 text-white shadow-lg shadow-${themeColor}-500/10`
            }`}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
