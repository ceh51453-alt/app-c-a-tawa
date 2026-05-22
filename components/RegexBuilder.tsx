import React, { useState, useRef, useEffect } from 'react';
import { CardProject, RegexScript, OpenAISettings, ChatMessage, RegexBuilderAction } from '../types';
import { regexBuilderChat } from '../services/openai';
import { CodeTextarea } from './ui/CodeTextarea';
import { Button } from './ui/Button';
import { 
  Plus, Trash2, Send, Bot, User, Loader2, Sparkles, Edit, 
  HelpCircle, Eye, EyeOff, CheckSquare, Square, Check, AlertCircle, RefreshCw,
  Play, Smartphone, FileText, CheckCircle, Copy, Split, AlertTriangle
} from 'lucide-react';
import { evaluateMacros, parseSlashRegex, substituteMacros } from '../services/simulator';
import { buildInitialStateFromSchema } from './CardPreview';

interface RegexBuilderProps {
  project: CardProject;
  onChange: (updatedProject: CardProject) => void;
  settings: OpenAISettings;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const RegexBuilder: React.FC<RegexBuilderProps> = ({
  project,
  onChange,
  settings,
  chatMessages,
  setChatMessages,
}) => {
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'chat' | 'debug'>('chat');
  
  // Chat state
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');

  // Debug & Testing State
  const [debugInputText, setDebugInputText] = useState<string>(
    `Nhân vật chính cảm thấy linh lực dồi dào, tu vi đột phá!\\n\\n<UpdateVariable>\\n<Analysis>\\nHP tăng 10 điểm, Linh Lực tăng 15 điểm, Tu Vi tăng 20 điểm.\\n</Analysis>\\n<JSONPatch>\\n[\\n  { "op": "delta", "path": "/stat_data/Nhân vật/HP", "value": 10 },\\n  { "op": "delta", "path": "/stat_data/Nhân vật/Linh Lực", "value": 15 },\\n  { "op": "delta", "path": "/stat_data/Nhân vật/Tu Vi", "value": 20 }\\n]\\n</JSONPatch>\\n</UpdateVariable>`
  );
  const [debugStateJson, setDebugStateJson] = useState<string>('');
  const [debugTargetScriptId, setDebugTargetScriptId] = useState<string>('all_active');
  const [debugPlacement, setDebugPlacement] = useState<number>(2); // Default to Display / Render
  const [debugResultText, setDebugResultText] = useState<string>('');
  const [debugTraceLogs, setDebugTraceLogs] = useState<any[]>([]);
  const [debugViewMode, setDebugViewMode] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [debugOutputSubTab, setDebugOutputSubTab] = useState<'preview' | 'diff' | 'trace'>('preview');
  const [debugError, setDebugError] = useState<string | null>(null);
  const [copiedDebug, setCopiedDebug] = useState(false);

  const debugIframeRef = useRef<HTMLIFrameElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [chatMessages, streamBuffer, activeTab]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Set default selected script
  useEffect(() => {
    if (project.regexScripts.length > 0 && !selectedScriptId) {
      setSelectedScriptId(project.regexScripts[0].id);
    }
  }, [project.regexScripts, selectedScriptId]);

  // Load simulator message and state helpers
  const loadLastMessageFromSimulator = () => {
    try {
      const historyStr = localStorage.getItem('sillyLore_simulator_history');
      if (historyStr) {
        const history = JSON.parse(historyStr);
        if (Array.isArray(history) && history.length > 0) {
          const lastMsg = history[history.length - 1];
          if (lastMsg && lastMsg.content) {
            setDebugInputText(lastMsg.content);
            return;
          }
        }
      }
      alert("Không tìm thấy lịch sử chat giả lập nào trong cache. Hãy vào phòng chat gửi tin nhắn trước.");
    } catch (e: any) {
      alert("Lỗi khi đọc lịch sử: " + e.message);
    }
  };

  const loadStateFromSimulator = () => {
    try {
      const stateStr = localStorage.getItem('sillyLore_simulator_state');
      if (stateStr) {
        const parsed = JSON.parse(stateStr);
        setDebugStateJson(JSON.stringify(parsed, null, 2));
      } else {
        const defaultState = buildInitialStateFromSchema(project);
        setDebugStateJson(JSON.stringify(defaultState, null, 2));
      }
    } catch (e) {
      const defaultState = buildInitialStateFromSchema(project);
      setDebugStateJson(JSON.stringify(defaultState, null, 2));
    }
  };

  // Sync simulator state on mount
  useEffect(() => {
    loadStateFromSimulator();
  }, [project]);

  // Listener to iframe postMessage
  useEffect(() => {
    const handleDebugMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;
      
      if (data.type === 'DEBUG_STATE_UPDATED' || data.type === 'DEBUG_SETWI_CALLED') {
        setDebugStateJson(JSON.stringify(data.state, null, 2));
      } else if (data.type === 'DEBUG_SLASH_COMMAND') {
        console.log("Debug slash command clicked:", data.command);
      }
    };
    window.addEventListener('message', handleDebugMessage);
    return () => window.removeEventListener('message', handleDebugMessage);
  }, []);

  const getHtmlUiFromText = (content: string): string => {
    if (!content) return '';
    const match = content.match(/```html\s*([\s\S]*?)\s*```/i);
    if (match) return match[1];
    return content;
  };

