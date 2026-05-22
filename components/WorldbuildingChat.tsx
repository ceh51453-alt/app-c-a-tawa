import React, { useState, useRef, useEffect } from 'react';
import { CardProject, Lorebook, OpenAISettings, ChatMessage, WorldbuildingAction, WorldbuildingMode } from '../types';
import { worldbuildingChat } from '../services/openai';
import { Button } from './ui/Button';
import { 
  Send, Bot, User, Loader2, Sparkles, PlusCircle, Edit3, Trash2, 
  Image as ImageIcon, X, CornerDownLeft, Dna, Layers, MessageSquare, FileText,
  Settings, Code, RefreshCw, Cpu, Check
} from 'lucide-react';

interface WorldbuildingChatProps {
  project: CardProject;
  settings: OpenAISettings;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onApplyActions: (actions: WorldbuildingAction[]) => void;
}

export const WorldbuildingChat: React.FC<WorldbuildingChatProps> = ({
  project,
  settings,
  messages,
  setMessages,
  onApplyActions
}) => {
  const lorebook = project.lorebook;
  const mvuDictionary = project.charData.mvu_dictionary;
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<{name: string, content: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [mode, setMode] = useState<WorldbuildingMode>('genesis');
  const [activeDocument, setActiveDocument] = useState<{name: string, content: string} | null>(null);
  const [consecutiveEmptyContinuesState, setConsecutiveEmptyContinuesState] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamBuffer]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Handle file selection and convert to Base64 or Text
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      
      files.forEach(file => {
        if (file.type === 'text/plain') {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setSelectedDocument({ name: file.name, content: reader.result });
            }
          };
          reader.readAsText(file);
        } else {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setSelectedImages(prev => [...prev, reader.result as string]);
            }
          };
          reader.readAsDataURL(file);
        }
      });

      // Reset input value to allow selecting same file again if needed
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeDocument = () => {
    setSelectedDocument(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedImages.length === 0 && !selectedDocument) || loading) return;
    
    if (!settings.apiKey) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Vui lòng nhập API Key trong phần Cài đặt trước khi trò chuyện.',
        timestamp: Date.now(),
        isError: true
      }]);
      return;
    }

    let initialInput = input;
    if (selectedDocument) {
      initialInput += `\n\n[System: User attached document "${selectedDocument.name}". Total length: ${selectedDocument.content.length} characters. Use action {"type": "read_document", "chunk_index": 0} to read the first chunk of 15000 characters.]`;
      setActiveDocument(selectedDocument);
    }

    const initialImages = [...selectedImages];
    
    setInput('');
    setSelectedImages([]);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await processChat(initialInput, initialImages, selectedDocument);
    setSelectedDocument(null);
  };

  const MODIFYING_ACTIONS = [
    'create', 'update', 'delete', 'set_project_type', 
    'update_zod_schema', 'update_mvu_dictionary', 
    'update_ejs_template', 'update_character_data', 
    'create_regex', 'update_regex', 'delete_regex', 'seed_regex'
  ];

  const processChat = async (
    initialInput: string, 
    initialImages: string[], 
    attachedDoc: {name: string, content: string} | null,
    baseMessages?: ChatMessage[]
  ) => {
    setLoading(true);
    let currentMessages = baseMessages || [...messages];
    let currentProjectState = {
      ...project,
      lorebook: {
        ...project.lorebook,
        entries: [...project.lorebook.entries]
      }
    };
    
    let nextInput = initialInput;
    let nextImages = initialImages;
    let keepRunning = true;
    let localConsecutiveEmptyContinues = consecutiveEmptyContinuesState;

    while (keepRunning) {
      keepRunning = false;
      setStreamBuffer('');

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: nextInput,
        images: nextImages,
        timestamp: Date.now(),
        isHidden: nextInput.startsWith('Here is the data you requested:') || nextInput === "Please continue generating the next batch of entries."
      };

      currentMessages = [...currentMessages, userMsg];
      setMessages(currentMessages);

      try {
        const history = currentMessages.filter(m => m.role !== 'system');
        const historyToPass = history.slice(0, -1);

        const response = await worldbuildingChat(
          nextInput,
          nextImages,
          currentProjectState,
          settings,
          historyToPass,
          (partial) => setStreamBuffer(partial),
          settings.minTokens || 2000,
          mode
        );

        const isPlanningEnabled = settings.enablePlanning !== false;
        const hasModifyingActions = response.actions?.some(a => MODIFYING_ACTIONS.includes(a.type));

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: Date.now(),
          actions: response.actions,
          approvalStatus: (hasModifyingActions && isPlanningEnabled) ? 'pending' : undefined,
          aiStatus: response.status
        };

        currentMessages = [...currentMessages, assistantMsg];
        setMessages(currentMessages);
        
        if (hasModifyingActions && isPlanningEnabled) {
          setConsecutiveEmptyContinuesState(localConsecutiveEmptyContinues);
          keepRunning = false;
          break; // Stop loop, wait for user approval
        }

        if (response.actions && response.actions.length > 0) {
          console.log('[TAWA-CHAT-DEBUG] Calling onApplyActions with', response.actions.length, 'actions:', JSON.stringify(response.actions.map(a => ({type: a.type, comment: a.data?.comment || a.target_comment}))));
          onApplyActions(response.actions);
          
          if (!isPlanningEnabled && hasModifyingActions) {
            // Update local project state for the next iteration when planning is disabled
            for (const action of response.actions) {
              if (action.type === 'create' && action.data) {
                currentProjectState.lorebook.entries.push(action.data as any);
              } else if (action.type === 'update' && action.data) {
                const idx = currentProjectState.lorebook.entries.findIndex(e => e.comment.toLowerCase() === action.target_comment?.toLowerCase());
                if (idx !== -1) {
                  currentProjectState.lorebook.entries[idx] = { ...currentProjectState.lorebook.entries[idx], ...action.data };
                }
              } else if (action.type === 'delete') {
                currentProjectState.lorebook.entries = currentProjectState.lorebook.entries.filter(e => e.comment.toLowerCase() !== action.target_comment?.toLowerCase());
              } else if (action.type === 'set_project_type' && action.project_type) {
                currentProjectState.type = action.project_type;
              } else if (action.type === 'update_zod_schema' && action.zod_schema !== undefined) {
                currentProjectState.charData.zod_schema = action.zod_schema;
              } else if (action.type === 'update_mvu_dictionary' && action.mvu_dictionary !== undefined) {
                currentProjectState.charData.mvu_dictionary = action.mvu_dictionary;
              } else if (action.type === 'update_ejs_template' && action.ejs_template !== undefined) {
                currentProjectState.charData.ejs_template = action.ejs_template;
              } else if (action.type === 'update_character_data' && action.char_data) {
                currentProjectState.charData = { ...currentProjectState.charData, ...action.char_data };
              } else if (action.type === 'create_regex' && action.regex_data) {
                currentProjectState.regexScripts.push({
                  id: 'reg-' + Date.now() + Math.random().toString(36).substr(2, 5),
                  scriptName: action.regex_data.scriptName || 'New Regex',
                  findRegex: action.regex_data.findRegex || '',
                  replaceString: action.regex_data.replaceString || '',
                  trimStrings: action.regex_data.trimStrings || [],
                  minDepth: action.regex_data.minDepth || null,
                  maxDepth: action.regex_data.maxDepth || null,
                  runOnSource: action.regex_data.runOnSource || false,
                  promptOnly: action.regex_data.promptOnly || false,
                  isactive: action.regex_data.isactive !== undefined ? action.regex_data.isactive : true,
                  markdownOnly: action.regex_data.markdownOnly || false,
                  runOnEdit: action.regex_data.runOnEdit !== undefined ? action.regex_data.runOnEdit : true,
                  substituteRegex: action.regex_data.substituteRegex || 0,
                  placement: action.regex_data.placement || [2]
                });
              } else if (action.type === 'update_regex' && action.target_regex_id && action.regex_data) {
                currentProjectState.regexScripts = currentProjectState.regexScripts.map(s => 
                  s.id === action.target_regex_id ? { ...s, ...action.regex_data } : s
                );
              } else if (action.type === 'delete_regex' && action.target_regex_id) {
                currentProjectState.regexScripts = currentProjectState.regexScripts.filter(s => s.id !== action.target_regex_id);
              }
            }
          }
        }

        const fetchActions = response.actions?.filter(a => a.type === 'fetch_fandom_data') || [];
        const readDocActions = response.actions?.filter(a => a.type === 'read_document') || [];
        
        if (readDocActions.length > 0) {
          localConsecutiveEmptyContinues = 0;
          const action = readDocActions[0];
          const chunkIndex = action.chunk_index || 0;
          const chunkSize = 15000;
          const start = chunkIndex * chunkSize;
          const end = start + chunkSize;
          
          const docToUse = attachedDoc || activeDocument;
          if (!docToUse || start >= docToUse.content.length) {
            nextInput = `[System: END OF DOCUMENT. There are no more chunks to read. Please set status to DONE if you have finished generating entries.]`;
          } else {
            const chunk = docToUse.content.substring(start, end);
            nextInput = `[System: Document Chunk ${chunkIndex}]\n${chunk}\n\n[System: End of Chunk ${chunkIndex}. Generate entries for this chunk. If you need the next chunk, output action {"type": "read_document", "chunk_index": ${chunkIndex + 1}}.]`;
          }
          nextImages = [];
          keepRunning = true;
        } else if (fetchActions.length > 0) {
          localConsecutiveEmptyContinues = 0;
          setStreamBuffer('Đang tải dữ liệu từ Wiki...');
          let combinedData = '';
          const { fetchFandomData } = await import('../services/openai');
          for (const action of fetchActions) {
            if (action.url) {
              const data = await fetchFandomData(action.url);
              combinedData += `\n\n--- Data from ${action.url} ---\n${data}`;
            }
          }
          nextInput = `Here is the data you requested:\n${combinedData}\n\nPlease generate the Lorebook entries based on this data. Remember to use 'CONTINUE' status if you need to generate more batches.`;
          nextImages = [];
          keepRunning = true;
        } else if (response.status === 'CONTINUE') {
          if (!response.actions || response.actions.length === 0) {
            localConsecutiveEmptyContinues++;
          } else {
            localConsecutiveEmptyContinues = 0;
          }
          
          if (localConsecutiveEmptyContinues > 2) {
            console.warn("Too many empty CONTINUE responses. Stopping auto-generation.");
            keepRunning = false;
          } else {
            nextInput = "Please continue generating the next batch of entries.";
            nextImages = [];
            keepRunning = true;
          }
        }

      } catch (error: any) {
        currentMessages = [...currentMessages, {
          id: Date.now().toString(),
          role: 'system',
          content: `Lỗi kết nối Tawa: ${error.message}`,
          timestamp: Date.now(),
          isError: true
        }];
        setMessages(currentMessages);
        break;
      }
    }
    
    setConsecutiveEmptyContinuesState(localConsecutiveEmptyContinues);
    setLoading(false);
    setStreamBuffer('');
  };

  const handleApproveActions = async (messageId: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    const msg = messages[msgIndex];
    if (!msg.actions || msg.actions.length === 0) return;

    const updatedMessages = [...messages];
    updatedMessages[msgIndex] = {
      ...msg,
      approvalStatus: 'approved'
    };
    setMessages(updatedMessages);

    console.log('[TAWA-CHAT-DEBUG] Approving and applying actions:', msg.actions);
    onApplyActions(msg.actions);

    let currentProjectState = {
      ...project,
      lorebook: {
        ...project.lorebook,
        entries: [...project.lorebook.entries]
      }
    };
    
    for (const action of msg.actions) {
      if (action.type === 'create' && action.data) {
        currentProjectState.lorebook.entries.push(action.data as any);
      } else if (action.type === 'update' && action.data) {
        const idx = currentProjectState.lorebook.entries.findIndex(e => e.comment.toLowerCase() === action.target_comment?.toLowerCase());
        if (idx !== -1) {
          currentProjectState.lorebook.entries[idx] = { ...currentProjectState.lorebook.entries[idx], ...action.data };
        }
      } else if (action.type === 'delete') {
        currentProjectState.lorebook.entries = currentProjectState.lorebook.entries.filter(e => e.comment.toLowerCase() !== action.target_comment?.toLowerCase());
      } else if (action.type === 'set_project_type' && action.project_type) {
        currentProjectState.type = action.project_type;
      } else if (action.type === 'update_zod_schema' && action.zod_schema !== undefined) {
        currentProjectState.charData.zod_schema = action.zod_schema;
      } else if (action.type === 'update_mvu_dictionary' && action.mvu_dictionary !== undefined) {
        currentProjectState.charData.mvu_dictionary = action.mvu_dictionary;
      } else if (action.type === 'update_ejs_template' && action.ejs_template !== undefined) {
        currentProjectState.charData.ejs_template = action.ejs_template;
      } else if (action.type === 'update_character_data' && action.char_data) {
        currentProjectState.charData = { ...currentProjectState.charData, ...action.char_data };
      } else if (action.type === 'create_regex' && action.regex_data) {
        currentProjectState.regexScripts.push({
          id: 'reg-' + Date.now() + Math.random().toString(36).substr(2, 5),
          scriptName: action.regex_data.scriptName || 'New Regex',
          findRegex: action.regex_data.findRegex || '',
          replaceString: action.regex_data.replaceString || '',
          trimStrings: action.regex_data.trimStrings || [],
          minDepth: action.regex_data.minDepth || null,
          maxDepth: action.regex_data.maxDepth || null,
          runOnSource: action.regex_data.runOnSource || false,
          promptOnly: action.regex_data.promptOnly || false,
          isactive: action.regex_data.isactive !== undefined ? action.regex_data.isactive : true,
          markdownOnly: action.regex_data.markdownOnly || false,
          runOnEdit: action.regex_data.runOnEdit !== undefined ? action.regex_data.runOnEdit : true,
          substituteRegex: action.regex_data.substituteRegex || 0,
          placement: action.regex_data.placement || [2]
        });
      } else if (action.type === 'update_regex' && action.target_regex_id && action.regex_data) {
        currentProjectState.regexScripts = currentProjectState.regexScripts.map(s => 
          s.id === action.target_regex_id ? { ...s, ...action.regex_data } : s
        );
      } else if (action.type === 'delete_regex' && action.target_regex_id) {
        currentProjectState.regexScripts = currentProjectState.regexScripts.filter(s => s.id !== action.target_regex_id);
      }
    }

    const fetchActions = msg.actions.filter(a => a.type === 'fetch_fandom_data');
    const readDocActions = msg.actions.filter(a => a.type === 'read_document');
    const isContinue = msg.aiStatus === 'CONTINUE';

    let nextInput = '';
    let keepRunning = false;

    if (readDocActions.length > 0) {
      const action = readDocActions[0];
      const chunkIndex = action.chunk_index || 0;
      const chunkSize = 15000;
      const start = chunkIndex * chunkSize;
      const end = start + chunkSize;
      
      if (!activeDocument || start >= activeDocument.content.length) {
        nextInput = `[System: END OF DOCUMENT. There are no more chunks to read. Please set status to DONE if you have finished generating entries.]`;
      } else {
        const chunk = activeDocument.content.substring(start, end);
        nextInput = `[System: Document Chunk ${chunkIndex}]\n${chunk}\n\n[System: End of Chunk ${chunkIndex}. Generate entries for this chunk. If you need the next chunk, output action {"type": "read_document", "chunk_index": ${chunkIndex + 1}}.]`;
      }
      keepRunning = true;
    } else if (fetchActions.length > 0) {
      setLoading(true);
      setStreamBuffer('Đang tải dữ liệu từ Wiki...');
      try {
        let combinedData = '';
        const { fetchFandomData } = await import('../services/openai');
        for (const action of fetchActions) {
          if (action.url) {
            const data = await fetchFandomData(action.url);
            combinedData += `\n\n--- Data from ${action.url} ---\n${data}`;
          }
        }
        nextInput = `Here is the data you requested:\n${combinedData}\n\nPlease generate the Lorebook entries based on this data. Remember to use 'CONTINUE' status if you need to generate more batches.`;
        keepRunning = true;
      } catch (err: any) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Lỗi tải wiki: ${err.message}`,
          timestamp: Date.now(),
          isError: true
        }]);
        setLoading(false);
        setStreamBuffer('');
        return;
      }
    } else if (isContinue) {
      if (consecutiveEmptyContinuesState > 2) {
        console.warn("Too many empty CONTINUE responses. Stopping auto-generation.");
        keepRunning = false;
      } else {
        nextInput = "Please continue generating the next batch of entries.";
        keepRunning = true;
      }
    }

    if (keepRunning) {
      await processChat(nextInput, [], activeDocument, updatedMessages);
    }
  };

  const handleRejectActions = (messageId: string) => {
    const updatedMessages = messages.map(m => {
      if (m.id === messageId) {
        return { ...m, approvalStatus: 'rejected' as const };
      }
      return m;
    });
    setMessages(updatedMessages);
  };

  return (
    <div className="flex flex-col h-full bg-[#04060f]/40 border-l border-white/[0.04] w-full shadow-2xl relative">
      {/* Chat Header */}
      <div className="min-h-[4.5rem] bg-slate-950/40 backdrop-blur-xl border-b border-white/[0.04] flex flex-wrap items-center justify-between px-5 py-3 shrink-0 z-10 gap-4">
        <div className="flex items-center gap-3.5">
           {/* Tawa Avatar Header - Larger Size */}
           <div className="relative">
             <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/10">
               <img 
                 src="https://files.catbox.moe/xa7h6o.jpg" 
                 alt="Tawa" 
                 className="w-full h-full object-cover"
               />
             </div>
             <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#04060f] animate-pulse"></span>
           </div>
           <div>
             <h3 className="font-bold text-slate-100 text-sm">Tawa Worldbuilder</h3>
             <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium tracking-wide">
               CONNECTED TO REALITY
             </p>
           </div>
        </div>

        {/* Protocol Mode Switcher */}
        <div className="flex bg-black/45 p-1 rounded-xl border border-white/[0.03] shadow-inner overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
           <button
             onClick={() => setMode('genesis')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition duration-250 click-bounce whitespace-nowrap shrink-0 ${
                mode === 'genesis' 
                ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]' 
                : 'border border-transparent text-slate-500 hover:text-slate-300'
             }`}
             title="Chế độ Khởi Nguyên: Sử dụng Template chuẩn để tạo mới."
           >
             <Sparkles size={12} />
             Genesis
           </button>
           <button
             onClick={() => setMode('evolution')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition duration-250 click-bounce whitespace-nowrap shrink-0 ${
                mode === 'evolution' 
                ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                : 'border border-transparent text-slate-500 hover:text-slate-300'
             }`}
             title="Chế độ Tiến Hóa & Auto Wiki: Phân tích phong cách, tải dữ liệu từ Wiki/Fandom và tạo/sửa Lorebook."
           >
             <Dna size={12} />
             Evolution
           </button>
           <button
             onClick={() => setMode('document_extraction')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition duration-250 click-bounce whitespace-nowrap shrink-0 ${
                mode === 'document_extraction' 
                ? 'bg-amber-600/20 border border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                : 'border border-transparent text-slate-500 hover:text-slate-300'
             }`}
             title="Chế độ Đọc File: Tự động đọc file .txt dung lượng lớn và tạo Lorebook."
           >
             <FileText size={12} />
             Document
           </button>
           <button
             onClick={() => setMode('discussion')}
             className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition duration-250 click-bounce whitespace-nowrap shrink-0 ${
                mode === 'discussion' 
                ? 'bg-pink-600/20 border border-pink-500/30 text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.15)]' 
                : 'border border-transparent text-slate-500 hover:text-slate-300'
             }`}
             title="Chế độ Thảo luận: Chỉ trò chuyện, không tạo Entry."
           >
             <MessageSquare size={12} />
             Discussion
           </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-7 bg-[#04060f]/10">
        {messages.filter(msg => !msg.isHidden).map((msg) => (
          <div key={msg.id} className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar - Updated to Custom Images and Larger Size (w-12 h-12) */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden border shadow-inner ${
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

            {/* Bubble */}
            <div className="max-w-[80%] space-y-2">
              <div className={`rounded-2xl px-4 py-3 text-xs leading-relaxed border ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                  : msg.role === 'system'
                    ? 'bg-red-950/20 border-red-900/30 text-red-200'
                    : 'glass-panel border-white/[0.05] bg-white/[0.015] text-slate-200'
              }`}>
                {/* Images Display in History */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2.5">
                    {msg.images.map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        alt="Uploaded content" 
                        className="max-h-48 max-w-full rounded-xl border border-white/10 object-contain shadow-md"
                      />
                    ))}
                  </div>
                )}

                {/* Message Content */}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                
                {/* Actions Report Card */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3.5 pt-3.5 border-t border-white/[0.05] space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                        Kế hoạch thay đổi ({msg.actions.length} hành động):
                      </p>
                      {msg.approvalStatus === 'pending' && (
                        <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.08)]">
                          Chờ phê duyệt
                        </span>
                      )}
                      {msg.approvalStatus === 'approved' && (
                        <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.08)]">
                          Đã áp dụng
                        </span>
                      )}
                      {msg.approvalStatus === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/25 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.08)]">
                          Đã từ chối
                        </span>
                      )}
                    </div>
                     {msg.actions.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[10px] bg-black/40 p-2 rounded-xl border border-white/[0.03]">
                         {action.type === 'create' && <PlusCircle size={13} className="text-green-400 mt-0.5 shrink-0" />}
                         {action.type === 'update' && <Edit3 size={13} className="text-yellow-400 mt-0.5 shrink-0" />}
                         {action.type === 'delete' && <Trash2 size={13} className="text-red-400 mt-0.5 shrink-0" />}
                         {action.type === 'fetch_fandom_data' && <Layers size={13} className="text-blue-400 mt-0.5 shrink-0" />}
                         {action.type === 'read_document' && <FileText size={13} className="text-amber-400 mt-0.5 shrink-0" />}
                         {action.type === 'set_project_type' && <Settings size={13} className="text-pink-400 mt-0.5 shrink-0" />}
                         {action.type === 'update_zod_schema' && <Code size={13} className="text-indigo-400 mt-0.5 shrink-0" />}
                         {action.type === 'seed_regex' && <RefreshCw size={13} className="text-emerald-400 mt-0.5 shrink-0" />}
                         {action.type === 'update_character_data' && <Cpu size={13} className="text-purple-400 mt-0.5 shrink-0" />}
                         {action.type === 'update_mvu_dictionary' && <Layers size={13} className="text-cyan-400 mt-0.5 shrink-0" />}
                         {action.type === 'update_ejs_template' && <Code size={13} className="text-amber-400 mt-0.5 shrink-0" />}
                         {action.type === 'create_regex' && <RefreshCw size={13} className="text-teal-400 mt-0.5 shrink-0" />}
                         {action.type === 'update_regex' && <RefreshCw size={13} className="text-teal-400 mt-0.5 shrink-0" />}
                         {action.type === 'delete_regex' && <Trash2 size={13} className="text-red-400 mt-0.5 shrink-0" />}
                         
                         <div className="min-w-0 flex-1">
                           <span className={`font-mono font-bold text-[9px] tracking-wide ${
                             action.type === 'create' ? 'text-green-400' : 
                             action.type === 'update' ? 'text-yellow-400' : 
                             action.type === 'fetch_fandom_data' ? 'text-blue-400' : 
                             action.type === 'read_document' ? 'text-amber-400' : 
                             action.type === 'set_project_type' ? 'text-pink-400' :
                             action.type === 'update_zod_schema' ? 'text-indigo-400' :
                             action.type === 'seed_regex' ? 'text-emerald-400' :
                             action.type === 'update_character_data' ? 'text-purple-400' :
                             action.type === 'update_mvu_dictionary' ? 'text-cyan-400' :
                             action.type === 'update_ejs_template' ? 'text-amber-400' :
                             action.type === 'create_regex' ? 'text-teal-400' :
                             action.type === 'update_regex' ? 'text-teal-400' :
                             'text-red-400'
                           }`}>
                             {action.type.toUpperCase()}
                           </span>
                           <span className="text-slate-600 mx-1">:</span>
                           <span className="text-slate-300 font-medium break-all">
                             {action.type === 'fetch_fandom_data' ? action.url : 
                              action.type === 'read_document' ? `Đọc chunk ${action.chunk_index}` : 
                              action.type === 'set_project_type' ? action.project_type :
                              action.type === 'update_zod_schema' ? 'Thiết lập Zod Schema' :
                              action.type === 'seed_regex' ? 'Sinh Regex Tự động' :
                              action.type === 'update_character_data' ? 'Cập nhật cấu hình nhân vật' :
                              action.type === 'update_mvu_dictionary' ? 'Cập nhật từ điển biến số' :
                              action.type === 'update_ejs_template' ? 'Cập nhật EJS Template' :
                              action.type === 'create_regex' ? (action.regex_data?.scriptName || 'Tạo Regex mới') :
                              action.type === 'update_regex' ? (action.regex_data?.scriptName || 'Cập nhật Regex') :
                              action.type === 'delete_regex' ? 'Xóa Regex' :
                              (action.target_comment || action.data?.comment || "Hành động hệ thống")}
                           </span>
                           {action.reason && (
                             <p className="text-[9px] text-slate-500 mt-1 italic font-sans">
                               Lý do: {action.reason}
                             </p>
                           )}
                         </div>
                      </div>
                     ))}
                     
                     {msg.approvalStatus === 'pending' && (
                       <div className="flex gap-2 pt-2.5 border-t border-white/[0.03]">
                         <button
                           onClick={() => handleApproveActions(msg.id)}
                           className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 click-bounce"
                           disabled={loading}
                         >
                           <Check size={11} strokeWidth={2.5} />
                           Duyệt & Áp dụng
                         </button>
                         <button
                           onClick={() => handleRejectActions(msg.id)}
                           className="py-1.5 px-3 rounded-lg bg-slate-800/40 hover:bg-red-500/10 border border-white/[0.05] hover:border-red-500/20 text-slate-400 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 click-bounce"
                           disabled={loading}
                         >
                           <X size={11} strokeWidth={2.5} />
                           Từ chối
                         </button>
                       </div>
                     )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading / Streaming State */}
        {loading && (
          <div className="flex gap-3.5">
            {/* Loading Avatar - Tawa Image Bouncing */}
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 animate-bounce border border-indigo-500/30">
                 <img src="https://files.catbox.moe/xa7h6o.jpg" alt="Tawa" className="w-full h-full object-cover" />
            </div>
            <div className="max-w-[80%] glass-panel border-white/[0.05] bg-white/[0.015] text-slate-300 rounded-2xl px-4 py-2.5 text-xs shadow-md">
               {streamBuffer ? (
                 <div className="whitespace-pre-wrap font-mono text-[10px] text-purple-200">{streamBuffer}</div>
               ) : (
                 <div className="flex items-center gap-2">
                   <Loader2 size={13} className="animate-spin text-purple-400" />
                   <span>Tawa đang dệt lại hiện thực...</span>
                 </div>
               )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="!mt-0" />
      </div>

      {/* Refined Modern Input Area */}
      <div className="p-4 bg-[#04060f]/60 border-t border-white/[0.04] shrink-0">
        <div className="w-full mx-auto space-y-2">
          {/* Image Previews - Compact & Fix Overflow Clipping */}
          {(selectedImages.length > 0 || selectedDocument) && (
            <div className="flex gap-2.5 mb-1.5 overflow-x-auto pb-2.5 custom-scrollbar px-1 pt-1">
              {selectedDocument && (
                <div className="relative shrink-0 group animate-in fade-in zoom-in duration-200">
                  <div className="w-auto h-14 px-4.5 rounded-xl border border-amber-500/30 overflow-hidden shadow-lg bg-slate-900 flex items-center gap-2">
                     <FileText size={20} className="text-amber-400" />
                     <div className="flex flex-col">
                       <span className="text-[11px] font-bold text-slate-200 truncate max-w-[150px]">{selectedDocument.name}</span>
                       <span className="text-[9px] text-slate-500">{(selectedDocument.content.length / 1024).toFixed(1)} KB</span>
                     </div>
                  </div>
                  <button 
                    onClick={removeDocument}
                    className="absolute -top-1.5 -right-1.5 z-50 bg-slate-800 text-red-400 border border-slate-700 rounded-full p-1 shadow-md hover:bg-slate-700 hover:text-red-300 click-bounce transition-colors"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </div>
              )}
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative shrink-0 group animate-in fade-in zoom-in duration-200">
                  <div className="w-14 h-14 rounded-xl border border-white/[0.05] overflow-hidden shadow-lg bg-slate-900">
                     <img src={img} alt="Preview" className="w-full h-full object-cover opacity-90" />
                  </div>
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1.5 -right-1.5 z-50 bg-slate-800 text-red-400 border border-slate-700 rounded-full p-1 shadow-md hover:bg-slate-700 hover:text-red-300 click-bounce transition-colors"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Input Capsule - Glassmorphic & Compact */}
          <div className="relative flex items-end gap-2.5 bg-slate-900/50 border border-white/[0.05] p-2 rounded-2xl w-full mx-auto focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all">
            {/* File Input Trigger */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect} 
              accept="image/*,text/plain" 
              multiple 
            />
            
            <button 
              className="shrink-0 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:bg-white/[0.03] rounded-xl click-bounce transition-all duration-200 group relative mb-0.5"
              onClick={() => fileInputRef.current?.click()}
              title="Tải ảnh hoặc file .txt lên"
            >
              <ImageIcon size={18} className="relative z-10" />
            </button>

            {/* Transparent Textarea */}
            <textarea
              ref={textareaRef}
              placeholder={`Nhập ý tưởng... (${mode === 'genesis' ? 'Tạo Mới' : mode === 'evolution' ? 'Chỉnh Sửa & Wiki' : mode === 'document_extraction' ? 'Đọc File .txt' : 'Discussion'})`}
              className="w-full bg-transparent border-none focus:ring-0 text-slate-100 placeholder-slate-500 resize-none py-2 px-1 max-h-[160px] min-h-[38px] text-xs leading-relaxed outline-none"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading}
              rows={1}
            />

            {/* Send Button - Compact */}
            <button 
              className={`shrink-0 h-[36px] px-4.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-1.5 transition duration-200 click-bounce ${
                (!input.trim() && selectedImages.length === 0 && !selectedDocument) || loading
                  ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/10'
              }`}
              onClick={handleSend}
              disabled={(!input.trim() && selectedImages.length === 0 && !selectedDocument) || loading}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <Send size={13} />
                  <span>Gửi</span>
                </>
              )}
            </button>
          </div>

          <div className="flex justify-center items-center gap-3 text-[9px] text-slate-600 font-medium tracking-wide">
            <span className="flex items-center gap-1"><CornerDownLeft size={9} /> Enter để gửi</span>
            <span>•</span>
            <span className="flex items-center gap-1"><ImageIcon size={9} /> Shift+Enter xuống dòng</span>
          </div>
        </div>
      </div>
    </div>
  );
};
