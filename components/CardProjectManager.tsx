import React, { useState } from 'react';
import { CardProject, CardType } from '../types';
import { Button } from './ui/Button';
import { CardTypeSelector } from './CardTypeSelector';
import { Upload, Download, Sparkles, Cpu, Layers, FileText, Calendar, Info, RefreshCw } from 'lucide-react';

interface CardProjectManagerProps {
  project: CardProject;
  onChange: (updatedProject: CardProject) => void;
  onImportV3: (jsonStr: string) => void;
  onImportLegacyLorebook: (jsonStr: string) => void;
  onExportV3: () => void;
  onSeedDefaultRegex: () => void;
  onSeedSystemEntries: () => void;
  onResetProject: () => void;
}

export const CardProjectManager: React.FC<CardProjectManagerProps> = ({
  project,
  onChange,
  onImportV3,
  onImportLegacyLorebook,
  onExportV3,
  onSeedDefaultRegex,
  onSeedSystemEntries,
  onResetProject,
}) => {
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...project,
      name: e.target.value,
      updatedAt: Date.now()
    });
  };

  const handleCharNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...project,
      charData: {
        ...project.charData,
        name: e.target.value
      },
      updatedAt: Date.now()
    });
  };

  const getCardTypeIcon = (type: CardType) => {
    switch (type) {
      case 'normal': return <FileText className="w-5 h-5 text-blue-400" />;
      case 'mvu': return <Layers className="w-5 h-5 text-purple-400" />;
      case 'mvu_zod': return <Sparkles className="w-5 h-5 text-indigo-400" />;
      case 'era': return <Cpu className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getCardTypeName = (type: CardType) => {
    switch (type) {
      case 'normal': return 'Thẻ Thường (Normal Card)';
      case 'mvu': return 'MVU (Multi-Variable Update)';
      case 'mvu_zod': return 'MVU Zod Schema';
      case 'era': return 'ERA Card Architecture';
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>, isV3: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (isV3) {
          onImportV3(text);
        } else {
          onImportLegacyLorebook(text);
        }
      } catch (err: any) {
        alert("Lỗi khi nhập tệp: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getGlowClass = (type: CardType) => {
    switch (type) {
      case 'normal': return 'glow-active-blue';
      case 'mvu': return 'glow-active-pink';
      case 'mvu_zod': return 'glow-active-indigo';
      case 'era': return 'glow-active-emerald';
    }
  };

  return (
    <div className="w-full h-full p-6 space-y-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Project Title and Type Indicator */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-5 p-6 rounded-2xl glass-panel ${getGlowClass(project.type)}`}>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              {project.name}
            </h2>
            <div className="flex items-center gap-2.5 text-xs text-slate-400 font-medium">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Khởi tạo: {new Date(project.createdAt).toLocaleDateString('vi-VN')}</span>
              <span className="text-slate-700">•</span>
              <span>Cập nhật: {new Date(project.updatedAt).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
              {getCardTypeIcon(project.type)}
              <span className="text-xs font-bold text-slate-200 tracking-wide">
                {getCardTypeName(project.type).toUpperCase()}
              </span>
            </div>
            <Button
              variant="indigo"
              size="sm"
              onClick={() => setIsTypeSelectorOpen(true)}
            >
              Đổi loại thẻ
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left panel: Info Form */}
          <div className="space-y-5 p-6 rounded-2xl glass-panel glass-panel-hover">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-3">Thông Tin Dự Án</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tên Dự Án</label>
                <input
                  type="text"
                  value={project.name}
                  onChange={handleNameChange}
                  className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none"
                  placeholder="Nhập tên dự án..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tên Nhân Vật (SillyTavern Name)</label>
                <input
                  type="text"
                  value={project.charData.name}
                  onChange={handleCharNameChange}
                  className="w-full styled-input rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none"
                  placeholder="Nhập tên nhân vật..."
                />
              </div>
            </div>

            {/* Hint Box based on Type */}
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-slate-350 leading-relaxed flex gap-3.5 mt-4">
              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                {project.type === 'normal' && (
                  <p>Mô hình <strong>Thẻ Thường</strong> chỉ lưu trữ lorebook và thông tin nhân vật cơ bản. Phù hợp cho việc nhập vai truyền thống, lore-heavy nhưng không có UI tương tác.</p>
                )}
                {project.type === 'mvu' && (
                  <p>Mô hình <strong>MVU</strong> kích hoạt hệ thống biến số SillyTavern. Bạn có thể xây dựng dashboard UI bằng Regex và cập nhật biến số qua AI. Hãy nhấn nút sinh regex/entries hệ thống ở bên phải.</p>
                )}
                {project.type === 'mvu_zod' && (
                  <p>Mô hình <strong>MVU Zod Schema</strong> sử dụng Schema Zod 4 để định dạng và ép kiểu biến số nghiêm ngặt, chống lỗi ném biệt lệ khi chơi. Zod Schema có thể được chỉnh sửa trực tiếp trong tab <strong>Nhân Vật</strong>.</p>
                )}
                {project.type === 'era' && (
                  <p>Mô hình <strong>ERA Card</strong> sử dụng trực tiếp các mục Lorebook làm biến số (đọc/ghi qua getwi/setwi). Liên kết sâu sắc với TavernHelper và Regex, không cần hệ thống Zod Schema.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Actions */}
          <div className="space-y-5 p-6 rounded-2xl glass-panel glass-panel-hover">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-3">Tác Vụ & Dữ Liệu</h3>

            <div className="space-y-4">
              {/* Import/Export Card V3 */}
              <div className="p-4.5 rounded-xl border border-white/5 bg-black/25 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-300 tracking-wide">SillyTavern Card V3 (.json)</h4>
                <div className="flex gap-2.5">
                  <label className="flex-1">
                    <span className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5 rounded-xl cursor-pointer transition-all duration-200 click-bounce">
                      <Upload className="w-4 h-4 text-indigo-400" /> Nhập Thẻ V3
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => handleFileImport(e, true)}
                      className="hidden"
                    />
                  </label>
                  <Button
                    variant="indigo"
                    size="sm"
                    className="flex-1 py-2.5 text-xs font-bold"
                    onClick={onExportV3}
                    icon={<Download className="w-4 h-4 text-white" />}
                  >
                    Xuất Thẻ V3
                  </Button>
                </div>
              </div>

              {/* Import Legacy Lorebook */}
              <div className="p-4.5 rounded-xl border border-white/5 bg-black/25 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 tracking-wide">Nhập Mục từ Cũ (.json)</h4>
                <label className="block w-full">
                  <span className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5 rounded-xl cursor-pointer transition-all duration-200 click-bounce">
                    <Upload className="w-4 h-4 text-indigo-400" /> Chọn File Mục từ (.json)
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => handleFileImport(e, false)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Seeding shortcuts for MVU / Zod / ERA */}
              {project.type !== 'normal' && (
                <div className="p-4.5 rounded-xl border border-white/5 bg-black/25 space-y-3.5">
                  <h4 className="text-xs font-bold text-indigo-400 tracking-wide">Thiết Lập Nhanh Cho {project.type.toUpperCase()}</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-[11px] font-bold py-2.5"
                      onClick={onSeedDefaultRegex}
                      icon={<RefreshCw className="w-3.5 h-3.5 text-indigo-400" />}
                    >
                      Sinh Regex Mẫu
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-[11px] font-bold py-2.5"
                      onClick={onSeedSystemEntries}
                      icon={<RefreshCw className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      Nạp Entries Mẫu
                    </Button>
                  </div>
                </div>
              )}

              {/* Dangerous Zone / Reset Project */}
              <div className="p-4.5 rounded-xl border border-red-500/10 bg-red-500/5 space-y-3">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Khu vực nguy hiểm</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Hành động này sẽ xóa sạch toàn bộ thông tin nhân vật, lorebook, regex và đưa thẻ về trạng thái trống. Hãy cẩn thận!
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full py-2.5 text-xs font-bold"
                  onClick={onResetProject}
                >
                  Xóa Thẻ / Reset Dự án
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CardTypeSelector
        isOpen={isTypeSelectorOpen}
        onClose={() => setIsTypeSelectorOpen(false)}
        currentType={project.type}
        onSelect={(type) => {
          onChange({
            ...project,
            type,
            updatedAt: Date.now()
          });
        }}
      />
    </div>
  );
};
