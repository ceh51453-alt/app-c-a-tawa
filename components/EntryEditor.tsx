import React, { useState } from 'react';
import { LorebookEntry, OpenAISettings, ChatMessage, CardProject } from '../types';
import { Input, Textarea } from './ui/Input';
import { Button } from './ui/Button';
import { Wand2, BrainCircuit, Target, Key, Settings2, Eye, ShieldAlert, Layers, Check, MessageSquare, MessageSquareOff } from 'lucide-react';
import { TawaInlineChat } from './TawaInlineChat';
import { entryEditorChat } from '../services/openai';

interface EntryEditorProps {
  entry: LorebookEntry | null;
  onChange: (updatedEntry: LorebookEntry) => void;
  onOpenAI: () => void;
  project: CardProject;
  settings: OpenAISettings;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const EntryEditor: React.FC<EntryEditorProps> = ({ entry, onChange, onOpenAI, project, settings, chatMessages, setChatMessages }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'position' | 'keywords' | 'advanced'>('general');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStreamBuffer, setChatStreamBuffer] = useState('');
  const [showChat, setShowChat] = useState(true);

  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#04060f]/40 text-slate-500 p-8">
        <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-white/[0.03] animate-pulse">
           <Wand2 size={32} className="text-slate-600 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Chưa chọn mục nào</h3>
        <p className="text-center text-xs text-slate-500 max-w-sm leading-relaxed">
          Chọn một mục từ danh sách bên trái hoặc tạo mới. Hãy để AI giúp bạn thiết lập mọi thứ!
        </p>
      </div>
    );
  }

  const handleChange = (field: keyof LorebookEntry, value: any) => {
    onChange({ ...entry, [field]: value });
  };

  const handleArrayChange = (field: 'key' | 'secondary_keys', value: string) => {
    const array = value.split(',').map(s => s.trim()).filter(s => s !== '');
    onChange({ ...entry, [field]: array });
  };

  // Helper to determine active strategy for UI display
  const getStrategy = () => {
    if (entry.constant) return 'constant';
    if (entry.vectorized) return 'vectorized';
    return 'normal';
  };

  const setStrategy = (val: string) => {
    onChange({
      ...entry,
      constant: val === 'constant',
      selective: val === 'normal',
      vectorized: val === 'vectorized'
    });
  };

  // Chat handler
  const handleEntryChat = async (message: string) => {
    if (!entry || !settings.apiKey) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: !entry ? 'Vui lòng chọn một entry trước.' : 'Vui lòng nhập API Key.',
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
      const response = await entryEditorChat(
        message,
        entry,
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
        entryActions: response.actions
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      if (response.actions && response.actions.length > 0) {
        let updated = { ...entry };
        response.actions.forEach(action => {
          if (action.type === 'update_content' && action.content !== undefined) {
            updated.content = action.content;
          }
          if (action.type === 'update_keys') {
            if (action.comment !== undefined) updated.comment = action.comment;
            if (action.keys) updated.key = action.keys;
            if (action.secondary_keys) updated.secondary_keys = action.secondary_keys;
          }
          if (action.type === 'update_settings' && action.settings) {
            updated = { ...updated, ...action.settings };
          }
        });
        onChange(updated);
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
    <div className="flex-1 h-full flex overflow-hidden min-h-0">
    <div className="flex-1 h-full flex flex-col bg-[#04060f]/20">
      {/* Header */}
      <div className="p-6 border-b border-white/[0.04] bg-slate-950/20 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 mb-1.5 flex items-center gap-2">
              {entry.comment || "Chưa đặt tên"}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <span className="bg-black/30 px-2 py-0.5 rounded border border-white/[0.03]">UID: {entry.uid}</span>
              <span className="text-slate-700">|</span>
              <span className={`font-semibold ${entry.enabled ? "text-green-400" : "text-slate-500"}`}>
                {entry.enabled ? "Đang hoạt động" : "Đã tắt"}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
             <button
               onClick={() => setShowChat(!showChat)}
               className={`p-2 rounded-xl border transition-all click-bounce ${
                 showChat
                   ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                   : 'bg-slate-800/40 border-white/[0.05] text-slate-500 hover:text-slate-300'
               }`}
               title={showChat ? 'Ẩn Tawa AI Chat' : 'Hiện Tawa AI Chat'}
             >
               {showChat ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
             </button>
             <Button 
                variant="indigo" 
                onClick={onOpenAI}
                className="rounded-xl border border-indigo-500/30 text-indigo-300 px-4 py-2 click-bounce text-xs font-semibold"
                icon={<Wand2 size={14}/>}
              >
                Tawa Tự động hóa
              </Button>
             <button
                onClick={() => handleChange('enabled', !entry.enabled)}
                className={`px-4.5 py-2.5 rounded-xl font-bold text-xs click-bounce transition-all duration-300 border ${
                  entry.enabled 
                    ? 'bg-green-600/20 border-green-500/40 text-green-300 shadow-md shadow-green-500/5' 
                    : 'bg-slate-900 border-white/[0.04] text-slate-400 hover:border-white/[0.08]'
                }`}
             >
                {entry.enabled ? "Đang BẬT" : "Đang TẮT"}
             </button>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="flex gap-1.5 bg-black/45 p-1 rounded-xl border border-white/[0.03] w-fit">
          {[
            { id: 'general', icon: <Eye size={14}/>, label: 'Nội dung' },
            { id: 'position', icon: <Target size={14}/>, label: 'Vị trí & Order' },
            { id: 'keywords', icon: <Key size={14}/>, label: 'Từ khóa' },
            { id: 'advanced', icon: <Settings2 size={14}/>, label: 'Nâng cao' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition click-bounce ${
                activeTab === tab.id 
                  ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input 
                  label="Tên gợi nhớ (Comment)" 
                  placeholder="Ví dụ: Cốt lõi - Đùi & Tâm lý" 
                  value={entry.comment}
                  onChange={(e) => handleChange('comment', e.target.value)}
                />
                
                <div>
                   <label className="block text-[10px] font-bold text-slate-350 uppercase tracking-wider mb-2">Chiến lược (Strategy)</label>
                   <select 
                     className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 outline-none"
                     value={getStrategy()}
                     onChange={(e) => setStrategy(e.target.value)}
                   >
                     <option value="constant">Constant (Luôn luôn - Hằng số)</option>
                     <option value="normal">Normal (Kích hoạt bằng từ khóa)</option>
                     <option value="vectorized">Vectorized (Tìm kiếm ngữ nghĩa)</option>
                   </select>
                   <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                     {getStrategy() === 'constant' && "Luôn xuất hiện trong bộ nhớ, dùng cho sự thật hiển nhiên."}
                     {getStrategy() === 'normal' && "Chỉ xuất hiện khi tìm thấy Keyword. Tiết kiệm bộ nhớ nhất."}
                     {getStrategy() === 'vectorized' && "Dùng AI tìm ý nghĩa tương đồng, không cần đúng chính tả."}
                   </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-350 uppercase tracking-wider flex justify-between">
                  <span>Nội dung mục từ</span>
                  <span className="text-[9px] text-slate-500 font-normal tracking-wide">AI sẽ tự động viết phần này</span>
                </label>
                <textarea
                  className="w-full h-[380px] styled-input text-slate-100 rounded-2xl p-5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 font-mono leading-relaxed resize-none custom-scrollbar"
                  value={entry.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  placeholder="Nội dung entry sẽ hiển thị ở đây..."
                />
              </div>
            </div>
          )}

          {/* TAB: POSITION */}
          {activeTab === 'position' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
               <div className="glass-panel p-5.5 rounded-2xl border-white/[0.04] space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="text-indigo-400" size={14}/> Vị trí chèn (Position)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                       <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Vị trí cơ bản</label>
                       <select
                         className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 outline-none"
                         value={entry.position}
                         onChange={(e) => handleChange('position', e.target.value)}
                       >
                         <optgroup label="Nhân vật & Mẫu">
                           <option value="before_char">Before Character Defs (Trước định nghĩa NV)</option>
                           <option value="after_char">After Character Defs (Sau định nghĩa NV)</option>
                           <option value="before_em">Before Example Messages</option>
                           <option value="after_em">After Example Messages</option>
                         </optgroup>
                         <optgroup label="Ghi chú tác giả">
                           <option value="before_an">Before Author's Note</option>
                           <option value="after_an">After Author's Note</option>
                         </optgroup>
                         <optgroup label="Độ sâu (At Depth)">
                           <option value="at_depth_system">At Depth (System) - Luật bắt buộc</option>
                           <option value="at_depth_user">At Depth (User) - Giả lập user</option>
                           <option value="at_depth_assistant">At Depth (Assistant) - Giả lập AI</option>
                         </optgroup>
                       </select>
                    </div>

                    <div>
                       <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Khoảng cách (Depth)</label>
                       <div className="flex items-center gap-4">
                         <input
                           type="number"
                           className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 outline-none"
                           value={entry.scan_depth}
                           onChange={(e) => handleChange('scan_depth', parseInt(e.target.value) || 0)}
                         />
                         <div className="text-[10px] text-slate-500 leading-normal w-full">
                           0 = Ngay tin nhắn mới nhất.<br/>
                           4 = Kiến thức nền/Giác quan.
                         </div>
                       </div>
                    </div>
                  </div>
               </div>

               <div className="glass-panel p-5.5 rounded-2xl border-white/[0.04] space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="text-pink-400" size={14}/> Thứ tự ưu tiên (Order)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                     <div>
                       <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">Order</label>
                       <input
                         type="number"
                         className="w-full styled-input text-slate-150 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none"
                         value={entry.order}
                         onChange={(e) => handleChange('order', parseInt(e.target.value) || 0)}
                       />
                     </div>
                     <div className="text-[10px] text-slate-500 leading-relaxed space-y-1">
                        <p>Số càng cao càng được ưu tiên (ghi đè lên số thấp).</p>
                        <p><span className="text-indigo-400 font-semibold">100</span>: Cốt lõi.</p>
                        <p><span className="text-pink-400 font-semibold">101+</span>: Luật cấm/Quy tắc tuyệt đối.</p>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: KEYWORDS */}
          {activeTab === 'keywords' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
               <div className="glass-panel p-5.5 rounded-2xl border-white/[0.04] space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Nếu chọn Strategy là <span className="text-indigo-400 font-bold">Normal</span>, entry chỉ kích hoạt khi tìm thấy các từ khóa này.
                  </p>
                  <Input 
                    label="Từ khóa chính (Primary Keywords)" 
                    placeholder="Cô ấy, Nữ, Đùi, Bắp đùi, Tuyệt đối lĩnh vực..." 
                    value={entry.key.join(', ')}
                    onChange={(e) => handleArrayChange('key', e.target.value)}
                  />
                  
                  <Input 
                    label="Từ khóa phụ (Secondary Keys)" 
                    placeholder="Kích hoạt thêm..." 
                    value={entry.secondary_keys.join(', ')}
                    onChange={(e) => handleArrayChange('secondary_keys', e.target.value)}
                  />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Logic kết hợp</label>
                    <select
                      className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 outline-none"
                      value={entry.key_logic}
                      onChange={(e) => handleChange('key_logic', e.target.value)}
                    >
                      <option value="and_any">AND ANY (Chứa 1 trong các từ)</option>
                      <option value="and_all">AND ALL (Chứa tất cả các từ)</option>
                      <option value="not_any">NOT ANY (Không chứa từ nào)</option>
                      <option value="not_all">NOT ALL (Không chứa tất cả)</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col justify-center gap-3 pt-6">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="rounded-lg bg-slate-900 border-white/[0.08] text-indigo-600 focus:ring-indigo-500/30"
                        checked={entry.match_whole_words}
                        onChange={(e) => handleChange('match_whole_words', e.target.checked)}
                      />
                      <span className="text-xs text-slate-400">Match Whole Words (Bắt từ nguyên vẹn)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="rounded-lg bg-slate-900 border-white/[0.08] text-indigo-600 focus:ring-indigo-500/30"
                        checked={entry.case_sensitive}
                        onChange={(e) => handleChange('case_sensitive', e.target.checked)}
                      />
                      <span className="text-xs text-slate-400">Case Sensitive (Phân biệt hoa thường)</span>
                    </label>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: ADVANCED */}
          {activeTab === 'advanced' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Recursion Settings */}
                  <div className="glass-panel p-5 rounded-2xl border-white/[0.04] space-y-4">
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Đệ quy (Recursion)</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/[0.02] rounded-xl transition select-none">
                        <input 
                          type="checkbox" 
                          className="rounded-lg bg-slate-900 border-white/[0.08] text-indigo-600 focus:ring-indigo-500/30"
                          checked={entry.non_recursable}
                          onChange={(e) => handleChange('non_recursable', e.target.checked)}
                        />
                        <div>
                          <span className="block text-xs font-semibold text-slate-200">Non-recursable (Chặn đầu vào)</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">Không cho phép mục khác kích hoạt mục này.</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/[0.02] rounded-xl transition select-none">
                        <input 
                          type="checkbox" 
                          className="rounded-lg bg-slate-900 border-white/[0.08] text-indigo-600 focus:ring-indigo-500/30"
                          checked={entry.prevent_recursion}
                          onChange={(e) => handleChange('prevent_recursion', e.target.checked)}
                        />
                        <div>
                          <span className="block text-xs font-semibold text-slate-200">Prevent further recursion (Chặn đầu ra)</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">Sau khi kích hoạt mục này, dừng quét thêm.</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/[0.02] rounded-xl transition select-none">
                        <input 
                          type="checkbox" 
                          className="rounded-lg bg-slate-900 border-white/[0.08] text-indigo-600 focus:ring-indigo-500/30"
                          checked={entry.delay_until_recursion}
                          onChange={(e) => handleChange('delay_until_recursion', e.target.checked)}
                        />
                         <div>
                          <span className="block text-xs font-semibold text-slate-200">Delay until recursion</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">Chờ quét hết đệ quy mới chèn.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Budget & Probability */}
                  <div className="glass-panel p-5 rounded-2xl border-white/[0.04] space-y-4">
                    <h4 className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Hiệu năng & Tác động</h4>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/[0.02] rounded-xl transition select-none">
                        <input 
                          type="checkbox" 
                          className="rounded-lg bg-slate-900 border-white/[0.08] text-pink-600 focus:ring-pink-500/30"
                          checked={entry.ignore_budget}
                          onChange={(e) => handleChange('ignore_budget', e.target.checked)}
                        />
                         <div>
                          <span className="block text-xs font-semibold text-slate-200">Ignore Budget (Thẻ VIP)</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">Luôn chèn vào context kể cả khi hết ngân sách.</span>
                        </div>
                      </label>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sticky (Độ dính)</label>
                          <input
                            type="number"
                            className="w-full styled-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                            value={entry.sticky}
                            onChange={(e) => handleChange('sticky', parseInt(e.target.value) || 0)}
                          />
                        </div>
                         <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cooldown (Hồi chiêu)</label>
                          <input
                            type="number"
                            className="w-full styled-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                            value={entry.cooldown}
                            onChange={(e) => handleChange('cooldown', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                       <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Probability (Tỉ lệ %)</label>
                          <input
                            type="number"
                            className="w-full styled-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                            value={entry.probability}
                            onChange={(e) => handleChange('probability', parseInt(e.target.value) || 0)}
                          />
                        </div>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Tawa Chat Panel (Toggleable) */}
    {showChat && (
    <TawaInlineChat
      title="Tawa Entry Editor"
      subtitle={entry ? `Chỉnh sửa: ${entry.comment || 'Entry'}` : 'Chưa chọn entry'}
      chatMessages={chatMessages}
      setChatMessages={setChatMessages}
      loading={chatLoading}
      streamBuffer={chatStreamBuffer}
      onSendMessage={handleEntryChat}
      placeholderText="Nhờ Tawa chỉnh sửa nội dung entry..."
      emptyStateTitle="Tawa Entry Editor"
      emptyStateDescription="Chọn một entry từ danh sách bên trái rồi chat với Tawa để chỉnh sửa nội dung, từ khóa, hoặc cài đặt kỹ thuật."
      suggestions={[
        'Viết nội dung chi tiết cho entry này',
        'Tối ưu vị trí và order cho entry',
        'Thêm từ khóa phù hợp'
      ]}
      renderActionBadge={(msg) => {
        if (msg.entryActions && msg.entryActions.length > 0) {
          return (
            <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">Đã cập nhật:</span>
              {msg.entryActions.map((act, idx) => (
                <div key={idx} className="flex items-center gap-1.5 p-2 rounded-xl bg-black/40 border border-white/[0.03] text-[10px] text-green-400">
                  <Check size={12} />
                  <span>{act.type === 'update_content' ? 'Nội dung' : act.type === 'update_keys' ? 'Từ khóa' : 'Cài đặt'} đã cập nhật</span>
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