import React from 'react';
import { LorebookEntry } from '../types';
import { Plus, Search, Book, FileText, Trash2, Copy, ToggleLeft, ToggleRight } from 'lucide-react';

interface LorebookListProps {
  entries: LorebookEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onDelete: (id: number) => void;
  onDuplicate: (entry: LorebookEntry) => void;
  onToggle: (uid: number) => void;
}

export const LorebookList: React.FC<LorebookListProps> = ({
  entries,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onToggle,
}) => {
  const [search, setSearch] = React.useState('');

  const filteredEntries = entries.filter(e => {
    const term = search.toLowerCase();
    const comment = e.comment.toLowerCase();
    const keys = e.key.join(', ').toLowerCase();
    return comment.includes(term) || keys.includes(term);
  });

  return (
    <div className="flex flex-col h-full bg-[#04060f]/40 border-r border-white/[0.04] w-80 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04] bg-slate-950/20 z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 tracking-wider uppercase">
            <Book className="text-indigo-400" size={16} />
            Mục lục
          </h2>
          <button 
            onClick={onAdd}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl click-bounce transition shadow-lg shadow-indigo-500/10 flex items-center justify-center"
            title="Thêm mục mới"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 text-slate-500" size={14} />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="w-full styled-input rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="glass-panel text-center text-slate-500 py-10 px-4 rounded-2xl text-xs border-white/[0.03]">
            Không tìm thấy mục nào.
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div 
              key={entry.uid}
              className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer click-bounce transition-all duration-350 border ${
                selectedId === entry.uid 
                  ? 'bg-indigo-600/10 border-indigo-500/40 shadow-md shadow-indigo-500/5' 
                  : 'bg-slate-900/20 border-white/[0.02] hover:bg-slate-800/40 hover:border-white/[0.08]'
              }`}
              onClick={() => onSelect(entry.uid)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Toggle Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(entry.uid); }}
                  className={`shrink-0 transition-all duration-300 rounded-full p-0.5 ${
                    entry.enabled 
                      ? 'text-indigo-400 hover:text-indigo-300' 
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title={entry.enabled ? 'Bật — Click để tắt' : 'Tắt — Click để bật'}
                >
                  {entry.enabled ? (
                    <ToggleRight size={20} className="drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                  ) : (
                    <ToggleLeft size={20} />
                  )}
                </button>
                <div className="truncate">
                  <div className={`font-semibold truncate text-xs ${
                    !entry.enabled ? 'text-slate-600 line-through' :
                    selectedId === entry.uid ? 'text-slate-200' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    {entry.comment || "Mục chưa đặt tên"}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                    {entry.key.length > 0 ? entry.key.join(', ') : '(Chưa có từ khóa)'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicate(entry); }}
                  className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-white/[0.05] rounded-lg click-bounce transition"
                  title="Nhân bản"
                >
                  <Copy size={13} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(entry.uid); }}
                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-white/[0.05] rounded-lg click-bounce transition"
                  title="Xóa"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 border-t border-white/[0.04] text-[10px] font-bold text-center text-slate-500 bg-slate-950/20 uppercase tracking-widest shrink-0">
        {filteredEntries.length} mục
      </div>
    </div>
  );
};