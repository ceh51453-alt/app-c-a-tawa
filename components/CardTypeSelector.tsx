import React from 'react';
import { CardType } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Sparkles, Cpu, Layers, FileText } from 'lucide-react';

interface CardTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentType: CardType;
  onSelect: (type: CardType) => void;
}

export const CardTypeSelector: React.FC<CardTypeSelectorProps> = ({
  isOpen,
  onClose,
  currentType,
  onSelect,
}) => {
  const options = [
    {
      id: 'normal' as CardType,
      title: 'Thẻ Thường (Normal Card)',
      description: 'Chỉ bao gồm các trường thông tin nhân vật cơ bản và Lorebook. Không chứa kịch bản (scripts) hay hệ thống biến số phức tạp.',
      details: 'Phù hợp cho nhập vai truyền thống, lore-heavy nhưng không có UI tương tác.',
      icon: <FileText className="w-6 h-6 text-blue-400" />,
      badge: 'Cơ bản',
      badgeColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    },
    {
      id: 'mvu' as CardType,
      title: 'MVU (Multi-Variable Update)',
      description: 'Hỗ trợ thanh trạng thái UI (Dashboard) tương tác trực tiếp trong khung chat, đồng bộ biến trạng thái qua SillyTavern API.',
      details: 'Phù hợp cho game có các chỉ số đơn giản, tự động đồng bộ hóa trạng thái.',
      icon: <Layers className="w-6 h-6 text-purple-400" />,
      badge: 'Khuyên dùng',
      badgeColor: 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
    },
    {
      id: 'mvu_zod' as CardType,
      title: 'MVU Zod Schema',
      description: 'MVU kết hợp Schema Zod 4 để kiểm soát chặt chẽ kiểu dữ liệu (ép kiểu số tự động, thiết lập mặc định với .prefault()).',
      details: 'Tuyệt vời cho game RPG phức tạp cần AI tự cập nhật biến thông qua chỉ thị JSON Patch.',
      icon: <Sparkles className="w-6 h-6 text-indigo-400" />,
      badge: 'Nâng cao',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
    },
    {
      id: 'era' as CardType,
      title: 'ERA Card Architecture',
      description: 'Mô hình liên kết chặt chẽ giữa Lorebook, Regex và TavernHelper. Mỗi mục Lorebook đóng vai trò là một biến số trực tiếp.',
      details: 'Sử dụng getwi() / setwi() để đọc/ghi dữ liệu thời gian thực. Không dùng Zod hay biến MVU độc lập.',
      icon: <Cpu className="w-6 h-6 text-emerald-400" />,
      badge: 'Chuyên gia',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chọn Kiến Trúc Thẻ Nhân Vật"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Hãy chọn kiến trúc kỹ thuật phù hợp cho thẻ nhân vật của bạn. Việc chuyển đổi kiến trúc có thể tự động sinh các regex scripts và thiết lập hệ thống biến mặc định tương ứng.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt) => {
            const isSelected = opt.id === currentType;
            const getSelectedStyles = (id: typeof opt.id) => {
              switch (id) {
                case 'normal': return 'border-blue-500/40 bg-blue-500/5 glow-active-blue';
                case 'mvu': return 'border-pink-500/40 bg-pink-500/5 glow-active-pink';
                case 'mvu_zod': return 'border-indigo-500/40 bg-indigo-500/5 glow-active-indigo';
                case 'era': return 'border-emerald-500/40 bg-emerald-500/5 glow-active-emerald';
              }
            };
            return (
              <div
                key={opt.id}
                onClick={() => {
                  onSelect(opt.id);
                  onClose();
                }}
                className={`flex flex-col p-5 rounded-2xl border cursor-pointer transition-all duration-300 text-left relative group click-bounce ${
                  isSelected
                    ? getSelectedStyles(opt.id)
                    : 'border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-all ${isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-400 group-hover:bg-white/10'}`}>
                      {opt.icon}
                    </div>
                    <span className="font-bold text-slate-200 tracking-tight">{opt.title}</span>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${opt.badgeColor}`}>
                    {opt.badge}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-350 flex-grow mt-1.5 leading-relaxed font-medium">
                  {opt.description}
                </p>

                {/* Info block */}
                <div className="mt-3.5 pt-3 border-t border-white/5 text-[11px] text-slate-400 italic">
                  {opt.details}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Hủy bỏ
          </Button>
        </div>
      </div>
    </Modal>
  );
};
