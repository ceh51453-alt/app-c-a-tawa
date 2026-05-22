import React, { useState } from 'react';
import { CardProject, CharacterData, OpenAISettings, ChatMessage } from '../types';
import { CodeTextarea } from './ui/CodeTextarea';
import { User, MessageSquare, MessageSquareOff, Terminal, Eye, ShieldAlert, Sparkles, BookOpen, Download } from 'lucide-react';
import { exportZodSchemaAsLorebook } from '../services/cardExporter';
import { TawaInlineChat } from './TawaInlineChat';
import { characterEditorChat } from '../services/openai';
import { Check } from 'lucide-react';

interface CharacterEditorProps {
  project: CardProject;
  onChange: (updatedCharData: CharacterData) => void;
  settings: OpenAISettings;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const CharacterEditor: React.FC<CharacterEditorProps> = ({ project, onChange, settings, chatMessages, setChatMessages }) => {
  const [activeSubTab, setActiveSubTab] = useState<'basic' | 'prompts' | 'zod' | 'mvu_dict'>('basic');
  const [loading, setLoading] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [showChat, setShowChat] = useState(true);
  const charData = project.charData;

  const handleFieldChange = (field: keyof CharacterData, value: string) => {
    onChange({
      ...charData,
      [field]: value
    });
  };

  const handleExportZod = () => {
    try {
      const cardJson = exportZodSchemaAsLorebook(charData.zod_schema || '', charData.name || 'Zod');
      const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(cardJson);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${charData.name || "Character"}_Zod_Schema.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err: any) {
      alert("Lỗi xuất Zod Schema: " + err.message);
    }
  };

  const handleSendChat = async (message: string) => {
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

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamBuffer('');

    try {
      const response = await characterEditorChat(
        message,
        charData,
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
        charActions: response.actions
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      // Auto-apply actions
      if (response.actions && response.actions.length > 0) {
        let updated = { ...charData };
        response.actions.forEach(action => {
          if (action.type === 'update_field' && action.field) {
            (updated as any)[action.field] = action.value;
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
      setLoading(false);
      setStreamBuffer('');
    }
  };

  const subTabs = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: <User className="w-4 h-4" /> },
    { id: 'prompts', label: 'Prompts hệ thống', icon: <Terminal className="w-4 h-4" /> },
    { 
      id: 'zod', 
      label: 'Zod Schema', 
      icon: <Sparkles className="w-4 h-4" />, 
      visible: project.type === 'mvu_zod' 
    },
    { 
      id: 'mvu_dict', 
      label: 'Từ điển Biến số', 
      icon: <BookOpen className="w-4 h-4" />, 
      visible: project.type === 'mvu_zod' || project.type === 'mvu'
    }
  ];

  const visibleSubTabs = subTabs.filter(tab => tab.visible !== false);

  return (
    <div className="w-full h-full flex overflow-hidden min-h-0">
      {/* Sub Sidebar */}
      <div className="w-56 border-r border-white/5 bg-[#0b0f1e]/40 flex flex-col shrink-0">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mục Chỉnh Sửa</h3>
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
        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {visibleSubTabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-bold transition-all click-bounce ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500 shadow-[inset_3px_0_12px_rgba(99,102,241,0.06)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                }`}
              >
                {tab.icon}
                <span>{tab.label.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto">
          
          {/* TAB 1: BASIC INFO */}
          {activeSubTab === 'basic' && (
            <div className="space-y-6 glass-panel p-6 rounded-2xl">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-lg font-bold text-slate-200 tracking-tight">Thông Tin Nhân Vật Cơ Bản</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Các thông tin cơ bản định hình nhân vật trong khung chat SillyTavern.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tên nhân vật</label>
                  <input
                    type="text"
                    value={charData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none"
                    placeholder="Tên nhân vật (ví dụ: Rimuru Tempest)"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tính cách (Personality)</label>
                  <textarea
                    value={charData.personality}
                    onChange={(e) => handleFieldChange('personality', e.target.value)}
                    rows={3}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none font-sans custom-scrollbar"
                    placeholder="Mô tả tính cách cốt lõi, từ khóa đặc trưng..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Bối cảnh / Scenario</label>
                  <textarea
                    value={charData.scenario}
                    onChange={(e) => handleFieldChange('scenario', e.target.value)}
                    rows={3}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none custom-scrollbar"
                    placeholder="Bối cảnh ban đầu, tình huống bắt đầu cuộc trò chuyện..."
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tin nhắn đầu tiên (First Message)</label>
                    <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> CHỨA HTML SPLASH SCREEN
                    </span>
                  </div>
                  <textarea
                    value={charData.first_mes}
                    onChange={(e) => handleFieldChange('first_mes', e.target.value)}
                    rows={6}
                    className="w-full styled-input rounded-xl px-4 py-3 text-xs text-slate-350 focus:outline-none font-mono custom-scrollbar"
                    placeholder="Chào mừng bạn đến với thế giới của ta...&#10;&#10;[khởi tạo]&#10;<StatusPlaceHolderImpl/>"
                  />
                  <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed font-medium">
                    Đối với card MVU/Zod, bắt buộc phải chèn từ khóa <code>[khởi tạo]</code> và thẻ <code>&lt;StatusPlaceHolderImpl/&gt;</code> để kích hoạt màn hình chào mừng và Dashboard chỉ số.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ví dụ hội thoại (Conversation Examples)</label>
                  <textarea
                    value={charData.mes_example}
                    onChange={(e) => handleFieldChange('mes_example', e.target.value)}
                    rows={4}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none custom-scrollbar"
                    placeholder="<START>&#10;{{user}}: Chào Rimuru.&#10;{{char}}: Yo! Ta là Rimuru Tempest..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM PROMPTS & INSTRUCTIONS */}
          {activeSubTab === 'prompts' && (
            <div className="space-y-6 glass-panel p-6 rounded-2xl">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-lg font-bold text-slate-200 tracking-tight">System Prompts & Chỉ Thị</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Định hình sâu sắc cách mô hình ngôn ngữ phản hồi và cấu trúc output.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mô tả cốt lõi (Description / System Prompt chính)</label>
                  <textarea
                    value={charData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={6}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none custom-scrollbar"
                    placeholder="Quy tắc bắt buộc nhập vai, mô tả hình dáng, kỹ năng chi tiết của nhân vật..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">System Prompt Ghi Đè (System Prompt Override)</label>
                  <textarea
                    value={charData.system_prompt}
                    onChange={(e) => handleFieldChange('system_prompt', e.target.value)}
                    rows={3}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none custom-scrollbar"
                    placeholder="Ghi đè system prompt mặc định của SillyTavern nếu ứng dụng hỗ trợ..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Chỉ thị sau hội thoại (Post-History Instructions)</label>
                  <textarea
                    value={charData.post_history_instructions}
                    onChange={(e) => handleFieldChange('post_history_instructions', e.target.value)}
                    rows={3}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none custom-scrollbar"
                    placeholder="Chỉ thị chèn sau chat log (ví dụ: 'Hãy luôn chú ý đến HP của người chơi, nếu HP = 0 hãy viết cảnh kết thúc game...')"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ghi chú của tác giả (Creator Notes)</label>
                  <textarea
                    value={charData.creator_notes}
                    onChange={(e) => handleFieldChange('creator_notes', e.target.value)}
                    rows={3}
                    className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none custom-scrollbar"
                    placeholder="Ghi chú về bản quyền, hướng dẫn cách chơi hoặc ghi chú kỹ thuật..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ZOD SCHEMA (MVU ZOD ONLY) */}
          {activeSubTab === 'zod' && project.type === 'mvu_zod' && (
            <div className="space-y-6 glass-panel p-6 rounded-2xl">
              <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-200 tracking-tight">Zod Schema Variables</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Định nghĩa cấu trúc dữ liệu biến số trạng thái của card bằng thư viện Zod 4.</p>
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wider">
                  ZOD 4 ENGINE
                </span>
              </div>

              {/* Zod 4 Rules Warning */}
              <div className="p-5 rounded-2xl border border-amber-500/10 bg-amber-500/5 text-xs text-amber-300/90 leading-relaxed flex gap-4 backdrop-blur-sm">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <span className="font-bold text-slate-100 block">Quy tắc Zod 4 Sống Còn:</span>
                  <ul className="list-disc pl-4 space-y-1.5 font-medium">
                    <li>Dùng <code className="text-amber-200 font-semibold bg-amber-950/40 px-1 py-0.5 rounded">z.coerce.number()</code> thay cho <code>z.number()</code> để ép kiểu số tự động.</li>
                    <li>Mọi trường (kể cả object và array con) <strong>bắt buộc</strong> phải gán <code className="text-amber-200 font-semibold bg-amber-950/40 px-1 py-0.5 rounded">.prefault(value)</code> thay cho <code>.default()</code> để tránh crash runtime.</li>
                    <li>Giới hạn giá trị bằng <code className="text-amber-200 font-semibold bg-amber-950/40 px-1 py-0.5 rounded">.transform(v =&gt; Math.max(v, 0))</code> thay vì <code>.min()/.max()</code>.</li>
                    <li>CDN import chuẩn <code>registerMvuSchema</code> được nạp tự động, không import lại <code>z</code> hay <code>lodash</code>.</li>
                  </ul>
                </div>
              </div>

              {/* Code Editor */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Zod Schema Script (Javascript)</label>
                  <button 
                    onClick={handleExportZod}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[11px] font-bold transition-colors border border-indigo-500/20 hover:border-indigo-500/30"
                    title="Lưu thành một bộ từ điển (Lorebook/World Info) riêng để dùng cho các thẻ khác"
                  >
                    <Download className="w-3 h-3" /> Xuất thành Bộ từ điển
                  </button>
                </div>
                <CodeTextarea
                  value={charData.zod_schema || ''}
                  onChange={(e) => handleFieldChange('zod_schema', e.target.value)}
                  className="h-[500px]"
                />
              </div>
            </div>
          )}

          {/* TAB 4: MVU DICTIONARY */}
          {activeSubTab === 'mvu_dict' && (project.type === 'mvu_zod' || project.type === 'mvu') && (
            <div className="space-y-6 glass-panel p-6 rounded-2xl">
              <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-200 tracking-tight">Từ điển Biến số (Global Dictionary)</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Bảng giải nghĩa chi tiết các biến. AI sẽ đọc bảng này mỗi khi thiết lập quy tắc hoặc mở rộng cốt truyện, độc lập với thẻ xuất ra.</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nội dung Từ điển</label>
                <textarea
                  value={charData.mvu_dictionary || ''}
                  onChange={(e) => handleFieldChange('mvu_dictionary', e.target.value)}
                  rows={25}
                  className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none custom-scrollbar"
                  placeholder="Ví dụ: \n- Vàng: Đơn vị tiền tệ chính\n- HP: Sinh lực, tối đa 100..."
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Tawa Chat Panel (Toggleable) */}
      {showChat && (
      <TawaInlineChat
        title="Tawa Character Editor"
        subtitle="Chỉnh sửa nhân vật"
        chatMessages={chatMessages}
        setChatMessages={setChatMessages}
        loading={loading}
        streamBuffer={streamBuffer}
        onSendMessage={handleSendChat}
        placeholderText="Nhờ Tawa chỉnh sửa thông tin nhân vật..."
        emptyStateTitle="Tawa Character Editor"
        emptyStateDescription="Hãy mô tả những gì bạn muốn thay đổi trên nhân vật. Tawa sẽ trực tiếp chỉnh sửa các trường dữ liệu cho bạn."
        suggestions={[
          'Viết description chi tiết cho nhân vật này',
          'Thêm tính cách phức tạp hơn',
          'Viết first message với splash screen HTML',
          'Thêm system prompt hướng dẫn AI nhập vai'
        ]}
        renderActionBadge={(msg) => {
          if (msg.charActions && msg.charActions.length > 0) {
            return (
              <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">Đã cập nhật:</span>
                {msg.charActions.map((act, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 p-2 rounded-xl bg-black/40 border border-white/[0.03] text-[10px] text-green-400">
                    <Check size={12} />
                    <span>Trường "{act.field}" đã được cập nhật</span>
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