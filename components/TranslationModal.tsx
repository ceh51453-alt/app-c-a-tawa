
import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { OpenAISettings, LorebookEntry } from '../types';
import { translateEntry } from '../services/openai';
import { Languages, ArrowRight, ShieldAlert, Loader2, CheckCircle } from 'lucide-react';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LorebookEntry[];
  settings: OpenAISettings;
  onUpdateEntries: (updatedEntries: LorebookEntry[]) => void;
}

export const TranslationModal: React.FC<TranslationModalProps> = ({
  isOpen,
  onClose,
  entries,
  settings,
  onUpdateEntries
}) => {
  const [sourceLang, setSourceLang] = useState('English');
  const [targetLang, setTargetLang] = useState('Vietnamese');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEntryName, setCurrentEntryName] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const handleTranslate = async () => {
    if (entries.length === 0) return;
    
    setIsTranslating(true);
    setProgress(0);
    setLogs([]);
    
    const translatedEntries = [...entries];
    let successCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      setCurrentEntryName(entry.comment);
      
      try {
        setLogs(prev => [`Đang dịch: ${entry.comment}...`, ...prev]);
        const result = await translateEntry(entry, sourceLang, targetLang, settings);
        
        // Update local array
        translatedEntries[i] = {
          ...entry,
          ...result // Override comment, content, key
        };
        successCount++;
      } catch (error: any) {
        setLogs(prev => [`LỖI mục "${entry.comment}": ${error.message}`, ...prev]);
      }

      setProgress(Math.round(((i + 1) / entries.length) * 100));
    }

    setLogs(prev => [`Hoàn tất! Đã dịch thành công ${successCount}/${entries.length} mục.`, ...prev]);
    onUpdateEntries(translatedEntries);
    setIsTranslating(false);
    setCurrentEntryName('');
  };

  const commonLangs = ["English", "Vietnamese", "Chinese", "Japanese", "Korean", "Russian", "Spanish", "French"];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dịch thuật Lorebook (Toàn bộ)" size="lg">
      <div className="space-y-6">
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 p-5 rounded-xl flex items-start gap-4">
          <div className="bg-blue-500/20 p-2 rounded-lg shrink-0">
             <Languages className="text-blue-300" size={24} />
          </div>
          <div>
            <h4 className="font-semibold text-blue-200 text-sm uppercase tracking-wide">Trình biên dịch Lorebook</h4>
            <p className="text-sm text-blue-100/80 mt-1 leading-relaxed">
              Dịch toàn bộ nội dung (Tên, Nội dung, Từ khóa) sang ngôn ngữ đích.
              <br/>
              <span className="text-xs opacity-70">Lưu ý: Quá trình này sẽ chạy từng mục một để đảm bảo chất lượng cao nhất.</span>
            </p>
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Ngôn ngữ nguồn</label>
              <select 
                className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                disabled={isTranslating}
              >
                {commonLangs.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            
            <div className="pb-3.5 text-slate-500">
               <ArrowRight size={20} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Ngôn ngữ đích</label>
              <select 
                className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                disabled={isTranslating}
              >
                {commonLangs.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
        </div>

        {/* NSFW Warning Status */}
        {settings.nsfw && (
           <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3">
              <ShieldAlert className="text-red-500 shrink-0" size={20} />
              <div className="text-sm text-red-200">
                <span className="font-bold">CHẾ ĐỘ NSFW ĐANG BẬT:</span> AI sẽ sử dụng từ ngữ trần trụi, thô tục, trực diện (không nói giảm nói tránh) khi dịch sang ngôn ngữ đích.
              </div>
           </div>
        )}

        {/* Progress Section */}
        {isTranslating && (
          <div className="space-y-2 animate-in fade-in duration-300">
             <div className="flex justify-between text-sm text-slate-300">
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-indigo-400" />
                  Đang xử lý: <span className="text-white font-medium">{currentEntryName}</span>
                </span>
                <span>{progress}%</span>
             </div>
             <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                ></div>
             </div>
          </div>
        )}

        {/* Logs */}
        <div className="h-40 bg-slate-950 rounded-lg border border-slate-800 p-3 overflow-y-auto custom-scrollbar font-mono text-xs space-y-1">
           {logs.length === 0 && <span className="text-slate-600 italic">Nhật ký dịch thuật sẽ hiện ở đây...</span>}
           {logs.map((log, idx) => (
             <div key={idx} className={`truncate ${log.startsWith('LỖI') ? 'text-red-400' : 'text-slate-400'}`}>
               {log}
             </div>
           ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <Button variant="ghost" onClick={onClose} disabled={isTranslating}>Đóng</Button>
          <Button 
            variant="primary" 
            onClick={handleTranslate} 
            disabled={isTranslating}
            isLoading={isTranslating}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-none shadow-lg shadow-purple-500/20"
            icon={isTranslating ? undefined : <Languages size={16}/>}
          >
            {isTranslating ? 'Đang dịch...' : 'Bắt đầu Dịch toàn bộ'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
