import React from 'react';
import { Modal } from './ui/Modal';
import { BookOpen, Sparkles, Dna, Layers, MessageSquare, FileText, Settings, Languages, Download, Upload, Edit } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Giới thiệu & Hướng dẫn sử dụng" size="lg">
      <div className="space-y-6 text-slate-300 text-sm leading-relaxed max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
        
        {/* Giới thiệu */}
        <section className="space-y-2">
          <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
            <BookOpen size={20} />
            Giới thiệu Tawa Worldbuilder
          </h3>
          <p>
            <strong>Tawa Worldbuilder</strong> là một ứng dụng quản lý và tự động tạo Lorebook (Sổ tay thế giới/Nhân vật) thông minh, được thiết kế đặc biệt để tương thích 100% với <strong>SillyTavern</strong>. 
            Ứng dụng tích hợp trợ lý AI (Tawa) giúp bạn xây dựng thế giới, thiết kế nhân vật, và trích xuất dữ liệu từ các nguồn bên ngoài (Wiki, File TXT) một cách tự động, chi tiết và hoàn toàn không bịa đặt (hallucinate).
          </p>
        </section>

        <hr className="border-slate-700/50" />

        {/* Trợ lý AI Tawa */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
            <Sparkles size={20} />
            Trợ lý AI Tawa & Các chế độ
          </h3>
          <p>Tawa là linh hồn của ứng dụng, có khả năng tự động thêm, sửa, xóa các mục trong Lorebook. Tawa có 4 chế độ hoạt động chính:</p>
          
          <div className="grid gap-3">
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              <h4 className="font-bold text-indigo-300 flex items-center gap-2 mb-1">
                <Sparkles size={16} /> Genesis (Tạo Mới)
              </h4>
              <p>Sử dụng các template chuẩn (Character/World) để tạo ra các Entry mới cực kỳ chi tiết dựa trên ý tưởng ngắn gọn của bạn. Tawa sẽ tự động phân tích và điền đầy đủ các trường cần thiết.</p>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              <h4 className="font-bold text-emerald-300 flex items-center gap-2 mb-1">
                <Dna size={16} /> Evolution (Sửa / Auto Wiki)
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>Sửa đổi:</strong> AI phân tích văn phong hiện tại của Lorebook và viết tiếp/sửa đổi các Entry sao cho đồng nhất, tuyệt đối không xóa hay làm ngắn nội dung cũ.</li>
                <li><strong>Auto Wiki:</strong> Dán một đường link Fandom/Wiki (hoặc chỉ cần nhập tên tác phẩm). AI sẽ tự động cào dữ liệu và tạo <strong>TOÀN BỘ</strong> các Entry có trong link đó (nhân vật, địa điểm, vật phẩm...) một cách chuẩn xác với nguyên tác, chia thành nhiều đợt tạo tự động.</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              <h4 className="font-bold text-amber-300 flex items-center gap-2 mb-1">
                <FileText size={16} /> Document (Đọc File TXT)
              </h4>
              <p>Tải lên một file văn bản <code>.txt</code> (hỗ trợ file siêu lớn hàng triệu từ). AI sẽ tự động đọc file theo từng đoạn nhỏ và trích xuất toàn bộ thông tin để tạo Lorebook cho đến khi hết file.</p>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              <h4 className="font-bold text-pink-300 flex items-center gap-2 mb-1">
                <MessageSquare size={16} /> Discussion (Thảo Luận)
              </h4>
              <p>Trò chuyện, brainstorm ý tưởng với AI. Trong chế độ này, AI bị cấm chỉnh sửa Lorebook, giúp bạn thoải mái thử nghiệm ý tưởng mới.</p>
            </div>
          </div>
        </section>

        <hr className="border-slate-700/50" />

        {/* Tính năng khác */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
            <Layers size={20} />
            Các tính năng quản lý
          </h3>
          
          <ul className="space-y-3">
            <li className="flex gap-3">
              <div className="mt-0.5 text-slate-400"><Languages size={18} /></div>
              <div>
                <strong className="text-slate-200">Dịch thuật (Translation):</strong>
                <p>Nút dịch thuật trên thanh công cụ cho phép bạn dịch toàn bộ hoặc một phần Lorebook sang ngôn ngữ khác (ví dụ: Anh sang Việt) trong khi vẫn giữ nguyên cấu trúc JSON và các từ khóa (keys).</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="mt-0.5 text-slate-400"><Settings size={18} /></div>
              <div>
                <strong className="text-slate-200">Tùy chỉnh AI (Settings):</strong>
                <p>Cài đặt API Key, chọn Model, điều chỉnh Temperature, Max Tokens, và đặc biệt là <strong>Min Tokens</strong> (ép AI phải viết dài, chi tiết).</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="mt-0.5 text-slate-400"><Download size={18} /></div>
              <div>
                <strong className="text-slate-200">Import / Export:</strong>
                <p>Tải lên file <code>.json</code> Lorebook có sẵn từ SillyTavern để tiếp tục chỉnh sửa, hoặc xuất file <code>.json</code> sau khi hoàn thành để đưa vào SillyTavern.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="mt-0.5 text-slate-400"><Edit size={18} /></div>
              <div>
                <strong className="text-slate-200">Quản lý Entry thủ công:</strong>
                <p>Bạn có thể tự tay thêm, sửa, xóa các Entry. Tùy chỉnh sâu các thông số kỹ thuật như Keys, Insertion Order, Position, Strategy (Constant/Selective/Vectorized) để tối ưu hóa cho AI đọc.</p>
              </div>
            </li>
          </ul>
        </section>

      </div>
    </Modal>
  );
};
