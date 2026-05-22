import React, { useState, useEffect } from 'react';
import { CardProject, OpenAISettings, ChatMessage } from '../types';
import { CodeTextarea } from './ui/CodeTextarea';
import { Button } from './ui/Button';
import { generateMvuDictionary, dictionaryChatService } from '../services/openai';
import { 
  BookOpen, Sparkles, RefreshCw, AlertCircle, FileText, CheckCircle2,
  AlertTriangle, ArrowRight, Play, Info, Check, MessageSquare, MessageSquareOff
} from 'lucide-react';
import { TawaInlineChat } from './TawaInlineChat';

interface VariableDictionaryProps {
  project: CardProject;
  onChange: (updatedCharData: any) => void;
  settings: OpenAISettings;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

interface ExtractedVariable {
  path: string;
  type: string;
  defaultValue: string;
  description: string;
}

// Zod Schema Variable Parser
export function parseZodSchema(schemaText: string): ExtractedVariable[] {
  const vars: ExtractedVariable[] = [];
  if (!schemaText) return vars;

  const lines = schemaText.split('\n');
  const stack: string[] = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Check if we are opening a z.object
    const objectMatch = line.match(/^([\w\u00C0-\u1EF9]+|['"][\s\S]+?['"])\s*:\s*z\s*\.\s*object\s*\(\s*\{/);
    if (objectMatch) {
      const rawKey = objectMatch[1];
      const key = rawKey.replace(/['"]/g, ''); // strip quotes
      stack.push(key);
      continue;
    }
    
    // Check if we are closing a z.object
    if (line.startsWith('}') || line.startsWith('})')) {
      stack.pop();
      continue;
    }
    
    // Check for a leaf property
    const leafMatch = line.match(/^([\w\u00C0-\u1EF9]+|['"][\s\S]+?['"])\s*:\s*z\s*\.\s*(.+)$/);
    if (leafMatch) {
      const rawKey = leafMatch[1];
      const key = rawKey.replace(/['"]/g, '');
      const definition = leafMatch[2];
      
      const fullPath = [...stack, key].join('.');
      
      // Determine type
      let type = 'unknown';
      if (definition.includes('number')) {
        type = 'number';
      } else if (definition.includes('string')) {
        type = 'string';
      } else if (definition.includes('boolean')) {
        type = 'boolean';
      } else if (definition.includes('array')) {
        type = 'array';
      }
      
      // Extract default value from .prefault(...) or .default(...)
      let defaultValue = '';
      const prefaultMatch = definition.match(/\.prefault\(([^)]*)\)/);
      const defaultMatch = definition.match(/\.default\(([^)]*)\)/);
      
      if (prefaultMatch) {
        defaultValue = prefaultMatch[1].trim();
      } else if (defaultMatch) {
        defaultValue = defaultMatch[1].trim();
      }
      
      vars.push({
        path: fullPath,
        type,
        defaultValue,
        description: ''
      });
    }
  }
  
  return vars;
}

// Parse markdown list descriptions
export function parseDescriptions(dictionaryText: string): Record<string, string> {
  const descriptions: Record<string, string> = {};
  if (!dictionaryText) return descriptions;
  
  const lines = dictionaryText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Matches: "- stat_data.X: description" or "- `stat_data.X`: description" or "* stat_data.X - description"
    const match = trimmed.match(/^[-*+]\s+(?:`?)([\w\u00C0-\u1EF9.]+)(?:`?)\s*[:|-]\s*(.+)$/);
    if (match) {
      const path = match[1].trim();
      const desc = match[2].trim();
      descriptions[path] = desc;
    }
  }
  return descriptions;
}

export const VariableDictionary: React.FC<VariableDictionaryProps> = ({
  project,
  onChange,
  settings,
  chatMessages,
  setChatMessages
}) => {
  const [extractedVars, setExtractedVars] = useState<ExtractedVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStreamBuffer, setChatStreamBuffer] = useState('');
  const [streamBuffer, setStreamBuffer] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showChat, setShowChat] = useState(true);

  const dictionaryText = project.charData.mvu_dictionary || '';
  const zodSchema = project.charData.zod_schema || '';

  // Synchronize extracted variables when schema or dictionary updates
  useEffect(() => {
    const parsedVars = parseZodSchema(zodSchema);
    const descriptions = parseDescriptions(dictionaryText);
    
    const varsWithDesc = parsedVars.map(v => ({
      ...v,
      description: descriptions[v.path] || ''
    }));
    
    setExtractedVars(varsWithDesc);
  }, [zodSchema, dictionaryText]);

  const handleDictionaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...project.charData,
      mvu_dictionary: e.target.value
    });
  };

  // Sync variables list to markdown format
  const handleExtractFromSchema = () => {
    const parsedVars = parseZodSchema(zodSchema);
    if (parsedVars.length === 0) {
      alert("Không tìm thấy biến số nào trong Zod Schema hiện tại. Hãy kiểm tra lại Zod Schema.");
      return;
    }

    const descriptions = parseDescriptions(dictionaryText);
    let newDictionary = dictionaryText.trim();
    
    // Add header if dictionary is completely empty
    if (!newDictionary) {
      newDictionary = `# BỘ TỪ ĐIỂN BIẾN SỐ (GLOSSARY)\n`;
    }

    let addedCount = 0;
    parsedVars.forEach(v => {
      // If variable path is not already in the dictionary
      if (!descriptions[v.path]) {
        newDictionary += `\n- \`${v.path}\`: (Chưa có mô tả) [Kiểu: ${v.type}, Mặc định: ${v.defaultValue || 'none'}]`;
        addedCount++;
      }
    });

    if (addedCount > 0) {
      onChange({
        ...project.charData,
        mvu_dictionary: newDictionary.trim()
      });
      alert(`Đã trích xuất và bổ sung thêm ${addedCount} biến số mới vào từ điển.`);
    } else {
      alert("Tất cả biến số trong Zod Schema đã có mặt trong Từ Điển.");
    }
  };

  // Call AI to document variables
  const handleAiDocument = async () => {
    if (!settings.apiKey) {
      setErrorMsg("Vui lòng nhập API Key trong phần Cài đặt trước khi gọi Tawa.");
      return;
    }

    setLoading(true);
    setStreamBuffer('');
    setErrorMsg('');

    try {
      const generated = await generateMvuDictionary(
        zodSchema,
        dictionaryText,
        settings,
        (partial) => setStreamBuffer(partial)
      );

      onChange({
        ...project.charData,
        mvu_dictionary: generated
      });
    } catch (err: any) {
      setErrorMsg(`Lỗi khi gọi Tawa: ${err.message}`);
    } finally {
      setLoading(false);
      setStreamBuffer('');
    }
  };

  const documentedCount = extractedVars.filter(v => v.description && v.description !== '(Chưa có mô tả)').length;
  const undocumentedCount = extractedVars.length - documentedCount;
  // Chat handler for interactive dictionary editing
  const handleDictChat = async (message: string) => {
    if (!settings.apiKey) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Vui lòng nhập API Key trong phần Cài đặt.',
        timestamp: Date.now(),
        isError: true
      }]);
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    setChatStreamBuffer('');

