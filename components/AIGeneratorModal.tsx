
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Textarea } from './ui/Input';
import { Button } from './ui/Button';
import { OpenAISettings, LorebookEntry } from '../types';
import { generateContent } from '../services/openai';
import { Sparkles, Wand2, BrainCircuit, Terminal, Ruler, Image as ImageIcon, X } from 'lucide-react';

interface AIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: OpenAISettings;
  onGenerate: (data: Partial<LorebookEntry>) => void;
}

export const AIGeneratorModal: React.FC<AIGeneratorModalProps> = ({
  isOpen,
  onClose,
  settings,
  onGenerate
}) => {
  const [prompt, setPrompt] = useState('');
  const [minTokens, setMinTokens] = useState(settings.minTokens || 2000); // Default minimum from settings
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setMinTokens(settings.minTokens || 2000);
    }
  }, [isOpen, settings.minTokens]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setSelectedImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file as Blob);
      });
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if ((!prompt.trim() && selectedImages.length === 0)) return;
    if (!settings.apiKey) {
      setError("Vui lòng cấu hình API Key trước (Nút bánh răng).");
      return;
    }

    setLoading(true);
    setError(null);
    setStreamingContent('');

    try {
      const entryData = await generateContent(
        prompt,
        selectedImages,
        settings, 
        minTokens, // Pass the minTokens constraint
        (partialText) => {
          if (settings.streaming) {
            setStreamingContent(partialText);
          }
        }
      );
      onGenerate(entryData);
      onClose();
      setPrompt(''); 
      setSelectedImages([]);
      setStreamingContent('');
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi tạo nội dung. Kiểm tra Console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tawa Assistant" size="lg">
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 p-5 rounded-xl flex items-start gap-4">
          <div className="bg-indigo-500/20 p-2 rounded-lg shrink-0">
             <BrainCircuit className="text-indigo-300" size={24} />
          </div>
          <div>
            <h4 className="font-semibold text-indigo-200 text-sm uppercase tracking-wide">Tự động hóa hoàn toàn (Có hỗ trợ Vision)</h4>
            <p className="text-sm text-indigo-100/80 mt-1 leading-relaxed">
              Nhập ý tưởng của bạn hoặc tải ảnh lên. AI sẽ tự động phân tích hình ảnh, viết nội dung và cấu hình thông số.
            </p>
          </div>
        </div>

        {!loading && (
          <>
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-2">
                  <Ruler size={16} className="text-pink-400" />
                  Độ dài tối thiểu (Target Tokens)
                </label>
                <span className="text-xs font-mono text-pink-300 bg-pink-500/10 px-2.5 py-1 rounded-full border border-pink-500/20">
                  {minTokens} tokens
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="2000" 
                  max="10000" 
                  step="100" 
                  value={minTokens}
                  onChange={(e) => setMinTokens(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
                <input 
                  type="number" 
                  min="2000"
                  value={minTokens}
                  onChange={(e) => setMinTokens(parseInt(e.target.value))}
                  className="w-24 styled-input text-slate-100 rounded-xl px-3 py-2 text-sm text-center focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                AI sẽ bị ép buộc viết cực kỳ chi tiết để đạt ít nhất con số này. <br/>
                <span className="text-orange-400">Lưu ý: Đặt càng cao, thời gian chờ càng lâu.</span>
              </p>
            </div>

            <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <label className="block text-sm font-medium text-slate-300">Mô tả hoặc Ảnh tham khảo</label>
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                 >
                    <ImageIcon size={14} /> Thêm ảnh
                 </button>
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                    accept="image/*" 
                    multiple 
                 />
               </div>

               {/* Image Previews */}
               {selectedImages.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative shrink-0 group w-20 h-20 rounded-lg border border-slate-700 overflow-hidden">
                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-0.5 right-0.5 bg-slate-900/80 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
               )}

               <Textarea
                 placeholder="Ví dụ: Một thanh kiếm cổ xưa bị nguyền rủa, tỏa ra ánh sáng màu tím nhạt. Nó khao khát linh hồn của kẻ địch..."
                 className="min-h-[120px] text-base"
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
               />
            </div>
          </>
        )}

        {loading && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
              <Terminal size={14} className="text-green-400" />
              AI Output Stream (Target: {minTokens}+ tokens)...
            </label>
            <div className="w-full min-h-[150px] bg-slate-950 border border-slate-700 rounded-md p-4 font-mono text-xs text-green-300 overflow-y-auto max-h-[300px] shadow-inner custom-scrollbar whitespace-pre-wrap">
              {streamingContent || <span className="animate-pulse">Waiting for server response...</span>}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-500/50 text-red-200 text-sm rounded-md flex items-center gap-2">
            <span className="block w-2 h-2 bg-red-500 rounded-full"></span>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Đóng</Button>
          <Button 
            variant="primary" 
            onClick={handleGenerate} 
            isLoading={loading}
            icon={<Wand2 size={16} />}
            disabled={(!prompt.trim() && selectedImages.length === 0) || loading}
          >
            {loading ? "Đang suy luận..." : "Khởi tạo Entry"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};