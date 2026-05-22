import React, { useState, useEffect, useRef } from 'react';
import { CardProject, OpenAISettings, SimulatorMessage } from '../types';
import { exportCardV3 } from '../services/cardExporter';
import { CodeTextarea } from './ui/CodeTextarea';
import { Button } from './ui/Button';
import { 
  scanLorebook, 
  buildSillyTavernPrompt, 
  applyJsonPatch, 
  extractJsonPatchFromText, 
  sendSimulatorMessage,
  evaluateTemplate,
  applyRegexByPlacement,
  injectDepthEntries
} from '../services/simulator';
import { 
  Play, Eye, Code, Terminal, Layers, Copy, Check, 
  AlertTriangle, RefreshCw, FileText, Smartphone,
  MessageSquare, Send, Trash, EyeOff, Sparkles, User, Settings
} from 'lucide-react';

interface CardPreviewProps {
  project: CardProject;
  settings?: OpenAISettings;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ project, settings }) => {
  const [activeTab, setActiveTab] = useState<'split' | 'chat' | 'ui' | 'json'>('split');
  const [rightSubTab, setRightSubTab] = useState<'state' | 'logs'>('state');
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  
  // Mock ST variables state
  const [mockState, setMockState] = useState<any>(() => {
    // Try to load initial values from zod_schema or defaults
    return {
      stat_data: {
        'Nhân vật': {
          Tên: project.charData.name || "Nhân vật",
          HP: 100,
          MaxHP: 100,
          'Sức mạnh': 15,
          'Khéo léo': 10,
          'Trí tuệ': 12,
          Vàng: 150,
          'Cấp độ': 1,
          'Kinh nghiệm': 0,
          'Độ hảo cảm': 50
        },
        'Định vị thế giới': {
          'Đại vực hiện tại': "Trung Ương"
        },
        'Nhân vật có mặt': {}
      },
      wi_entries: {}
    };
  });

  // State text area input for editing
  const [stateJsonStr, setStateJsonStr] = useState('');
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Simulator Chat States
  const [chatHistory, setChatHistory] = useState<SimulatorMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptDebug, setShowPromptDebug] = useState(false);
  const [lastPromptDebug, setLastPromptDebug] = useState<{ 
    systemPrompt: string; 
    postHistoryInstructions: string; 
    promptInjects: string;
    cleanSystemPrompt?: string;
    cleanPostHistoryInstructions?: string;
  } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync state json string
  useEffect(() => {
    setStateJsonStr(JSON.stringify(mockState, null, 2));
    
    // Post update message to iframe
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'PARENT_STATE_UPDATED',
        state: mockState
      }, '*');
    }
  }, [mockState]);

  // Sync character name into mock state
  useEffect(() => {
    if (project.charData.name) {
      setMockState((prev: any) => ({
        ...prev,
        stat_data: {
          ...prev.stat_data,
          'Nhân vật': {
            ...prev.stat_data?.['Nhân vật'],
            Tên: project.charData.name
          }
        }
      }));
    }
  }, [project.charData.name]);

  // Seed default ERA entries if ERA card
  useEffect(() => {
    if (project.type === 'era') {
      const initialWi: any = {};
      project.lorebook.entries.forEach(e => {
        if (e.key && e.key.length > 0) {
          initialWi[e.key[0]] = e.content;
        }
      });
      setMockState((prev: any) => ({
        ...prev,
        wi_entries: {
          ...prev.wi_entries,
          ...initialWi
        }
      }));
    }
  }, [project.lorebook.entries, project.type]);

  // Initialize Chat History with first message
  useEffect(() => {
    if (chatHistory.length === 0) {
      handleResetChat();
    }
  }, [project.charData.first_mes]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Find HTML content in scripts
  const htmlScripts = project.regexScripts.filter(s => {
    const hasHtml = s.replaceString.includes('```html') || 
                    s.replaceString.includes('<html') || 
                    s.replaceString.includes('<!DOCTYPE') ||
                    s.replaceString.includes('<div');
    return s.isactive && hasHtml;
  });

  // Select default script
  useEffect(() => {
    if (htmlScripts.length > 0 && !selectedScriptId) {
      setSelectedScriptId(htmlScripts[0].id);
    }
  }, [htmlScripts, selectedScriptId]);

  const activeScript = project.regexScripts.find(s => s.id === selectedScriptId) || htmlScripts[0];

  const getHtmlUi = (): string => {
    if (!activeScript) return '';
    const content = activeScript.replaceString;
    // Extract from ```html ... ``` if wrapped
    const match = content.match(/```html\s*([\s\S]*?)\s*```/i);
    if (match) return match[1];
    return content;
  };

  // Construct iframe source doc with injected API
  const getSrcDoc = () => {
    const html = getHtmlUi();
    if (!html) return '';

    const injectedScript = `
      <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script>
      <script>
        (function() {
          // Initialize mock variables and cache parent window before window.parent override
          const parentWindow = window.parent;
          window.mvu_state = ${JSON.stringify(mockState)};
          
          // Event system mock
          const listeners = {};
          window.Mvu = {
            events: {
              VARIABLE_UPDATE_ENDED: 'variable_update_ended'
            }
          };

          window.eventOn = function(event, callback) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(callback);
          };

          window.waitGlobalInitialized = async function(moduleName) {
            return new Promise((resolve) => {
              setTimeout(resolve, 30);
            });
          };

          window.getvar = function(path, options) {
            if (!path) return undefined;
            const parts = path.split('.');
            let current = window.mvu_state;
            for (const part of parts) {
              if (current == null) return options?.defaults;
              current = current[part];
            }
            return current !== undefined ? current : (options ? options.defaults : undefined);
          };
          
          window.setvar = function(path, value) {
            if (!path) return;
            const parts = path.split('.');
            let current = window.mvu_state;
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              if (current[part] === undefined) current[part] = {};
              current = current[part];
            }
            current[parts[parts.length - 1]] = value;
            
            // Notify parent window of state change
            parentWindow.postMessage({ 
              type: 'STATE_UPDATED', 
              state: window.mvu_state,
              path: path,
              value: value
            }, '*');

            // Trigger local listeners
            if (listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED]) {
              listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED].forEach(cb => {
                try { cb(); } catch(e) { console.error("Error in listener:", e); }
              });
            }
          };
          
          window.getAllVariables = function() {
            return window.mvu_state;
          };

          window.getwi = async function(entryName) {
            console.log('getwi called:', entryName);
            const content = window.mvu_state.wi_entries?.[entryName] || "";
            parentWindow.postMessage({ type: 'GETWI_CALLED', entryName, content }, '*');
            return content;
          };

          window.setwi = async function(entryName, content) {
            console.log('setwi called:', entryName, content);
            if (!window.mvu_state.wi_entries) window.mvu_state.wi_entries = {};
            window.mvu_state.wi_entries[entryName] = content;
            parentWindow.postMessage({ 
              type: 'SETWI_CALLED', 
              entryName, 
              content,
              state: window.mvu_state
            }, '*');

            // Trigger local listeners
            if (listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED]) {
              listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED].forEach(cb => {
                try { cb(); } catch(e) { console.error("Error in listener:", e); }
              });
            }
          };
          
          window.triggerSlash = function(cmd) {
            parentWindow.postMessage({ type: 'SLASH_COMMAND', command: cmd }, '*');
          };
          
          window.errorCatched = function(fn) {
            return function(...args) {
              try {
                return fn(...args);
              } catch (e) {
                console.error("Lỗi trong Game UI:", e);
                parentWindow.postMessage({ type: 'UI_ERROR', error: e.message }, '*');
              }
            }
          };

          // Simple jQuery-like mock $
          window.$ = function(selector) {
            if (typeof selector === 'function') {
              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                selector();
              } else {
                document.addEventListener('DOMContentLoaded', selector);
              }
              return;
            }
            const els = document.querySelectorAll(selector);
            return {
              click: function(fn) {
                els.forEach(el => el.addEventListener('click', fn));
                return this;
              },
              text: function(txt) {
                if (txt === undefined) return els[0]?.textContent;
                els.forEach(el => el.textContent = txt);
                return this;
              },
              val: function(v) {
                if (v === undefined) return els[0]?.value;
                els.forEach(el => el.value = v);
                return this;
              },
              show: function() {
                els.forEach(el => el.style.display = '');
                return this;
              },
              hide: function() {
                els.forEach(el => el.style.display = 'none');
                return this;
              },
              addClass: function(cls) {
                els.forEach(el => el.classList.add(cls));
                return this;
              },
              removeClass: function(cls) {
                els.forEach(el => el.classList.remove(cls));
                return this;
              },
              toggleClass: function(cls) {
                els.forEach(el => el.classList.toggle(cls));
                return this;
              },
              css: function(prop, val) {
                els.forEach(el => el.style[prop] = val);
                return this;
              },
              html: function(h) {
                if (h === undefined) return els[0]?.innerHTML;
                els.forEach(el => el.innerHTML = h);
                return this;
              }
            };
          };
          window.$.errorCatched = window.errorCatched;

          // Listen to state changes pushed from parent
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'PARENT_STATE_UPDATED') {
              window.mvu_state = event.data.state;
              if (listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED]) {
                listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED].forEach(cb => {
                  try { cb(); } catch(e) { }
                });
              }
            }
          });

          window.parent = window;
        })();
      </script>
    `;

    // Inject before first head or body tag
    const insertIndex = html.toLowerCase().indexOf('<head>');
    if (insertIndex !== -1) {
      return html.substring(0, insertIndex + 6) + injectedScript + html.substring(insertIndex + 6);
    } else {
      const bodyIndex = html.toLowerCase().indexOf('<body>');
      if (bodyIndex !== -1) {
        return html.substring(0, bodyIndex) + injectedScript + html.substring(bodyIndex);
      }
      return injectedScript + html;
    }
  };

  // Listen to iframe communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      const timestamp = new Date().toLocaleTimeString('vi-VN');

      if (data.type === 'STATE_UPDATED') {
        setMockState(data.state);
        setLogs(prev => [
          ...prev, 
          `[${timestamp}] Cập nhật biến: setvar('${data.path}', ${JSON.stringify(data.value)})`
        ]);
      } else if (data.type === 'SETWI_CALLED') {
        setMockState(data.state);
        setLogs(prev => [
          ...prev, 
          `[${timestamp}] Đè biến ERA: setwi('${data.entryName}', '${data.content.substring(0, 30)}...')`
        ]);
      } else if (data.type === 'GETWI_CALLED') {
        setLogs(prev => [
          ...prev, 
          `[${timestamp}] Đọc biến ERA: getwi('${data.entryName}') -> '${data.content.substring(0, 30)}...'`
        ]);
      } else if (data.type === 'SLASH_COMMAND') {
        setLogs(prev => [
          ...prev, 
          `[${timestamp}] Gọi Slash Command: ${data.command}`
        ]);
        // Auto send slash command as user message to the simulator
        handleSendCustomMessage(data.command);
      } else if (data.type === 'UI_ERROR') {
        setLogs(prev => [
          ...prev, 
          `[${timestamp}] ❌ Lỗi UI: ${data.error}`
        ]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleUpdateMockState = () => {
    try {
      const parsed = JSON.parse(stateJsonStr);
      setMockState(parsed);
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('vi-VN')}] Cập nhật Mock State thủ công thành công.`]);
      
      // Force reload iframe to inject new state
      if (iframeRef.current) {
        iframeRef.current.srcdoc = getSrcDoc();
      }
    } catch (e: any) {
      alert("Lỗi cú pháp JSON: " + e.message);
    }
  };

  const handleCopyJson = () => {
    const cardJson = exportCardV3(project);
    navigator.clipboard.writeText(cardJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- SIMULATOR CHAT FUNCTIONS ---

  const handleResetChat = () => {
    const defaultFirstMes = project.charData.first_mes || `Xin chào, ta là ${project.charData.name || 'nhân vật'}. Hãy cùng trò chuyện nào!`;
    const evaluatedFirstMes = evaluateTemplate(defaultFirstMes, project.charData.name, mockState);
    const processedFirstMes = applyRegexByPlacement(evaluatedFirstMes, project.regexScripts, 1);
    setChatHistory([
      {
        id: 'first-mes',
        role: 'assistant',
        content: processedFirstMes,
        timestamp: Date.now()
      }
    ]);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('vi-VN')}] Phòng chat đã được khởi tạo lại.`]);
  };

  const handleSendCustomMessage = (text: string) => {
    if (!text.trim() || isGenerating) return;
    executeChatTurn(text);
  };

  const handleSendButtonClick = () => {
    if (!chatInput.trim() || isGenerating) return;
    const text = chatInput;
    setChatInput('');
    executeChatTurn(text);
  };

  const executeChatTurn = async (userText: string) => {
    if (!settings || !settings.apiKey) {
      alert("Bạn chưa cấu hình API Key. Hãy nhấn biểu tượng bánh răng Cài đặt ở góc trên bên phải màn hình chính để thiết lập.");
      return;
    }

    const timestamp = new Date().toLocaleTimeString('vi-VN');
    
    // Apply User Input Regex (placement: 0)
    const processedUserText = applyRegexByPlacement(userText, project.regexScripts, 0);
    if (processedUserText !== userText) {
      setLogs(prev => [...prev, `[${timestamp}] 📝 [Regex User Input] Chuyển đổi đầu vào: "${userText}" -> "${processedUserText}"`]);
    }

    // 1. Add user message
    const userMsg: SimulatorMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: processedUserText,
      timestamp: Date.now()
    };
    
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setIsGenerating(true);

    // 2. Scan Lorebook
    const { injectedEntries, log: scanLogs } = scanLorebook(updatedHistory, project.lorebook);
    scanLogs.forEach(sLog => {
      setLogs(prev => [...prev, `[${timestamp}] ${sLog}`]);
    });

    // 3. Build Prompt
    const { systemPrompt, postHistoryInstructions, depthEntries, promptInjects } = buildSillyTavernPrompt(
      project.charData,
      injectedEntries,
      mockState
    );
    
    const cleanSystemPrompt = applyRegexByPlacement(systemPrompt, project.regexScripts, 2);
    const cleanPostHistoryInstructions = postHistoryInstructions
      ? applyRegexByPlacement(postHistoryInstructions, project.regexScripts, 2)
      : '';

    setLastPromptDebug({ 
      systemPrompt, 
      postHistoryInstructions,
      promptInjects,
      cleanSystemPrompt,
      cleanPostHistoryInstructions
    });

    // Splice depth-based entries into transient apiHistory
    const apiHistory = injectDepthEntries(updatedHistory, depthEntries, project.charData.name || 'Char', mockState);

    // 4. Create empty assistant message
    const assistantMsgId = 'assistant-' + Date.now();
    const assistantPlaceholder: SimulatorMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      injectedLorebook: injectedEntries.map(e => e.comment)
    };
    setChatHistory(prev => [...prev, assistantPlaceholder]);

    let aiRawResponse = '';

    try {
      // 5. Send API Request
      await sendSimulatorMessage(
        settings,
        systemPrompt,
        apiHistory,
        postHistoryInstructions,
        project.regexScripts,
        (partialText) => {
          aiRawResponse = partialText;
          setChatHistory(prev => 
            prev.map(m => m.id === assistantMsgId ? { ...m, content: partialText } : m)
          );
        }
      );

      // Apply AI Output Regex (placement: 1)
      const processedAiResponse = applyRegexByPlacement(aiRawResponse, project.regexScripts, 1);
      if (processedAiResponse !== aiRawResponse) {
        setLogs(prev => [...prev, `[${timestamp}] 📝 [Regex AI Output] Chuyển đổi câu trả lời AI.`]);
      }
      setChatHistory(prev => 
        prev.map(m => m.id === assistantMsgId ? { ...m, content: processedAiResponse } : m)
      );

      // 6. Handle Response: Parse JSON Patch & Apply
      const { patches, log: patchLog } = extractJsonPatchFromText(aiRawResponse);
      setLogs(prev => [...prev, `[${timestamp}] AI Reply: ${patchLog}`]);

      if (patches.length > 0) {
        const { nextState, appliedLog } = applyJsonPatch(patches, mockState);
        setMockState(nextState);
        appliedLog.forEach(aLog => {
          setLogs(prev => [...prev, `[${timestamp}] ⚙️ [Patch] ${aLog}`]);
        });
      }
    } catch (error: any) {
      console.error(error);
      setChatHistory(prev => 
        prev.map(m => m.id === assistantMsgId ? { ...m, content: `[Lỗi hệ thống: ${error.message}]` } : m)
      );
      setLogs(prev => [...prev, `[${timestamp}] ❌ Lỗi kết nối AI: ${error.message}`]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Expose triggerSlash on the parent window for interactive HTML click triggers inside chat bubbles
  useEffect(() => {
    (window as any).triggerSlash = (cmd: string) => {
      if (!cmd || !cmd.trim()) return;
      const timestamp = new Date().toLocaleTimeString('vi-VN');
      setLogs(prev => [
        ...prev,
        `[${timestamp}] Lệnh được click từ Chat HTML: ${cmd}`
      ]);
      executeChatTurn(cmd);
    };
    return () => {
      delete (window as any).triggerSlash;
    };
  }, [chatHistory, isGenerating, settings, mockState]);

  // Cleaner helper for chat display
  const cleanMessageContent = (text: string): string => {
    if (!text) return '';
    // Strip UpdateVariable block
    let cleaned = text.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '');
    cleaned = cleaned.replace(/<JSONPatch>[\s\S]*?<\/JSONPatch>/gi, '');
    return cleaned.trim();
  };

  const formatMessageText = (text: string, role: string): React.ReactNode => {
    const cleaned = cleanMessageContent(text);
    const placement = role === 'user' ? 0 : 1;
    const applied = applyRegexByPlacement(cleaned, project.regexScripts, placement);
    
    // Convert Markdown italics (*text*) to HTML spans
    const htmlFormatted = applied.replace(/\*([^*]+)\*/g, '<span class="italic text-indigo-300 font-medium">$1</span>');

    return (
      <div 
        className="whitespace-pre-wrap leading-relaxed break-words text-sm text-slate-200 html-message-content"
        dangerouslySetInnerHTML={{ __html: htmlFormatted }}
      />
    );
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

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 bg-[#04060f] overflow-hidden">
      
      {/* Left & Middle: Preview / Simulator Panel */}
      <div className="flex-1 flex flex-col h-full border-r border-white/[0.04] bg-[#04060f]/20 min-w-0">
        
        {/* Navigation Tabs */}
        <div className="flex justify-between items-center px-6 bg-slate-950/20 border-b border-white/[0.04] shrink-0 h-14">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('split')}
              className={`px-4 py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
                activeTab === 'split'
                  ? `border-${themeColor}-500 text-${themeColor}-400`
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Giả lập Kép (Chat + UI)
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
                activeTab === 'chat'
                  ? `border-${themeColor}-500 text-${themeColor}-400`
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Phòng Chat
            </button>
            <button
              onClick={() => setActiveTab('ui')}
              className={`px-4 py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
                activeTab === 'ui'
                  ? `border-${themeColor}-500 text-${themeColor}-400`
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Giao Diện UI
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-4 py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
                activeTab === 'json'
                  ? `border-${themeColor}-500 text-${themeColor}-400`
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              JSON Card (V3)
            </button>
          </div>

          {activeTab !== 'json' && htmlScripts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chọn Regex UI:</span>
              <select
                value={selectedScriptId}
                onChange={(e) => setSelectedScriptId(e.target.value)}
                className="bg-slate-900 border border-white/[0.05] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              >
                {htmlScripts.map(s => (
                  <option key={s.id} value={s.id}>{s.scriptName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Viewport Content */}
        <div className="flex-1 overflow-hidden relative min-h-0">
          
          {/* JSON VIEW */}
          {activeTab === 'json' && (
            <div className="h-full flex flex-col p-5 bg-[#04060f]/40">
              <div className="flex justify-between items-center bg-[#04060f]/80 border border-white/[0.05] border-b-0 rounded-t-2xl px-4.5 py-3 shrink-0">
                <span className="font-mono text-xs text-indigo-400 font-semibold">card_v3_export.json</span>
                <Button
                  variant={themeColor}
                  size="sm"
                  onClick={handleCopyJson}
                  className="py-1 text-[11px] rounded-lg click-bounce"
                  icon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? 'Đã sao chép' : 'Sao chép JSON'}
                </Button>
              </div>
              <CodeTextarea
                value={exportCardV3(project)}
                onChange={() => {}}
                readOnly
                className="flex-grow rounded-t-none rounded-b-2xl border border-white/[0.05] border-t-0 font-mono text-xs bg-slate-950"
              />
            </div>
          )}

          {/* SPLIT VIEW (CHAT + HTML PREVIEW) */}
          {activeTab === 'split' && (
            <div className="w-full h-full flex flex-col lg:flex-row min-h-0">
              {/* Left Column: Chat Simulator */}
              <div className="flex-1 flex flex-col border-r border-white/[0.04] bg-[#070913]/40 min-h-0 relative">
                {renderChatSimulator()}
              </div>

              {/* Right Column: HTML UI */}
              <div className="flex-1 flex flex-col bg-slate-950/20 min-h-0 relative">
                {renderHtmlPreview()}
              </div>
            </div>
          )}

          {/* CHAT ONLY VIEW */}
          {activeTab === 'chat' && (
            <div className="w-full h-full flex flex-col bg-[#070913]/40 min-h-0 relative">
              {renderChatSimulator()}
            </div>
          )}

          {/* UI ONLY VIEW */}
          {activeTab === 'ui' && (
            <div className="w-full h-full flex flex-col bg-slate-950/20 min-h-0 relative">
              {renderHtmlPreview()}
            </div>
          )}

        </div>
      </div>

      {/* Right: State & Logs Inspector */}
      <div className="w-96 border-l border-white/[0.04] flex flex-col h-full bg-slate-950/20 shrink-0">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/[0.04] bg-slate-950/20 shrink-0 h-14 px-2 items-center">
          <button
            onClick={() => setRightSubTab('state')}
            className={`flex-1 text-center py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
              rightSubTab === 'state'
                ? `border-${themeColor}-500 text-${themeColor}-400`
                : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
          >
            Biến số giả lập
          </button>
          <button
            onClick={() => setRightSubTab('logs')}
            className={`flex-1 text-center py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
              rightSubTab === 'logs'
                ? `border-${themeColor}-500 text-${themeColor}-400`
                : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
          >
            Nhật ký chạy (Logs)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {rightSubTab === 'state' ? (
            <div className="h-full flex flex-col p-4.5 space-y-4">
              <p className="text-[10px] text-slate-400 leading-normal">
                Các biến số đồng bộ trực tiếp với Chat Simulator. Sửa JSON rồi bấm <strong>Cập Nhật</strong> nếu muốn can thiệp thủ công.
              </p>
              
              <div className="flex-grow overflow-hidden">
                <textarea
                  value={stateJsonStr}
                  onChange={(e) => setStateJsonStr(e.target.value)}
                  className="w-full h-full bg-slate-950/80 text-slate-300 p-3 rounded-2xl border border-white/[0.05] outline-none resize-none font-mono text-[10px] leading-relaxed focus:border-indigo-500/50 custom-scrollbar focus:ring-0"
                  spellCheck="false"
                />
              </div>

              <Button
                variant={themeColor}
                onClick={handleUpdateMockState}
                className="w-full py-2.5 font-bold text-xs rounded-xl click-bounce"
                icon={<RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />}
              >
                Cập nhật biến & Sync
              </Button>
            </div>
          ) : (
            /* Logs Pane */
            <div className="h-full flex flex-col p-4.5 space-y-3">
              <div className="flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal size={12} className={`text-${themeColor}-400`} /> Tavern Console Logs
                </span>
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition click-bounce"
                >
                  Xóa sạch
                </button>
              </div>

              <div className="flex-grow bg-black/60 rounded-2xl border border-white/[0.04] p-3.5 overflow-y-auto custom-scrollbar font-mono text-[10px] leading-relaxed text-slate-400 space-y-2">
                {logs.length === 0 ? (
                  <div className="text-slate-600 text-center py-12">Không có nhật ký chạy nào được ghi nhận.</div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="border-b border-white/[0.02] pb-1.5 break-words">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );

  // --- INLINE RENDERING FUNCTIONS ---

  function renderChatSimulator() {
    const charName = project.charData.name || 'Nhân vật';
    const isApiKeyMissing = !settings || !settings.apiKey;

    return (
      <div className="flex flex-col h-full bg-[#080b17] min-h-0">
        {/* Chat Simulator Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/40 border-b border-white/[0.04] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-xs text-indigo-400 uppercase tracking-wider">
              {charName.substring(0, 2)}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">{charName}</div>
              <div className="text-[10px] text-slate-500">SillyTavern Simulator</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="py-1 text-[10px] font-semibold"
              onClick={() => setShowPromptDebug(!showPromptDebug)}
              icon={showPromptDebug ? <EyeOff size={11} /> : <Eye size={11} />}
            >
              Prompt Debug
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="py-1 text-[10px] text-red-400 hover:text-red-300 font-semibold"
              onClick={handleResetChat}
              icon={<Trash size={11} />}
            >
              Reset Chat
            </Button>
          </div>
        </div>

        {/* Warning if API Key is missing */}
        {isApiKeyMissing && (
          <div className="mx-4 mt-3 p-3.5 rounded-xl border border-yellow-500/15 bg-yellow-500/5 text-xs text-yellow-500/90 leading-relaxed flex gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold mb-0.5">⚠️ Thiếu API Key!</strong>
              Vui lòng mở bảng Cài Đặt (nhấp nút bánh răng ⚙️ ở thanh tiêu đề trên cùng của ứng dụng) để cung cấp API Key. Bạn cần cấu hình API trước khi có thể chat thử nghiệm.
            </div>
          </div>
        )}

        {/* Prompt Debugger Overlay */}
        {showPromptDebug && (
          <div className="m-4 p-4 rounded-xl border border-white/[0.06] bg-slate-950 text-[10px] font-mono leading-relaxed text-slate-400 max-h-72 overflow-y-auto custom-scrollbar space-y-4">
            <div className="font-bold text-indigo-400 uppercase tracking-wider border-b border-white/5 pb-1 flex justify-between items-center">
              <span>Prompt Debugging Context</span>
              <span className="text-[9px] text-slate-500 font-normal normal-case">Hiển thị nội dung Prompt SillyTavern đã xử lý</span>
            </div>
            <div>
              <span className="text-slate-200 font-semibold">Prompt Inject Summary:</span>
              <pre className="mt-1 p-2 rounded bg-white/5 whitespace-pre-wrap">{lastPromptDebug?.promptInjects || 'Chưa gửi tin nhắn nào. Vui lòng chat để xem log.'}</pre>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-200 font-semibold block mb-1">Full System Prompt (Thô):</span>
                <pre className="p-2 rounded bg-white/5 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">{lastPromptDebug?.systemPrompt || 'Chưa có thông tin.'}</pre>
              </div>
              <div>
                <span className="text-emerald-400 font-semibold block mb-1">Full System Prompt (Sạch sau Regex Prompt [2]):</span>
                <pre className="p-2 rounded bg-emerald-500/5 border border-emerald-500/10 text-emerald-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">{lastPromptDebug?.cleanSystemPrompt || 'Chưa có thông tin.'}</pre>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-200 font-semibold block mb-1">Post-History Instructions (Thô - AN):</span>
                <pre className="p-2 rounded bg-white/5 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">{lastPromptDebug?.postHistoryInstructions || 'Không có.'}</pre>
              </div>
              <div>
                <span className="text-emerald-400 font-semibold block mb-1">Post-History Instructions (Sạch sau Regex Prompt [2]):</span>
                <pre className="p-2 rounded bg-emerald-500/5 border border-emerald-500/10 text-emerald-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">{lastPromptDebug?.cleanPostHistoryInstructions || 'Không có.'}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Message bubbles area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/10 via-[#04060f]/60 to-[#04060f]">
          {chatHistory.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id || index} className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {/* Character Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/80 shrink-0 flex items-center justify-center font-bold text-xs text-indigo-300 uppercase shadow-md select-none mt-0.5">
                    {charName.substring(0, 2)}
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md border ${
                  isUser 
                    ? 'bg-indigo-600/20 border-indigo-500/20 rounded-tr-none text-right' 
                    : 'bg-slate-900/50 border-white/[0.04] rounded-tl-none text-left'
                }`}>
                  {/* Speaker name */}
                  <div className="text-[10px] font-bold text-slate-500 mb-1 select-none">
                    {isUser ? 'You' : charName}
                  </div>

                  {/* Body text formatted */}
                  <div className="text-slate-200">
                    {formatMessageText(msg.content, msg.role)}
                  </div>

                  {/* Streaming indicator */}
                  {!isUser && msg.content === '' && isGenerating && (
                    <div className="flex gap-1.5 items-center py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  )}

                  {/* Injected Lorebooks Tags */}
                  {!isUser && msg.injectedLorebook && msg.injectedLorebook.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/[0.03]">
                      {msg.injectedLorebook.map((lbName, lbIdx) => (
                        <span key={lbIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] text-indigo-300 font-mono">
                          🔑 {lbName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-indigo-900/60 border border-indigo-500/40 shrink-0 flex items-center justify-center font-bold text-xs text-indigo-200 uppercase shadow-md select-none mt-0.5">
                    U
                  </div>
                )}
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input box */}
        <div className="p-3 bg-slate-950/40 border-t border-white/[0.04] flex items-center gap-3 shrink-0">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendButtonClick();
              }
            }}
            placeholder={isApiKeyMissing ? "Cần thiết lập API Key trước..." : `Gửi tin nhắn cho ${charName}... (Enter để gửi)`}
            disabled={isGenerating || isApiKeyMissing}
            rows={1}
            className="flex-grow bg-slate-900 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 resize-none custom-scrollbar disabled:opacity-50"
          />
          <Button
            variant={themeColor}
            size="sm"
            onClick={handleSendButtonClick}
            disabled={isGenerating || isApiKeyMissing || !chatInput.trim()}
            className="py-2.5 px-3.5 rounded-xl shrink-0"
          >
            <Send size={15} />
          </Button>
        </div>
      </div>
    );
  }

  function renderHtmlPreview() {
    return (
      <div className="w-full h-full flex flex-col bg-slate-900/10">
        {/* Simulated Chatbox Frame Header */}
        <div className="flex items-center justify-between bg-slate-950/20 border-b border-white/[0.04] px-5 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Khung mô phỏng HTML Dashboard</span>
          </div>
          <button
            className="px-3.5 py-1.5 rounded-lg hover:bg-white/[0.03] border border-white/[0.04] text-[10px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition click-bounce"
            onClick={() => {
              if (iframeRef.current) iframeRef.current.srcdoc = getSrcDoc();
            }}
          >
            <RefreshCw size={12} /> Reload UI
          </button>
        </div>

        {/* HTML UI iframe Container */}
        {htmlScripts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h4 className="font-bold text-slate-200 text-sm mb-1 uppercase tracking-wider">Chưa có HTML UI Script</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                App chưa phát hiện bất kỳ Regex Script hoạt động nào chứa mã nguồn HTML UI (chuỗi thay thế bắt đầu bằng code HTML hoặc bọc trong <code>```html</code>).
              </p>
            </div>
            <div className="glass-panel border-white/[0.04] bg-white/[0.01] p-4.5 rounded-2xl w-full text-left text-xs leading-relaxed space-y-2">
              <span className="font-bold text-indigo-400">Cách tạo giao diện:</span>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-[11px]">
                <li>Chuyển qua tab <strong>Regex Scripts</strong>.</li>
                <li>Tạo một Regex Script có chứa code HTML Dashboard trong phần chuỗi thay thế.</li>
                <li>Bật hoạt động (Active) và thiết lập markdownOnly: true.</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="flex-grow p-4.5 bg-[#04060f]/60 flex justify-center">
            <div className="w-full h-full glass-panel rounded-2xl border-white/[0.04] overflow-hidden shadow-2xl">
              <iframe
                ref={iframeRef}
                title="SillyTavern Game UI Simulator"
                srcDoc={getSrcDoc()}
                className="w-full h-full bg-[#161826] border-none"
              />
            </div>
          </div>
        )}
      </div>
    );
  }
};