    try {
      const response = await dictionaryChatService(
        message,
        project,
        settings,
        chatMessages,
        (partial) => setChatStreamBuffer(partial)
      );

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
        dictActions: response.actions
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      if (response.actions && response.actions.length > 0) {
        response.actions.forEach(action => {
          if (action.type === 'update_dictionary' && action.dictionary) {
            onChange({
              ...project.charData,
              mvu_dictionary: action.dictionary
            });
          }
        });
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Lỗi: ${error.message}`,
        timestamp: Date.now(),
        isError: true
      }]);
    } finally {
      setChatLoading(false);
      setChatStreamBuffer('');
    }
  };

  return (
    <div className="flex w-full h-full overflow-hidden min-h-0">
    <div className="flex flex-1 h-full min-h-0 bg-[#04060f] overflow-hidden">
      {/* Left Column: Visual Glossary & Stats */}
      <div className="flex-1 flex flex-col h-full border-r border-white/[0.04] p-5 space-y-4 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-xs tracking-wider uppercase">Từ Điển Biến Số Trực Quan</h3>
          </div>
          <div className="flex gap-2">
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
            <Button variant="ghost" size="xs" onClick={handleExtractFromSchema} className="flex items-center gap-1 text-[10px]">
              <RefreshCw size={11} /> Đồng bộ từ Zod
            </Button>
          </div>
        </div>

        {/* Extracted Stats */}
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <div className="glass-panel p-3 rounded-xl border-white/[0.03] bg-white/[0.01] text-center">
            <span className="text-[10px] text-slate-400 block mb-0.5">Tổng số biến</span>
            <span className="text-lg font-bold font-mono text-indigo-400">{extractedVars.length}</span>
          </div>
          <div className="glass-panel p-3 rounded-xl border-white/[0.03] bg-white/[0.01] text-center">
            <span className="text-[10px] text-slate-400 block mb-0.5 font-medium text-emerald-500/80">Đã giải nghĩa</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{documentedCount}</span>
          </div>
          <div className="glass-panel p-3 rounded-xl border-white/[0.03] bg-white/[0.01] text-center">
            <span className="text-[10px] text-slate-400 block mb-0.5 font-medium text-amber-500/80">Chưa giải nghĩa</span>
            <span className="text-lg font-bold font-mono text-amber-400">{undocumentedCount}</span>
          </div>
        </div>

        {/* List of variables in schema */}
        <div className="flex-1 space-y-3">
          {extractedVars.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center p-6 glass-panel rounded-2xl border-white/[0.03] bg-white/[0.005]">
              <AlertCircle className="w-8 h-8 text-slate-500 mb-2.5" />
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Chưa phát hiện biến số nào. Hãy thiết lập Zod Schema ở mục <strong className="text-indigo-400">EJS/Zod</strong>, sau đó nhấn nút <strong>Đồng bộ từ Zod</strong> để bắt đầu.
              </p>
            </div>
          ) : (
            extractedVars.map((v, idx) => (
              <div 
                key={idx} 
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  v.description && v.description !== '(Chưa có mô tả)'
                    ? 'glass-panel bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.02]' 
                    : 'bg-amber-500/[0.02] border-amber-500/10 hover:bg-amber-500/[0.04]'
                }`}
              >
                <div className="flex justify-between items-start gap-3 mb-1.5">
                  <span className="font-mono text-xs text-slate-200 font-semibold break-all">
                    {v.path}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/[0.04] text-[9px] font-mono text-indigo-400">
                      {v.type}
                    </span>
                    {v.defaultValue && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/[0.04] text-[9px] font-mono text-slate-400" title="Giá trị mặc định">
                        def: {v.defaultValue}
                      </span>
                    )}
                  </div>
                </div>
                
