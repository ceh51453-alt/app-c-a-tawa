import React, { useState, useRef, useEffect } from 'react';
import { CardProject, OpenAISettings, ChatMessage, EJSBuilderAction } from '../types';
import { ejsBuilderChat } from '../services/openai';
import { CodeTextarea } from './ui/CodeTextarea';
import { Button } from './ui/Button';
import { 
  Send, Bot, User, Loader2, Sparkles, RefreshCw, 
  HelpCircle, Check, Info, Code, FileCode, AlertTriangle,
  MessageSquare, MessageSquareOff
} from 'lucide-react';

export function validateEjsCode(code: string): string[] {
  const warnings: string[] = [];
  if (!code) return warnings;

  // 1. Unmatched EJS tags (<% vs %>)
  const openCount = (code.match(/<%/g) || []).length;
  const closeCount = (code.match(/%>/g) || []).length;
  if (openCount !== closeCount) {
    warnings.push(`Chênh lệch thẻ EJS: có ${openCount} thẻ mở '<%' nhưng chỉ có ${closeCount} thẻ đóng '%>'. Hãy kiểm tra các thẻ EJS.`);
  }

  // 2. Unclosed HTML scripts (<script vs </script>)
  const openScripts = (code.match(/<script\b/gi) || []).length;
  const closeScripts = (code.match(/<\/script>/gi) || []).length;
  if (openScripts !== closeScripts) {
    warnings.push(`Chênh lệch thẻ HTML <script>: phát hiện ${openScripts} thẻ mở '<script>' và ${closeScripts} thẻ đóng '</script>'.`);
  }

  // 3. Unclosed braces/parentheses inside EJS blocks
  const ejsRegex = /<%(?:_|=|-)?([\s\S]*?)(?:_)?%>/g;
  let match;
  let blockIndex = 1;
  while ((match = ejsRegex.exec(code)) !== null) {
    const blockContent = match[1];
    
    // Check balanced braces {}
    const openBraces = (blockContent.match(/\{/g) || []).length;
    const closeBraces = (blockContent.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      warnings.push(`Khối EJS số ${blockIndex} có dấu ngoặc nhọn '{' (${openBraces}) và '}' (${closeBraces}) không khớp.`);
    }

    // Check balanced parentheses ()
    const openParens = (blockContent.match(/\(/g) || []).length;
    const closeParens = (blockContent.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      warnings.push(`Khối EJS số ${blockIndex} có dấu ngoặc đơn '(' (${openParens}) và ')' (${closeParens}) không khớp.`);
    }

    // Check missing await for async calls: getwi, executeSlashCommands, sendMessage
    const asyncRegex = /\b(getwi|executeSlashCommands|sendMessage)\s*\(/g;
    let asyncMatch;
    while ((asyncMatch = asyncRegex.exec(blockContent)) !== null) {
      const funcName = asyncMatch[1];
      const matchIndex = asyncMatch.index;
      const beforeFunc = blockContent.substring(0, matchIndex).trim();
      const lastWord = beforeFunc.split(/\s+/).pop();
      if (lastWord !== 'await') {
        warnings.push(`Hàm bất đồng bộ '${funcName}()' trong khối EJS số ${blockIndex} thiếu từ khóa 'await'.`);
      }
    }

    // Check missing stat_data. / variables. prefixes in getvar/setvar/addvar
    const varApiRegex = /\b(getvar|setvar|addvar)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let varMatch;
    while ((varMatch = varApiRegex.exec(blockContent)) !== null) {
      const apiName = varMatch[1];
      const varPath = varMatch[2];
      if (!varPath.startsWith('stat_data.') && !varPath.startsWith('variables.')) {
        warnings.push(`Hàm '${apiName}' dùng biến '${varPath}' thiếu tiền tố 'stat_data.' hoặc 'variables.'`);
      }
    }

    // Check global scope conflicts (var x = without typeof)
    if (/\bvar\s+\w+\s*=/.test(blockContent)) {
      warnings.push(`Khai báo biến bằng 'var' trong khối EJS số ${blockIndex} dễ gây xung đột phạm vi toàn cục. Hãy dùng 'let' hoặc 'const'.`);
    }

    blockIndex++;
  }

  // 4. Misplaced decorators (starting with @@ not on line 1)
  const lines = code.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('@@')) {
      warnings.push(`Decorator '${lines[i].trim()}' tại dòng ${i + 1} phải đặt ở dòng đầu tiên của template.`);
    }
  }

  return warnings;
}

interface EJSEditorProps {
  project: CardProject;
  onChange: (updatedProject: CardProject) => void;
  settings: OpenAISettings;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const EJSEditor: React.FC<EJSEditorProps> = ({
  project,
  onChange,
  settings,
  chatMessages,
  setChatMessages,
}) => {
  // Chat state
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [showChat, setShowChat] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamBuffer]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...project,
      charData: {
        ...project.charData,
        ejs_template: e.target.value
      },
      updatedAt: Date.now()
    });
  };

  const applyAIAction = (action: EJSBuilderAction) => {
    if (action.type === 'update_ejs') {
      onChange({
        ...project,
        charData: {
          ...project.charData,
          ejs_template: action.code
        },
        updatedAt: Date.now()
      });
    }
  };

  const getTypeThemeColor = () => {
    switch (project.type) {
      case 'normal': return 'blue';
      case 'mvu': return 'pink';
      case 'mvu_zod': return 'indigo';
      case 'era': return 'emerald';
      default: return 'indigo';
    }
  };

  const themeColor = getTypeThemeColor();

  const handleSendChat = async () => {
    if (!input.trim() || loading) return;
    
    if (!settings.apiKey) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Vui lòng nhập API Key trong phần Cài đặt trước khi trò chuyện.',
        timestamp: Date.now(),
        isError: true
      }]);
      return;
    }

    const userMsgText = input;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMsgText,
      timestamp: Date.now()
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setLoading(true);
    setStreamBuffer('');

    try {
      const response = await ejsBuilderChat(
        userMsgText,
        project,
        settings,
        chatMessages,
        (partial) => setStreamBuffer(partial)
      );

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
        ejsActions: response.actions
      };

      setChatMessages(prev => [...prev, assistantMsg]);
      
      // Auto-apply AI actions
      if (response.actions && response.actions.length > 0) {
        response.actions.forEach(action => {
          applyAIAction(action);
        });
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Lỗi khi gọi Tawa: ${error.message}`,
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setLoading(false);
      setStreamBuffer('');
    }
  };

  const warnings = validateEjsCode(project.charData.ejs_template || '');

  return (
    <div className="flex h-full min-h-0 bg-[#04060f] overflow-hidden">
      {/* Left side: EJS Code Editor + Chat Toggle */}
      <div className="flex-1 flex flex-col h-full border-r border-white/[0.04] p-5 space-y-4 overflow-y-auto custom-scrollbar bg-[#04060f]/20">
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <FileCode className={`w-5 h-5 text-${themeColor}-400`} />
            <h3 className="font-bold text-slate-200 text-xs tracking-wider uppercase">Trình Soạn Thảo EJS Template</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-lg bg-${themeColor}-500/10 border border-${themeColor}-500/20 text-${themeColor}-400 text-[10px] font-mono font-medium`}>
              ST-Prompt-Template
            </span>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-1.5 rounded-lg border transition-all click-bounce ${
                showChat
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                  : 'bg-slate-800/40 border-white/[0.05] text-slate-500 hover:text-slate-300'
              }`}
              title={showChat ? 'Ẩn Tawa AI Chat' : 'Hiện Tawa AI Chat'}
            >
              {showChat ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <CodeTextarea
            value={project.charData.ejs_template || ''}
            onChange={handleTemplateChange}
            className="flex-grow h-full min-h-[300px]"
            placeholder="<%_ /* Viết code EJS ở đây */ _%>\n\nXin chào, tên tôi là <%= name %>..."
          />
        </div>

        {/* EJS Static Code Validator Warnings */}
        {warnings.length > 0 && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-red-400">
              <AlertTriangle size={14} /> Cảnh báo cú pháp EJS:
            </h4>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warn, idx) => (
                <li key={idx} className="leading-relaxed">{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* EJS reference helper cheatsheet */}
        <div className="p-4.5 rounded-2xl glass-panel border-white/[0.04] space-y-2.5">
          <h4 className={`text-xs font-bold text-${themeColor}-400 flex items-center gap-1.5`}>
            <Info size={14} /> Tra cứu nhanh API EJS SillyTavern
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-400 leading-relaxed">
            <div className="space-y-1.5">
              <p className="font-medium text-slate-300">Cơ bản:</p>
              <p><code className="text-slate-300 font-mono bg-black/40 border border-white/[0.04] px-1.5 py-0.5 rounded-md">&lt;%_ code _%&gt;</code>: Chạy logic không in ra.</p>
              <p><code className="text-slate-300 font-mono bg-black/40 border border-white/[0.04] px-1.5 py-0.5 rounded-md">&lt;%= biến %&gt;</code>: In ra giá trị biến (escape HTML).</p>
              <p><code className="text-slate-300 font-mono bg-black/40 border border-white/[0.04] px-1.5 py-0.5 rounded-md">&lt;%- biến %&gt;</code>: In ra giá trị raw không escape.</p>
            </div>
            
            <div className="space-y-1.5">
              <p className="font-medium text-slate-300">Hàm SillyTavern (TavernHelper):</p>
              <p><code className="text-slate-300 font-mono bg-black/40 border border-white/[0.04] px-1.5 py-0.5 rounded-md">getvar('stat_data.A')</code>: Lấy biến số MVU.</p>
              <p><code className="text-slate-300 font-mono bg-black/40 border border-white/[0.04] px-1.5 py-0.5 rounded-md">setvar('stat_data.A', 5)</code>: Gán biến số MVU.</p>
              {project.type === 'era' && (
                <>
                  <p><code className="text-emerald-400 font-mono bg-black/40 border border-emerald-500/10 px-1.5 py-0.5 rounded-md">await getwi('Mục_A')</code>: Đọc nội dung Lorebook ERA.</p>
                  <p><code className="text-emerald-400 font-mono bg-black/40 border border-emerald-500/10 px-1.5 py-0.5 rounded-md">await setwi('Mục_A', 'Trị')</code>: Ghi đè Lorebook ERA.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side: AI EJS Chat Assistant (Toggleable) */}
      {showChat && (
      <div className="w-[450px] flex flex-col h-full bg-[#04060f]/40 border-l border-white/[0.04] shrink-0">
        <div className="p-4 border-b border-white/[0.04] flex justify-between items-center shrink-0 bg-slate-950/20">
          <div className="flex items-center gap-3">
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
              <h3 className="font-bold text-slate-200 text-xs tracking-wide uppercase">Tawa EJS Assistant</h3>
              <p className="text-[10px] text-slate-500">Thiết kế Prompt Động</p>
            </div>
          </div>
        </div>

        {/* Messages viewport */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-[#04060f]/10">
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 max-w-sm mx-auto space-y-4">
              <h4 className="font-bold text-slate-300 text-sm">Tạo Prompt Động Với EJS</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ta có thể tự động sinh các đoạn code điều kiện logic EJS phức tạp để ẩn hiện prompt theo chỉ số (Độ hảo cảm, level),
                hoặc cấu trúc prompt động cho mô hình ERA Card.
              </p>
              <div className="glass-panel border-white/[0.04] bg-white/[0.01] p-4 rounded-2xl w-full text-[10px] text-left text-indigo-300 space-y-1.5">
                <p className="font-semibold mb-1 text-slate-300">Gợi ý yêu cầu:</p>
                <p>• "Tạo EJS hiển thị chỉ số sức mạnh của nhân vật"</p>
                {project.type === 'era' && (
                  <p>• "Viết EJS đọc nội dung entry 'Ngoại_Hình_ERA' bằng getwi"</p>
                )}
                <p>• "Tạo prompt thay đổi thái độ dựa trên độ hảo cảm từ getvar"</p>
              </div>
            </div>
          )}

          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden border ${
                msg.role === 'system' ? 'bg-red-950/40 border-red-500/20' : 'bg-slate-900 border-white/[0.05]'
              }`}>
                {msg.role === 'user' ? (
                  <img src="https://files.catbox.moe/6uqe51.jpg" alt="User" className="w-full h-full object-cover" />
                ) : msg.role === 'assistant' ? (
                  <img src="https://files.catbox.moe/xa7h6o.jpg" alt="Tawa" className="w-full h-full object-cover animate-pulse" />
                ) : (
                  <span className="text-[9px] font-bold text-red-400">SYS</span>
                )}
              </div>

              <div className="max-w-[80%] space-y-2">
                <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed border ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : msg.role === 'system'
                      ? 'bg-red-950/20 border-red-900/30 text-red-200'
                      : 'glass-panel border-white/[0.05] bg-white/[0.015] text-slate-200'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.ejsActions && msg.ejsActions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">EJS Template đã cập nhật:</span>
                      {msg.ejsActions.map((act, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 p-2 rounded-xl bg-black/40 border border-white/[0.03] text-[10px] text-green-400">
                          <Check size={12} />
                          <span>Mã nguồn EJS đã được chèn vào trình soạn thảo.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Streaming/Loading Indicator */}
          {loading && (
            <div className="flex gap-3.5">
              <div className="w-8.5 h-8.5 rounded-full overflow-hidden shrink-0 animate-bounce">
                <img src="https://files.catbox.moe/xa7h6o.jpg" alt="Tawa" className="w-full h-full object-cover" />
              </div>
              <div className="glass-panel border-white/[0.05] bg-white/[0.015] text-slate-300 rounded-2xl px-4 py-2.5 text-xs shadow-md">
                {streamBuffer ? (
                  <div className="whitespace-pre-wrap font-mono text-[10px] text-purple-200">{streamBuffer}</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-purple-400" />
                    <span>Tawa đang dệt code EJS...</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="!mt-0" />
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 border-t border-white/[0.04] bg-[#04060f]/60 shrink-0">
          <div className="flex items-end gap-2 bg-slate-900/50 border border-white/[0.05] p-2 rounded-2xl max-w-3xl mx-auto focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all">
            <textarea
              ref={textareaRef}
              placeholder="Yêu cầu Tawa viết hoặc chỉnh sửa code EJS..."
              className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-200 placeholder-slate-500 resize-none py-1.5 px-2.5 max-h-[100px] min-h-[34px] leading-relaxed outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              rows={1}
            />
            <button
              onClick={handleSendChat}
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
      )}
    </div>
  );
};