  const getTestSrcDoc = () => {
    const html = getHtmlUiFromText(debugResultText);
    if (!html) return '';

    let parsedState = {};
    try {
      if (debugStateJson.trim()) {
        parsedState = JSON.parse(debugStateJson);
      }
    } catch (e) {}

    const injectedScript = `
      <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>
      <script>
        (function() {
          const parentWindow = window.parent;
          window.mvu_state = ${JSON.stringify(parsedState)};
          
          if (!window._) {
            window._ = {
              get: function(obj, path, defaultValue) {
                if (!path) return defaultValue;
                const parts = Array.isArray(path) ? path : path.split('.');
                let current = obj;
                for (const part of parts) {
                  if (current == null) return defaultValue;
                  current = current[part];
                }
                return current !== undefined ? current : defaultValue;
              }
            };
          }
          
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
            
            parentWindow.postMessage({ 
              type: 'DEBUG_STATE_UPDATED', 
              state: window.mvu_state,
              path: path,
              value: value
            }, '*');

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
            const content = window.mvu_state.wi_entries?.[entryName] || "";
            return content;
          };

          window.setwi = async function(entryName, content) {
            if (!window.mvu_state.wi_entries) window.mvu_state.wi_entries = {};
            window.mvu_state.wi_entries[entryName] = content;
            parentWindow.postMessage({ 
              type: 'DEBUG_SETWI_CALLED', 
              entryName, 
              content,
              state: window.mvu_state
            }, '*');

            if (listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED]) {
              listeners[window.Mvu.events.VARIABLE_UPDATE_ENDED].forEach(cb => {
                try { cb(); } catch(e) { console.error("Error in listener:", e); }
              });
            }
          };
          
          window.triggerSlash = function(cmd) {
            parentWindow.postMessage({ type: 'DEBUG_SLASH_COMMAND', command: cmd }, '*');
          };
          
          window.errorCatched = function(fn) {
            return function(...args) {
              try {
                return fn(...args);
              } catch (e) {
                console.error("Lỗi trong Game UI:", e);
                parentWindow.postMessage({ type: 'DEBUG_UI_ERROR', error: e.message }, '*');
              }
            }
          };

          if (window.jQuery) {
            window.jQuery.errorCatched = window.errorCatched;
          }

          if (!window.$) {
            window.$ = function(selector) {
              if (typeof selector === 'function') {
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  selector();
                } else {
                  document.addEventListener('DOMContentLoaded', selector);
                }
                return;
              }
              
              let els = [];
              if (typeof selector === 'string') {
                try {
                  els = Array.from(document.querySelectorAll(selector));
                } catch (e) {
                  console.warn("Invalid selector in mock:", selector);
                }
              } else if (selector instanceof HTMLElement || selector instanceof Document || selector instanceof Window) {
                els = [selector];
              } else if (selector && typeof selector.length === 'number') {
                els = Array.from(selector);
              }
              
              const mock = {
                length: els.length,
                click: function(fn) {
                  els.forEach(el => el.addEventListener('click', fn));
                  return mock;
                },
                on: function(event, sel, fn) {
                  if (typeof sel === 'function') {
                    els.forEach(el => el.addEventListener(event, sel));
                  } else {
                    els.forEach(el => {
                      el.addEventListener(event, function(e) {
                        const target = e.target.closest(sel);
                        if (target && el.contains(target)) {
                          fn.call(target, e);
                        }
                      });
                    });
                  }
                  return mock;
                },
                parent: function() {
                  const parents = els.map(el => el.parentElement).filter(Boolean);
                  return window.$(parents);
                },
                text: function(txt) {
                  if (txt === undefined) return els[0]?.textContent || '';
                  els.forEach(el => el.textContent = txt);
                  return mock;
                },
                val: function(v) {
                  if (v === undefined) return els[0]?.value || '';
                  els.forEach(el => el.value = v);
                  return mock;
                },
                show: function() {
                  els.forEach(el => {
                    el.style.display = '';
                    if (el.tagName === 'DIV' && el.style.display === 'none') {
                      el.style.display = 'block';
                    }
                  });
                  return mock;
                },
                hide: function() {
                  els.forEach(el => el.style.display = 'none');
                  return mock;
                },
                empty: function() {
                  els.forEach(el => el.innerHTML = '');
                  return mock;
                },
                append: function(htmlStr) {
                  els.forEach(el => {
                    const temp = document.createElement('div');
                    temp.innerHTML = htmlStr.trim();
                    Array.from(temp.childNodes).forEach(node => el.appendChild(node));
                  });
                  return mock;
                },
                find: function(sel) {
                  const matched = [];
                  els.forEach(el => {
                    try {
                      matched.push(...Array.from(el.querySelectorAll(sel)));
                    } catch(e) {}
                  });
                  return window.$(matched);
                },
                is: function(sel) {
                  if (sel === ':visible') {
                    return els.some(el => el.offsetWidth > 0 && el.offsetHeight > 0);
                  }
                  if (sel === ':hidden') {
                    return els.some(el => el.offsetWidth === 0 || el.offsetHeight === 0);
                  }
                  return els.some(el => {
                    try { return el.matches(sel); } catch(e) { return false; }
                  });
                },
                slideToggle: function(speed, cb) {
                  els.forEach(el => {
                    if (el.style.display === 'none') {
                      el.style.display = 'block';
                    } else {
                      el.style.display = 'none';
                    }
                  });
                  if (cb) cb();
                  return mock;
                }
              };
              return mock;
            };
          }

          window.parent = window;
        })();
      </script>
    `;

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

  useEffect(() => {
    if (activeTab === 'debug' && debugIframeRef.current) {
      debugIframeRef.current.srcdoc = getTestSrcDoc();
    }
  }, [debugResultText, debugStateJson, activeTab]);

  const runRegexTest = () => {
    setDebugError(null);
    let parsedState = {};
    if (debugStateJson.trim()) {
      try {
        parsedState = JSON.parse(debugStateJson);
      } catch (e: any) {
        setDebugError("Lỗi cú pháp JSON ở phần State: " + e.message);
        return;
      }
    }

    const inputText = debugInputText;
    let currentText = inputText.replace(/\r\n/g, '\n');

    const placement = debugPlacement;
    const charName = project.charData.name || 'Char';
    const userName = 'You';

    const scriptsToRun = debugTargetScriptId === 'all_active'
      ? project.regexScripts.filter(s => s.isactive && s.placement.includes(placement))
      : project.regexScripts.filter(s => s.id === debugTargetScriptId);

    const logs: any[] = [];

    scriptsToRun.forEach(script => {
      try {
        let patternStr = script.findRegex;
        if (script.substituteRegex) {
          patternStr = substituteMacros(patternStr, charName, userName, true);
        }

        let regex: RegExp;
        const slashRegex = parseSlashRegex(patternStr);
        if (slashRegex) {
          regex = new RegExp(slashRegex.pattern, slashRegex.flags);
        } else {
          regex = new RegExp(patternStr, 'g');
        }

        const beforeText = currentText;
        const matchCount = (beforeText.match(regex) || []).length;
        
        let replaceStr = script.replaceString || '';
        replaceStr = substituteMacros(replaceStr, charName, userName, false);
        if (parsedState) {
          replaceStr = evaluateMacros(replaceStr, parsedState);
        }

        const afterText = beforeText.replace(regex, replaceStr);
        const matched = beforeText !== afterText;

        logs.push({
          scriptId: script.id,
          scriptName: script.scriptName,
          findRegex: script.findRegex,
          replaceString: script.replaceString,
          matched,
          matchCount,
          before: beforeText,
          after: afterText
        });

        currentText = afterText;
      } catch (e: any) {
        logs.push({
          scriptId: script.id,
          scriptName: script.scriptName,
          findRegex: script.findRegex,
          replaceString: script.replaceString,
          matched: false,
          matchCount: 0,
          before: currentText,
          after: currentText,
          error: e.message
        });
      }
    });

    if (parsedState) {
      currentText = evaluateMacros(currentText, parsedState);
    }

    setDebugResultText(currentText);
    setDebugTraceLogs(logs);
  };

  const selectedScript = project.regexScripts.find(s => s.id === selectedScriptId);

  // Dynamic glow classes based on project type
  const getGlowClass = (isActive: boolean) => {
    if (!isActive) {
      return 'glass-panel bg-white/[0.01] hover:bg-white/[0.03] border-white/[0.04] text-slate-400 hover:text-slate-200';
    }
    switch (project.type) {
      case 'normal':
        return 'glow-active-blue bg-blue-500/[0.03] text-blue-100 border-blue-500/35';
      case 'mvu':
        return 'glow-active-pink bg-pink-500/[0.03] text-pink-100 border-pink-500/35';
      case 'mvu_zod':
        return 'glow-active-indigo bg-indigo-500/[0.03] text-indigo-100 border-indigo-500/35';
      case 'era':
        return 'glow-active-emerald bg-emerald-500/[0.03] text-emerald-100 border-emerald-500/35';
      default:
        return 'glow-active-indigo bg-indigo-500/[0.03] text-indigo-100 border-indigo-500/35';
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

  // Manual actions
  const handleCreateScript = () => {
    const newScript: RegexScript = {
      id: Date.now().toString(),
      scriptName: `Regex Script mới #${project.regexScripts.length + 1}`,
      findRegex: 'KEYWORD_MẪU',
      replaceString: '<!-- Thay thế bằng nội dung của bạn -->',
      trimStrings: [],
      minDepth: null,
      maxDepth: null,
      runOnSource: false,
      promptOnly: false,
      isactive: true,
      markdownOnly: true,
      runOnEdit: true,
      substituteRegex: 0,
      placement: [2]
    };

    onChange({
      ...project,
      regexScripts: [...project.regexScripts, newScript],
      updatedAt: Date.now()
    });
    setSelectedScriptId(newScript.id);
    setActiveTab('edit');
  };

  const handleUpdateScript = (field: keyof RegexScript, value: any) => {
    if (!selectedScriptId) return;
    onChange({
      ...project,
      regexScripts: project.regexScripts.map(s => 
        s.id === selectedScriptId ? { ...s, [field]: value } : s
      ),
      updatedAt: Date.now()
    });
  };

  const handleDeleteScript = (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa Regex Script này không?')) return;
    const updatedScripts = project.regexScripts.filter(s => s.id !== id);
    onChange({
      ...project,
      regexScripts: updatedScripts,
      updatedAt: Date.now()
    });
    if (selectedScriptId === id) {
      setSelectedScriptId(updatedScripts.length > 0 ? updatedScripts[0].id : null);
    }
  };

  // Toggle placement item
  const handleTogglePlacement = (placementVal: number) => {
    if (!selectedScript) return;
    const isSelected = selectedScript.placement.includes(placementVal);
    const newPlacement = isSelected
      ? selectedScript.placement.filter(p => p !== placementVal)
      : [...selectedScript.placement, placementVal].sort();
    
    handleUpdateScript('placement', newPlacement);
  };

  // Execute AI action on local project state
  const applyAIAction = (action: RegexBuilderAction) => {
    let updatedScripts = [...project.regexScripts];
    
    if (action.type === 'create') {
      const newScript: RegexScript = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        scriptName: action.data?.scriptName || 'Regex do AI tạo',
        findRegex: action.data?.findRegex || 'trigger_keyword',
        replaceString: action.data?.replaceString || '',
        trimStrings: action.data?.trimStrings || [],
        minDepth: action.data?.minDepth ?? null,
        maxDepth: action.data?.maxDepth ?? null,
        runOnSource: action.data?.runOnSource ?? false,
        promptOnly: action.data?.promptOnly ?? false,
        isactive: action.data?.isactive ?? true,
        markdownOnly: action.data?.markdownOnly ?? true,
        runOnEdit: action.data?.runOnEdit ?? true,
        substituteRegex: action.data?.substituteRegex ?? 0,
        placement: action.data?.placement || [2]
      };
      updatedScripts.push(newScript);
    } else if (action.type === 'update') {
      let targetId = action.target_id;
      if (!targetId && action.target_name) {
        // Find by name
        const match = updatedScripts.find(s => s.scriptName.toLowerCase().includes(action.target_name!.toLowerCase()));
        if (match) targetId = match.id;
      }
      
      if (targetId) {
        updatedScripts = updatedScripts.map(s => 
          s.id === targetId ? { ...s, ...action.data } : s
        );
      }
    } else if (action.type === 'delete') {
      let targetId = action.target_id;
      if (!targetId && action.target_name) {
        const match = updatedScripts.find(s => s.scriptName.toLowerCase().includes(action.target_name!.toLowerCase()));
        if (match) targetId = match.id;
      }
      
      if (targetId) {
        updatedScripts = updatedScripts.filter(s => s.id !== targetId);
      }
    }

    onChange({
      ...project,
      regexScripts: updatedScripts,
      updatedAt: Date.now()
    });
  };

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
      const response = await regexBuilderChat(
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
        regexActions: response.actions
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

  return (
    <div className="flex h-full min-h-0 bg-[#04060f] overflow-hidden">
      {/* Left Pane: Regex list */}
      <div className="w-80 border-r border-white/[0.04] bg-slate-950/40 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-white/[0.04] flex justify-between items-center shrink-0">
          <h3 className="font-bold text-slate-300 text-xs tracking-wider uppercase">Regex Scripts ({project.regexScripts.length})</h3>
          <Button 
            variant={themeColor}
            size="sm" 
            className="p-2 rounded-xl click-bounce flex items-center justify-center" 
            onClick={handleCreateScript}
            title="Thêm Regex Script"
          >
            <Plus size={15} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          {project.regexScripts.length === 0 ? (
            <div className="glass-panel text-center text-slate-500 py-12 px-5 rounded-2xl text-xs leading-relaxed border-white/[0.03]">
              Chưa có Regex Script nào. Hãy nhấn nút + hoặc trò chuyện với Tawa ở panel bên phải để tạo tự động.
            </div>
          ) : (
            project.regexScripts.map((s) => {
              const isSelected = s.id === selectedScriptId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedScriptId(s.id);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl cursor-pointer click-bounce transition-all duration-300 border ${getGlowClass(isSelected)}`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span className="font-semibold text-slate-200 text-xs truncate max-w-[80%]">
                      {s.scriptName}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteScript(s.id);
                      }}
                      className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-white/[0.05] click-bounce transition-colors"
                      title="Xóa script"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  
                  <div className="font-mono text-[10px] text-slate-400 bg-black/30 px-2 py-1 rounded border border-white/[0.03] truncate mb-2.5">
                    /{s.findRegex}/
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.isactive ? (
                      <span className="px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-[9px] font-medium tracking-wide">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-[9px] font-medium tracking-wide">Off</span>
                    )}

                    {s.promptOnly && (
                      <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-400 text-[9px] font-medium tracking-wide">Prompt</span>
                    )}
                    
                    {s.markdownOnly && (
                      <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[9px] font-medium tracking-wide">UI/MD</span>
                    )}

                    {s.placement.length > 0 && (
                      <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-white/[0.02]">P:{JSON.stringify(s.placement)}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane: Editor & AI Chat */}
      <div className="flex-1 flex flex-col h-full bg-[#04060f]/60">
        {/* Tab Buttons */}
        <div className="flex border-b border-white/[0.04] bg-slate-950/20 px-6 shrink-0 justify-between items-center h-14">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
                activeTab === 'chat'
                  ? `border-${themeColor}-500 text-${themeColor}-400`
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Trò chuyện với Tawa Assistant
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-4 py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
                activeTab === 'edit'
                  ? `border-${themeColor}-500 text-${themeColor}-400`
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              disabled={!selectedScriptId}
            >
              Chỉnh sửa thủ công {selectedScript ? `"${selectedScript.scriptName}"` : ''}
            </button>
            <button
              onClick={() => {
                setActiveTab('debug');
                runRegexTest();
              }}
              className={`px-4 py-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition duration-200 click-bounce ${
                activeTab === 'debug'
                  ? `border-${themeColor}-500 text-${themeColor}-400`
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Thử nghiệm & Gỡ lỗi Regex
            </button>
          </div>
          
          <div className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-${themeColor}-500/10 border border-${themeColor}-500/20 text-${themeColor}-400`}>
            {project.type.replace('_', ' ').toUpperCase()} Mode
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-grow overflow-hidden relative">
          {activeTab === 'edit' && selectedScript ? (
            <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#04060f]/10">
              <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Script Basic Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tên Script</label>
                    <input
                      type="text"
                      value={selectedScript.scriptName}
                      onChange={(e) => handleUpdateScript('scriptName', e.target.value)}
                      className="w-full styled-input rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tìm kiếm (Find Regex)</label>
                    <input
                      type="text"
                      value={selectedScript.findRegex}
                      onChange={(e) => handleUpdateScript('findRegex', e.target.value)}
                      className="w-full styled-input rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Placement Options */}
                <div className="p-4.5 rounded-2xl glass-panel space-y-3.5 border-white/[0.04]">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Placements (Vị trí thực thi)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                    {[
                      { val: 0, label: '0: User Input (Trước)' },
                      { val: 1, label: '1: AI Output (Trước)' },
                      { val: 2, label: '2: Display / Render' },
                      { val: 3, label: '3: Prompt Insert' },
                      { val: 4, label: '4: System Prompt' }
                    ].map((pOpt) => {
                      const isSelected = selectedScript.placement.includes(pOpt.val);
                      return (
                        <button
                          key={pOpt.val}
                          onClick={() => handleTogglePlacement(pOpt.val)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs transition duration-200 click-bounce ${
                            isSelected
                              ? `bg-${themeColor}-600/10 border-${themeColor}-500/40 text-${themeColor}-300`
                              : 'bg-slate-900/40 border-white/[0.03] text-slate-400 hover:border-white/[0.08] hover:bg-slate-900/60'
                          }`}
                        >
                          {isSelected ? <CheckSquare size={14} className={`text-${themeColor}-400`} /> : <Square size={14} />}
                          <span className="text-[11px]">{pOpt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Flags/Toggles */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                  {[
                    { key: 'isactive', label: 'Kích hoạt', desc: 'Có chạy script này hay không' },
                    { key: 'markdownOnly', label: 'Markdown Only', desc: 'Chỉ định dạng giao diện hiển thị' },
                    { key: 'promptOnly', label: 'Prompt Only', desc: 'Chỉ định dạng tin nhắn gửi lên LLM' },
                    { key: 'runOnSource', label: 'Run On Source', desc: 'Chạy trực tiếp trên raw text' },
                    { key: 'runOnEdit', label: 'Run On Edit', desc: 'Chạy khi chỉnh sửa tin nhắn' },
                  ].map((flag) => {
                    const val = (selectedScript as any)[flag.key];
                    return (
                      <button
                        key={flag.key}
                        onClick={() => handleUpdateScript(flag.key as any, !val)}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition duration-200 click-bounce ${
                          val 
                            ? `bg-${themeColor}-600/10 border-${themeColor}-500/40` 
                            : 'bg-slate-900/40 border-white/[0.03] hover:border-white/[0.08]'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-bold text-slate-200">{flag.label}</span>
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center border transition ${
                            val ? `bg-${themeColor}-600 border-${themeColor}-400 text-white` : 'border-slate-700'
                          }`}>
                            {val && <Check size={11} />}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 leading-normal">{flag.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Min / Max depths + Substitute Regex */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      Min Depth 
                      <HelpCircle size={12} className="text-slate-500" title="Độ sâu tin nhắn tối thiểu để áp dụng regex" />
                    </label>
                    <input
                      type="number"
                      value={selectedScript.minDepth === null ? '' : selectedScript.minDepth}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                        handleUpdateScript('minDepth', val);
                      }}
                      className="w-full styled-input rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                      placeholder="Không giới hạn"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      Max Depth
                      <HelpCircle size={12} className="text-slate-500" title="Độ sâu tin nhắn tối đa để áp dụng regex" />
                    </label>
                    <input
                      type="number"
                      value={selectedScript.maxDepth === null ? '' : selectedScript.maxDepth}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                        handleUpdateScript('maxDepth', val);
                      }}
                      className="w-full styled-input rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
                      placeholder="Không giới hạn"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      Substitute Regex
                      <HelpCircle size={12} className="text-slate-500" title="0 = Không, 1 = Thay thế regex bằng output" />
                    </label>
                    <select
                      value={selectedScript.substituteRegex}
                      onChange={(e) => handleUpdateScript('substituteRegex', parseInt(e.target.value))}
                      className="w-full styled-input rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none appearance-none"
                    >
                      <option value={0}>0 - Không</option>
                      <option value={1}>1 - Thay thế regex</option>
                      <option value={2}>2 - Overlap</option>
                    </select>
                  </div>
                </div>

                {/* Code Editor for Replace String */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chuỗi thay thế (Replace String / HTML UI / Script)</label>
                  <CodeTextarea
                    value={selectedScript.replaceString}
                    onChange={(e) => handleUpdateScript('replaceString', e.target.value)}
                    className="h-[380px]"
                    placeholder="Nhập code HTML/JS hoặc chuỗi thay thế..."
                  />
                </div>

              </div>
            </div>
          ) : activeTab === 'chat' ? (
            /* AI Chat Interface */
            <div className="flex flex-col h-full bg-[#04060f]/20">
              {/* Messages viewport */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 max-w-lg mx-auto space-y-5">
                    <div className="relative">
                      <div className="w-18 h-18 rounded-full overflow-hidden ring-4 ring-indigo-500/20">
                        <img 
                          src="https://files.catbox.moe/xa7h6o.jpg" 
                          alt="Tawa" 
                          className="w-full h-full object-cover animate-pulse"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full border-2 border-[#04060f] flex items-center justify-center">
                        <Sparkles size={11} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-base mb-1">Hỗ Trợ Xây Dựng Regex AI</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Ta là <strong>Nữ Thần Tawa</strong>. Ta sẽ giúp ngươi dệt các Regex Script động để che giấu các tag MVU/Zod
                        hoặc xây dựng các giao diện HTML tương tác trực tiếp lên hộp chat SillyTavern.
                      </p>
                    </div>
                    <div className="glass-panel border-white/[0.04] bg-white/[0.01] p-4 rounded-2xl w-full text-[11px] text-left text-indigo-300 space-y-1.5">
                      <p className="font-semibold mb-1 text-slate-300">Gợi ý câu lệnh:</p>
                      <p>• "Tạo script ẩn tag &lt;UpdateVariable&gt; và keyword trigger"</p>
                      <p>• "Viết cho ta Regex script render giao diện HTML có nút bấm cộng điểm sức mạnh"</p>
                      <p>• "Hãy sửa script render UI thành giao diện 3 cột và thêm font Cinzel"</p>
                    </div>
                  </div>
                )}

                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden border ${
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

                    <div className={`max-w-[80%] space-y-2`}>
                      <div className={`rounded-2xl px-4 py-3 text-xs leading-relaxed border ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                          : msg.role === 'system'
                            ? 'bg-red-950/20 border-red-900/30 text-red-200'
                            : 'glass-panel border-white/[0.05] bg-white/[0.015] text-slate-200'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {/* Regex Actions list */}
                        {msg.regexActions && msg.regexActions.length > 0 && (
                          <div className="mt-3.5 pt-3.5 border-t border-white/[0.05] space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Tác vụ Regex thực thi:</span>
                            {msg.regexActions.map((act, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/[0.03] text-[10px]">
                                <span className={`font-bold px-2 py-0.5 rounded-lg font-mono text-[9px] tracking-wide ${
                                  act.type === 'create' ? 'bg-green-500/10 text-green-400 border border-green-500/15' :
                                  act.type === 'update' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15' : 
                                  'bg-red-500/10 text-red-400 border border-red-500/15'
                                }`}>
                                  {act.type.toUpperCase()}
                                </span>
                                <span className="text-slate-300 font-semibold truncate max-w-[200px]">
                                  {act.type === 'create' ? act.data?.scriptName : (act.target_name || act.target_id || 'Unnamed')}
                                </span>
                                {act.reason && (
                                  <span className="text-slate-500 italic truncate max-w-[150px] ml-auto">({act.reason})</span>
                                )}
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
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 animate-bounce">
                      <img src="https://files.catbox.moe/xa7h6o.jpg" alt="Tawa" className="w-full h-full object-cover" />
                    </div>
                    <div className="glass-panel border-white/[0.05] bg-white/[0.015] text-slate-300 rounded-2xl px-4 py-3 text-xs shadow-md">
                      {streamBuffer ? (
                        <div className="whitespace-pre-wrap font-mono text-[11px] text-purple-200">{streamBuffer}</div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 size={13} className="animate-spin text-purple-400" />
                          <span>Tawa đang dệt quy tắc thực tại...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} className="!mt-0" />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-white/[0.04] bg-[#04060f]/60 shrink-0">
                <div className="flex items-end gap-2.5 bg-slate-900/50 border border-white/[0.05] p-2 rounded-2xl max-w-3xl mx-auto focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all">
                  <textarea
                    ref={textareaRef}
                    placeholder="Yêu cầu Tawa tạo/sửa Regex... Ví dụ: 'Tạo Regex ẩn keyword trigger terra2026'"
                    className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-200 placeholder-slate-500 resize-none py-2 px-3 max-h-[120px] min-h-[38px] leading-relaxed outline-none"
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
                    className={`h-[36px] w-[36px] rounded-xl flex items-center justify-center shrink-0 transition click-bounce ${
                      !input.trim() || loading
                        ? 'bg-slate-800/40 text-slate-600'
                        : `bg-${themeColor}-600 hover:bg-${themeColor}-500 text-white shadow-lg shadow-${themeColor}-500/10`
                    }`}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'debug' ? (
            <div className="h-full flex flex-col min-h-0 bg-[#04060f]/30">
              {/* Debug controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-white/[0.04] bg-slate-950/40 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Select target script */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Script:</span>
                    <select
                      value={debugTargetScriptId}
                      onChange={(e) => setDebugTargetScriptId(e.target.value)}
                      className="styled-input rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none bg-slate-900 border border-white/[0.04]"
                    >
                      <option value="all_active">Tất cả đang hoạt động</option>
                      {project.regexScripts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.scriptName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select execution placement */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Placement:</span>
                    <select
                      value={debugPlacement}
                      onChange={(e) => setDebugPlacement(parseInt(e.target.value))}
                      className="styled-input rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none bg-slate-900 border border-white/[0.04]"
                    >
                      <option value={0}>0: User Input (Trước)</option>
                      <option value={1}>1: AI Output (Trước)</option>
                      <option value={2}>2: Display / Render</option>
                      <option value={3}>3: Prompt Insert</option>
                      <option value={4}>4: System Prompt</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* View mode toggle */}
                  <button
                    onClick={() => setDebugViewMode(debugViewMode === 'side-by-side' ? 'stacked' : 'side-by-side')}
                    className="p-2 rounded-xl border border-white/[0.04] bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition click-bounce"
                    title={debugViewMode === 'side-by-side' ? 'Chuyển sang dạng Xếp chồng' : 'Chuyển sang dạng Song song'}
                  >
                    <Split size={14} />
                  </button>

                  {/* Run test button */}
                  <Button
                    variant={themeColor}
                    size="sm"
                    className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl click-bounce font-medium text-xs shadow-lg"
                    onClick={runRegexTest}
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Chạy thử nghiệm</span>
                  </Button>
                </div>
              </div>

              {/* Main content split panel */}
              <div className={`flex-grow overflow-hidden flex ${debugViewMode === 'side-by-side' ? 'flex-row' : 'flex-col'} min-h-0`}>
                {/* Left Pane (Inputs) */}
                <div className={`flex flex-col min-h-0 border-white/[0.04] ${
                  debugViewMode === 'side-by-side' ? 'w-1/2 border-r h-full' : 'h-1/2 border-b w-full'
                } bg-slate-950/20`}>
                  
                  {/* Test Input Text */}
                  <div className="flex-1 flex flex-col min-h-0 p-4 border-b border-white/[0.04]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={12} className={`text-${themeColor}-400`} />
                        Văn bản thử nghiệm (Input Text)
                      </span>
                      <button
                        onClick={loadLastMessageFromSimulator}
                        className="text-[10px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition click-bounce"
                      >
                        <RefreshCw size={10} />
                        Lấy tin nhắn giả lập gần nhất
                      </button>
                    </div>
                    <textarea
                      value={debugInputText}
                      onChange={(e) => setDebugInputText(e.target.value)}
                      className="w-full flex-grow bg-slate-950/50 border border-white/[0.04] rounded-2xl p-4 font-mono text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/[0.08] resize-none overflow-y-auto custom-scrollbar"
                      placeholder="Dán hoặc viết văn bản chứa các tag MVU/Zod như <UpdateVariable> tại đây..."
                    />
                  </div>

                  {/* Simulator State JSON */}
                  <div className="flex-1 flex flex-col min-h-0 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Smartphone size={12} className={`text-${themeColor}-400`} />
                        Trạng thái giả lập (Mock State JSON)
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={loadStateFromSimulator}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition click-bounce"
                        >
                          <RefreshCw size={10} />
                          Đồng bộ từ giả lập
                        </button>
                        <button
                          onClick={() => {
                            const defaultState = buildInitialStateFromSchema(project);
                            setDebugStateJson(JSON.stringify(defaultState, null, 2));
                          }}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] transition click-bounce"
                          title="Reset về State mặc định sinh ra từ Zod Schema"
                        >
                          Reset Schema Zod
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={debugStateJson}
                      onChange={(e) => setDebugStateJson(e.target.value)}
                      className="w-full flex-grow bg-slate-950/50 border border-white/[0.04] rounded-2xl p-4 font-mono text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-white/[0.08] resize-none overflow-y-auto custom-scrollbar"
                      placeholder="State JSON của hệ thống..."
                    />
                  </div>
                </div>

                {/* Right Pane (Outputs) */}
                <div className={`flex flex-col min-h-0 ${
                  debugViewMode === 'side-by-side' ? 'w-1/2 h-full' : 'h-1/2 w-full'
                } bg-slate-950/10`}>
                  
                  {/* Outputs sub-tabs bar */}
                  <div className="flex border-b border-white/[0.04] bg-slate-950/40 px-4 shrink-0 justify-between items-center h-11">
                    <div className="flex gap-2">
                      {[
                        { id: 'preview', label: 'Giao diện (HTML Preview)' },
                        { id: 'diff', label: 'So sánh kết quả (Diff)' },
                        { id: 'trace', label: 'Nhật ký chạy (Trace Logs)' }
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setDebugOutputSubTab(sub.id as any)}
                          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 transition duration-200 click-bounce ${
                            debugOutputSubTab === sub.id
                              ? `border-${themeColor}-500 text-${themeColor}-400`
                              : 'border-transparent text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {debugError && (
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400 bg-red-950/20 border border-red-500/20 px-2 py-0.5 rounded-lg">
                        <AlertTriangle size={11} />
                        <span className="truncate max-w-[200px]">{debugError}</span>
                      </div>
                    )}
                  </div>

                  {/* Sub-tab content */}
                  <div className="flex-1 overflow-hidden relative p-4 flex flex-col min-h-0">
                    {debugOutputSubTab === 'preview' && (
                      <div className="w-full h-full flex flex-col min-h-0 bg-slate-900/40 border border-white/[0.04] rounded-2xl overflow-hidden relative">
                        {getHtmlUiFromText(debugResultText) ? (
                          <iframe
                            ref={debugIframeRef}
                            title="Regex Sandbox Preview"
                            className="w-full h-full border-none bg-white"
                            sandbox="allow-scripts"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs p-6 text-center space-y-2">
                            <EyeOff size={24} className="text-slate-600" />
                            <span>Văn bản kết quả không chứa mã HTML/CSS hợp lệ hoặc thẻ UI Panel.</span>
                            <span className="text-[10px] text-slate-600">Đảm bảo regex đã chạy thành công và trả về chuỗi HTML.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {debugOutputSubTab === 'diff' && (
                      <div className="w-full h-full flex flex-col md:flex-row gap-4 min-h-0">
                        {/* Original vs Modified */}
                        <div className="flex-1 flex flex-col min-h-0">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Văn bản ban đầu (Original)</span>
                          <div className="w-full flex-grow bg-slate-950/60 border border-white/[0.04] rounded-xl p-3 font-mono text-[10px] text-slate-400 overflow-auto whitespace-pre-wrap custom-scrollbar select-text">
                            {debugInputText}
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Văn bản sau xử lý (Modified)</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(debugResultText);
                                setCopiedDebug(true);
                                setTimeout(() => setCopiedDebug(false), 2000);
                              }}
                              className="text-[9px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-0.5 rounded border border-white/[0.03] bg-white/[0.01] transition click-bounce"
                            >
                              {copiedDebug ? (
                                <>
                                  <Check size={10} className="text-green-400" />
                                  <span className="text-green-400">Đã sao chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={10} />
                                  <span>Sao chép</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="w-full flex-grow bg-slate-950/60 border border-white/[0.04] rounded-xl p-3 font-mono text-[10px] text-slate-300 overflow-auto whitespace-pre-wrap custom-scrollbar select-text">
                            {debugResultText}
                          </div>
                        </div>
                      </div>
                    )}

                    {debugOutputSubTab === 'trace' && (
                      <div className="w-full h-full overflow-y-auto space-y-3.5 custom-scrollbar pr-1 select-text">
                        {debugTraceLogs.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-12 text-center space-y-2">
                            <AlertCircle size={20} className="text-slate-600" />
                            <span>Chưa chạy thử nghiệm nào. Bấm nút "Chạy thử nghiệm" ở trên để kiểm tra trace.</span>
                          </div>
                        ) : (
                          debugTraceLogs.map((log, idx) => (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-2xl border transition-all ${
                                log.error 
                                  ? 'bg-red-500/[0.02] border-red-500/20 text-red-300' 
                                  : log.matched 
                                    ? `bg-${themeColor}-500/[0.02] border-${themeColor}-500/25` 
                                    : 'bg-white/[0.01] border-white/[0.03]'
                              }`}
                            >
                              <div className="flex justify-between items-center gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-300">
                                    #{idx + 1}: {log.scriptName}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono">({log.scriptId})</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {log.error ? (
                                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-bold border border-red-500/20">Lỗi</span>
                                  ) : log.matched ? (
                                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[9px] font-bold border border-green-500/20">Khớp {log.matchCount} lần</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-500 text-[9px] font-bold border border-white/[0.02]">Không khớp</span>
                                  )}
                                </div>
                              </div>

                              {log.error && (
                                <div className="text-[10px] font-mono text-red-400 bg-red-950/20 p-2 rounded-lg border border-red-900/30 mb-2">
                                  {log.error}
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px] font-mono mb-2">
                                <div className="bg-black/30 p-1.5 rounded border border-white/[0.02] truncate">
                                  <span className="text-slate-500 mr-1">Find:</span>/{log.findRegex}/
                                </div>
                                <div className="bg-black/30 p-1.5 rounded border border-white/[0.02] truncate">
                                  <span className="text-slate-500 mr-1">Replace:</span>{log.replaceString || '""'}
                                </div>
                              </div>

                              {log.matched && (
                                <div className="mt-2.5 pt-2.5 border-t border-white/[0.04] space-y-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    <div>
                                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Trước</span>
                                      <div className="p-2 rounded bg-black/40 border border-white/[0.02] text-[10px] font-mono text-slate-400 max-h-[80px] overflow-y-auto whitespace-pre-wrap select-all">
                                        {log.before}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sau</span>
                                      <div className="p-2 rounded bg-black/40 border border-white/[0.02] text-[10px] font-mono text-slate-300 max-h-[80px] overflow-y-auto whitespace-pre-wrap select-all">
                                        {log.after}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
              Vui lòng chọn hoặc tạo một Regex Script từ danh sách bên trái.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
