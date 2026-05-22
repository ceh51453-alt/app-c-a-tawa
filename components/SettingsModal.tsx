import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { OpenAISettings, AIModel } from '../types';
import { fetchModels } from '../services/openai';
import { RefreshCw, Save, Server, Sliders, Flame, Ruler, Search } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: OpenAISettings;
  onSave: (settings: OpenAISettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<OpenAISettings>(settings);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchModels = async () => {
    if (!formData.baseUrl || !formData.apiKey) {
      setError("Vui lòng nhập Proxy URL và API Key");
      return;
    }
    setLoadingModels(true);
    setError(null);
    try {
      const fetchedModels = await fetchModels(formData.baseUrl, formData.apiKey);
      setModels(fetchedModels);
      if (fetchedModels.length > 0 && !fetchedModels.find(m => m.id === formData.model)) {
         setFormData(prev => ({ ...prev, model: fetchedModels[0].id }));
      }
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách model");
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cấu hình AI Proxy & Tham số" size="lg">
      <div className="space-y-6">
        
        {/* Connection Settings */}
        <div className="space-y-4 pb-4 border-b border-slate-700">
          <h4 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Server size={14} /> Kết nối
          </h4>
          <Input 
            label="API Proxy URL (Base URL)" 
            placeholder="Ví dụ: https://api.openai.com/v1" 
            value={formData.baseUrl}
            onChange={(e) => setFormData({...formData, baseUrl: e.target.value})}
          />
          
          <Input 
            label="API Key" 
            type="password"
            placeholder="sk-..." 
            value={formData.apiKey}
            onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
          />

          <div className="flex items-end gap-2">
            <div className="flex-1">
               <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Model</label>
               <div className="relative">
                  <select 
                    className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer"
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                  >
                    {models.length === 0 && <option value={formData.model}>{formData.model || "Chưa tải model"}</option>}
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
                    <Server size={14} />
                  </div>
               </div>
            </div>
            <Button 
              variant="secondary" 
              onClick={handleFetchModels} 
              isLoading={loadingModels}
              icon={<RefreshCw size={16}/>}
              title="Tải danh sách model"
              className="h-[42px]"
            >
              Load
            </Button>
          </div>
        </div>

        {/* Generation Parameters */}
        <div className="space-y-4 pb-4 border-b border-slate-700/50">
           <h4 className="text-sm font-semibold text-pink-400 uppercase tracking-wider flex items-center gap-2">
            <Sliders size={14} /> Tham số tạo (Generation)
           </h4>
           
           {/* Target Tokens Enforcement */}
           <div className="bg-white/5 p-4 rounded-xl border border-white/5">
             <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-2">
                  <Ruler size={14} className="text-green-400" />
                  Target Tokens (Độ dài tối thiểu ép buộc)
                </label>
                <span className="text-xs font-mono text-green-300 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                  {formData.minTokens || 2000} tokens
                </span>
             </div>
             <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="500" 
                  max="10000" 
                  step="100" 
                  value={formData.minTokens || 2000}
                  onChange={(e) => setFormData({...formData, minTokens: parseInt(e.target.value)})}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <input 
                  type="number" 
                  min="500"
                  value={formData.minTokens || 2000}
                  onChange={(e) => setFormData({...formData, minTokens: parseInt(e.target.value)})}
                  className="w-24 styled-input text-slate-100 rounded-xl px-3 py-2 text-sm text-center focus:outline-none"
                />
             </div>
             <p className="text-[10px] text-slate-500 mt-2">
               Áp dụng cho cả Chat (Tawa Worldbuilder). AI sẽ cố gắng viết dài ít nhất chừng này.
             </p>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Context Size (tokens)</label>
                <input 
                  type="number" 
                  className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  value={formData.contextSize}
                  onChange={(e) => setFormData({...formData, contextSize: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Max Response Length (tokens)</label>
                <input 
                  type="number" 
                  className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({...formData, maxTokens: parseInt(e.target.value) || 0})}
                />
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Temperature ({formData.temperature})</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" min="0" max="2" step="0.05"
                    className="flex-1 accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    value={formData.temperature}
                    onChange={(e) => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                  />
                  <input 
                    type="number" step="0.05"
                    className="w-18 styled-input text-slate-100 rounded-xl px-2 py-1.5 text-xs text-center focus:outline-none"
                    value={formData.temperature}
                    onChange={(e) => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Top P ({formData.topP})</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" min="0" max="1" step="0.01"
                    className="flex-1 accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    value={formData.topP}
                    onChange={(e) => setFormData({...formData, topP: parseFloat(e.target.value)})}
                  />
                  <input 
                    type="number" step="0.01" max="1"
                    className="w-18 styled-input text-slate-100 rounded-xl px-2 py-1.5 text-xs text-center focus:outline-none"
                    value={formData.topP}
                    onChange={(e) => setFormData({...formData, topP: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Top K</label>
                <input 
                  type="number" 
                  className="w-full styled-input text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  value={formData.topK}
                  onChange={(e) => setFormData({...formData, topK: parseInt(e.target.value) || 0})}
                />
              </div>
              
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer px-4 py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors w-full z-10 click-bounce">
                    <input 
                      type="checkbox" 
                      className="rounded bg-slate-900 border-white/10 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={formData.streaming}
                      onChange={(e) => setFormData({...formData, streaming: e.target.checked})}
                    />
                    <div>
                      <span className="block text-xs font-bold text-slate-200 uppercase">Streaming</span>
                      <span className="block text-[10px] text-slate-400">Hiện phản hồi trực tiếp (Stream)</span>
                    </div>
                </label>
              </div>
           </div>
        </div>

        {/* Content Settings */}
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-red-500 uppercase tracking-wider flex items-center gap-2">
              <Flame size={14} /> Chế độ nội dung
            </h4>
            
            <div className="p-4 rounded-lg bg-blue-900/10 border border-blue-500/30 mb-4">
              <label className="flex items-start gap-4 cursor-pointer">
                  <div className="relative flex items-center mt-1">
                     <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={formData.enableSearch}
                        onChange={(e) => setFormData({...formData, enableSearch: e.target.checked})}
                     />
                     <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-blue-200 flex items-center gap-2"><Search size={14} /> Cho phép Google Search</span>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Khi bật, AI sẽ được cấp quyền sử dụng Google Search để tìm kiếm thông tin mới nhất trên Internet.
                    </p>
                  </div>
              </label>
            </div>

            <div className="p-4 rounded-lg bg-red-900/10 border border-red-500/30">
              <label className="flex items-start gap-4 cursor-pointer">
                  <div className="relative flex items-center mt-1">
                     <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={formData.nsfw}
                        onChange={(e) => setFormData({...formData, nsfw: e.target.checked})}
                     />
                     <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-red-200">NSFW Mode (Tawa Uncensored)</span>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Khi bật, Tawa sẽ được phép tạo mọi nội dung người lớn (R18, guro, bondage...) mà không có giới hạn hay bộ lọc đạo đức nào. 
                      <br/><span className="text-red-400 font-semibold">Cảnh báo: Nội dung tạo ra có thể không phù hợp với mọi lứa tuổi.</span>
                    </p>
                  </div>
              </label>
            </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-500/50 text-red-200 text-sm rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSave} icon={<Save size={16}/>}>Lưu cấu hình</Button>
        </div>
      </div>
    </Modal>
  );
};