                {v.description && v.description !== '(Chưa có mô tả)' ? (
                  <p className="text-[11px] text-slate-400 leading-relaxed font-light pl-1 border-l border-emerald-500/30">
                    {v.description}
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-400/70 font-light italic flex items-center gap-1 pl-1 border-l border-amber-500/30">
                    <AlertTriangle size={10} /> Chưa có giải nghĩa chi tiết trong từ điển.
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Markdown Dictionary Editor */}
      <div className="w-[500px] flex flex-col h-full bg-[#04060f]/40 border-l border-white/[0.04] shrink-0 p-5 space-y-4">
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-xs tracking-wide uppercase">Cấu hình từ điển (Markdown)</h3>
          </div>
          <Button 
            variant="purple" 
            size="xs" 
            onClick={handleAiDocument} 
            disabled={loading || !zodSchema} 
            className="flex items-center gap-1 px-2.5 py-1 text-[10px]"
          >
            <Sparkles size={11} /> Nhờ Tawa Giải Nghĩa
          </Button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 relative">
          {loading && (
            <div className="absolute inset-0 bg-[#04060f]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <Loader />
              <div className="text-xs text-indigo-300 font-mono max-w-sm max-h-[150px] overflow-y-auto scrollbar-none whitespace-pre-wrap">
                {streamBuffer || "Tawa đang phân tích Zod Schema..."}
              </div>
            </div>
          )}
          <CodeTextarea
            value={dictionaryText}
            onChange={handleDictionaryChange}
            className="flex-grow h-full min-h-[300px]"
            placeholder="# BỘ TỪ ĐIỂN BIẾN SỐ\n\n- `stat_data.Nhân vật.HP`: Điểm sinh mệnh..."
          />
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-4 rounded-xl glass-panel border-white/[0.03] space-y-2 text-[10px] text-slate-400 leading-relaxed shrink-0">
          <h4 className="font-bold text-indigo-400 flex items-center gap-1.5">
            <Info size={12} /> Hướng dẫn từ điển
          </h4>
          <p>
            1. Bộ từ điển giúp Tawa AI hiểu chính xác cấu trúc và giới hạn các biến số của thẻ.
          </p>
          <p>
            2. Hãy dùng cú pháp danh sách markdown: <code className="text-slate-300 bg-black/40 border border-white/[0.04] px-1 py-0.5 rounded font-mono">- `biến`: giải_thích_biến</code> để đồng bộ hiển thị trực quan ở cột bên trái.
          </p>
        </div>
      </div>
    </div>

    {/* Tawa Chat Panel (Toggleable) */}
    {showChat && (
    <TawaInlineChat
      title="Tawa Từ Điển"
      subtitle="Chỉnh sửa từ điển biến số"
      chatMessages={chatMessages}
      setChatMessages={setChatMessages}
      loading={chatLoading}
      streamBuffer={chatStreamBuffer}
      onSendMessage={handleDictChat}
      placeholderText="Nhờ Tawa giải thích hoặc chỉnh sửa từ điển..."
      emptyStateTitle="Tawa Từ Điển Editor"
      emptyStateDescription="Hãy chat với Tawa để tạo, chỉnh sửa hoặc mở rộng từ điển biến số."
      suggestions={[
        'Giải thích toàn bộ biến số trong Zod Schema',
        'Bổ sung mô tả chi tiết cho từng biến',
        'Thêm phần giải thích cơ chế game'
      ]}
      renderActionBadge={(msg) => {
        if (msg.dictActions && msg.dictActions.length > 0) {
          return (
            <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">Đã cập nhật:</span>
              {msg.dictActions.map((act, idx) => (
                <div key={idx} className="flex items-center gap-1.5 p-2 rounded-xl bg-black/40 border border-white/[0.03] text-[10px] text-green-400">
                  <Check size={12} />
                  <span>Từ điển đã được cập nhật</span>
                </div>
              ))}
            </div>
          );
        }
        return null;
      }}
    />
    )}
    </div>
  );
};

const Loader = () => (
  <div className="flex flex-col items-center gap-2">
    <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
    <span className="text-[10px] text-indigo-400 font-medium">Tawa đang dệt từ điển...</span>
  </div>
);
