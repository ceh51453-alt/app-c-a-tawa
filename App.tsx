import React, { useState, useEffect } from 'react';
import { 
  CardProject, CardType, CharacterData, RegexScript, 
  Lorebook, LorebookEntry, OpenAISettings, WorldbuildingAction, ChatMessage 
} from './types';
import { CardProjectManager } from './components/CardProjectManager';
import { CharacterEditor } from './components/CharacterEditor';
import { RegexBuilder } from './components/RegexBuilder';
import { EJSEditor } from './components/EJSEditor';
import { CardPreview } from './components/CardPreview';
import { TabBar } from './components/ui/TabBar';
import { LorebookList } from './components/LorebookList';
import { EntryEditor } from './components/EntryEditor';
import { SettingsModal } from './components/SettingsModal';
import { GuideModal } from './components/GuideModal';
import { AIGeneratorModal } from './components/AIGeneratorModal';
import { TranslationModal } from './components/TranslationModal';
import { WorldbuildingChat } from './components/WorldbuildingChat';
import { VariableDictionary } from './components/VariableDictionary';
import { Button } from './components/ui/Button';
import { Modal } from './components/ui/Modal';
import { exportCardV3, importCardV3, importLegacyLorebook } from './services/cardExporter';
import { 
  Download, Upload, Settings, BookOpen, MessageSquare, Edit, 
  Languages, HelpCircle, Cpu, Layers, Eye, Code, Sparkles, RefreshCw
} from 'lucide-react';

const DEFAULT_SETTINGS: OpenAISettings = {
  baseUrl: 'https://goldenglow.webn.cc/',
  apiKey: '',
  model: 'gemini-3.1-pro-preview-search',
  contextSize: 2000000,
  maxTokens: 65530,
  temperature: 1.0,
  topK: 500,
  topP: 0.90,
  streaming: true,
  nsfw: false,
  enableSearch: true,
  minTokens: 4000,
};

const DEFAULT_PROJECT: CardProject = {
  id: 'default-proj',
  name: 'Dự án Card Slime Chuyển Sinh',
  type: 'normal',
  charData: {
    name: 'Rimuru Tempest',
    first_mes: 'Yo! Ta là Rimuru Tempest. Rất vui được gặp bạn! [khởi tạo]\n<StatusPlaceHolderImpl/>',
    description: 'Rimuru Tempest là thủ lĩnh tối cao của Liên minh Jura Tempest, nguyên là một nhân viên văn phòng chuyển sinh thành Slime mang kỹ năng Đại Hiền Giả và Bạo Thực Vương.',
    personality: 'Ôn hòa, thân thiện, quan tâm đến đồng minh nhưng cực kỳ quyết đoán trước kẻ thù.',
    scenario: 'Rimuru đang tiếp đón sứ giả các nước tại lâu đài thủ phủ Tempest.',
    mes_example: '<START>\n{{user}}: Chào Rimuru.\n{{char}}: Chào bạn! Cần giúp gì nè?',
    creator_notes: 'Thẻ được tạo bằng Tawa Character Card Creator Studio.',
    system_prompt: '',
    post_history_instructions: '',
    zod_schema: `// MVU Zod Schema v4
const schema = z.object({
  stat_data: z.object({
    'Nhân vật': z.object({
      HP: z.coerce.number().prefault(100).transform(v => Math.max(0, v)),
      MaxHP: z.coerce.number().prefault(100),
      'Cấp độ': z.coerce.number().prefault(1),
      'Sức mạnh': z.coerce.number().prefault(10),
      'Kinh nghiệm': z.coerce.number().prefault(0),
      'Độ hảo cảm': z.coerce.number().prefault(50)
    }).prefault({})
  }).prefault({})
});

registerMvuSchema(schema);`,
    ejs_template: `<%_ /* EJS Template mẫu */ _%>
[THÔNG TIN TRẠNG THÁI]
Tên nhân vật: <%= name %>
Bối cảnh: <%= scenario %>
<%_ if (getvar('stat_data.Nhân vật.Cấp độ') > 5) { _%>
Trạng thái: Rimuru đã tiến hóa thành Ma Vương mạnh mẽ.
<%_ } else { _%>
Trạng thái: Rimuru hiện tại vẫn là một Slime thường ôn hòa.
<%_ } _%>
`
  },
  lorebook: {
    name: 'Jura Tempest Worldbook',
    description: 'Bản đồ, địa danh và chủng tộc Jura Tempest',
    entries: []
  },
  regexScripts: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const App: React.FC = () => {
  // --- Persistent Card Project State ---
  const [project, setProject] = useState<CardProject>(() => {
    const saved = localStorage.getItem('sillyLore_project');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Lỗi parse project:", e);
      }
    }
    return DEFAULT_PROJECT;
  });

  // --- OpenAI / Gemini Settings ---
  const [settings, setSettings] = useState<OpenAISettings>(() => {
    const saved = localStorage.getItem('sillyLore_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...parsed };
  });

  // --- Persistent Chat Histories ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sillyLore_chat_messages');
    return saved ? JSON.parse(saved) : [
      {
        id: 'intro',
        role: 'assistant',
        content: 'Chào mừng ngươi đến với Cõi Tạo Thẻ. Ta là Tawa, người nắm giữ chìa khóa định hình thực tại của các nhân vật SillyTavern. Hãy đưa cho ta ý tưởng lorebook, bối cảnh thế giới của ngươi, ta sẽ dệt nên cấu trúc của nó!',
        timestamp: Date.now()
      }
    ];
  });

  const [regexMessages, setRegexMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sillyLore_regex_messages');
    return saved ? JSON.parse(saved) : [
      {
        id: 'intro',
        role: 'assistant',
        content: 'Xin chào! Ta là Tawa Regex Helper. Ta sẽ giúp ngươi dệt các Regex script và giao diện HTML động cho thẻ của ngươi.',
        timestamp: Date.now()
      }
    ];
  });

  const [ejsMessages, setEjsMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sillyLore_ejs_messages');
    return saved ? JSON.parse(saved) : [
      {
        id: 'intro',
        role: 'assistant',
        content: 'Hế lô! Ta là Tawa EJS Helper. Hãy cùng ta xây dựng EJS template cho prompt nhân vật và worldbook.',
        timestamp: Date.now()
      }
    ];
  });

  const [charMessages, setCharMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sillyLore_char_messages');
    return saved ? JSON.parse(saved) : [];
  });

  const [dictMessages, setDictMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sillyLore_dict_messages');
    return saved ? JSON.parse(saved) : [];
  });

  const [entryMessages, setEntryMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sillyLore_entry_messages');
    return saved ? JSON.parse(saved) : [];
  });

  // --- UI Views & Selected Lorebook Entries ---
  const [activeView, setActiveView] = useState<string>('worldbuilding');
  const [selectedUid, setSelectedUid] = useState<number | null>(null);

  // --- Modals ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [isTranslationOpen, setIsTranslationOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('sillyLore_project', JSON.stringify(project));
  }, [project]);

  useEffect(() => {
    localStorage.setItem('sillyLore_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('sillyLore_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('sillyLore_regex_messages', JSON.stringify(regexMessages));
  }, [regexMessages]);

  useEffect(() => {
    localStorage.setItem('sillyLore_ejs_messages', JSON.stringify(ejsMessages));
  }, [ejsMessages]);

  useEffect(() => {
    localStorage.setItem('sillyLore_char_messages', JSON.stringify(charMessages));
  }, [charMessages]);

  useEffect(() => {
    localStorage.setItem('sillyLore_dict_messages', JSON.stringify(dictMessages));
  }, [dictMessages]);

  useEffect(() => {
    localStorage.setItem('sillyLore_entry_messages', JSON.stringify(entryMessages));
  }, [entryMessages]);

  // --- Custom Lorebook Setter Bridge ---
  const lorebook = project.lorebook;
  
  const setLorebook = (update: Lorebook | ((prevLbk: Lorebook) => Lorebook)) => {
    setProject(prev => {
      const nextLbk = typeof update === 'function' ? update(prev.lorebook) : update;
      return {
        ...prev,
        lorebook: nextLbk,
        updatedAt: Date.now()
      };
    });
  };

  // --- Entry Handlers ---
  const handleAddEntry = () => {
    const newUid = lorebook.entries.length > 0 
      ? Math.max(...lorebook.entries.map(e => e.uid)) + 1 
      : 1;

    const newEntry: LorebookEntry = {
      uid: newUid,
      key: [],
      secondary_keys: [],
      comment: 'Mục mới',
      content: '',
      constant: false,
      selective: true,
      vectorized: false,
      key_logic: 'and_any',
      order: 100,
      position: 'before_char',
      scan_depth: 4,
      case_sensitive: false,
      match_whole_words: true,
      prevent_recursion: false,
      delay_until_recursion: false,
      non_recursable: false,
      ignore_budget: false,
      priority: 0,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      probability: 100,
      enabled: true
    };

    setLorebook(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
    setSelectedUid(newUid);
    return newEntry;
  };

  const handleDeleteEntry = () => {
    if (deleteConfirmId === null) return;
    setLorebook(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.uid !== deleteConfirmId)
    }));
    if (selectedUid === deleteConfirmId) {
      setSelectedUid(null);
    }
    setDeleteConfirmId(null);
  };

  const handleDuplicateEntry = (entry: LorebookEntry) => {
    const newUid = Math.max(...lorebook.entries.map(e => e.uid), 0) + 1;
    const duplicated: LorebookEntry = {
      ...entry,
      uid: newUid,
      comment: `${entry.comment} (Bản sao)`,
    };
    setLorebook(prev => ({ ...prev, entries: [...prev.entries, duplicated] }));
    setSelectedUid(newUid);
  };

  const handleUpdateEntry = (updated: LorebookEntry) => {
    setLorebook(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.uid === updated.uid ? updated : e)
    }));
  };

  const handleAIInsert = (data: Partial<LorebookEntry>) => {
    if (selectedUid === null) return;
    const entry = lorebook.entries.find(e => e.uid === selectedUid);
    if (entry) {
      handleUpdateEntry({
        ...entry,
        ...data,
      });
    }
  };

  const handleTranslationUpdate = (translatedEntries: LorebookEntry[]) => {
    setLorebook(prev => ({ ...prev, entries: translatedEntries }));
  };

  // --- Tawa AI Worldbook actions listener ---
  const handleWorldbuildingActions = (actions: WorldbuildingAction[]) => {
    console.log('[TAWA-DEBUG] handleWorldbuildingActions called with', actions.length, 'actions:', actions.map(a => a.type));
    setProject(prev => {
      let nextEntries = [...prev.lorebook.entries];
      let nextType = prev.type;
      let nextCharData = { ...prev.charData };
      let nextRegexScripts = [...prev.regexScripts];
      
      actions.forEach((action, actionIdx) => {
        try {
          console.log(`[TAWA-DEBUG] Processing action ${actionIdx}:`, action.type, action.data?.comment || action.target_comment || '');

          if (action.type === 'create' && action.data) {
            // Safe uid calculation - filter out entries without valid uid
            const validUids = nextEntries.map(e => typeof e.uid === 'number' ? e.uid : 0);
            const maxUid = validUids.length > 0 ? Math.max(...validUids) : 0;
            const newUid = maxUid + 1;
            
            // Normalize action.data: handle AI returning "keys" instead of "key"
            const normalizedData = { ...action.data } as any;
            if (normalizedData.keys && !normalizedData.key) {
              normalizedData.key = normalizedData.keys;
              delete normalizedData.keys;
            }
            // Remove uid from action.data to prevent AI from setting bad uids
            delete normalizedData.uid;
            
            const template: LorebookEntry = {
              uid: newUid,
              key: [],
              secondary_keys: [],
              comment: 'New Entry',
              content: '',
              constant: false,
              selective: true,
              vectorized: false,
              key_logic: 'and_any',
              order: 100,
              position: 'before_char',
              scan_depth: 4,
              case_sensitive: false,
              match_whole_words: true,
              prevent_recursion: false,
              delay_until_recursion: false,
              non_recursable: false,
              ignore_budget: false,
              priority: 0,
              sticky: 0,
              cooldown: 0,
              delay: 0,
              probability: 100,
              enabled: true,
              ...normalizedData
            } as LorebookEntry;
            
            nextEntries.push(template);
            console.log(`[TAWA-DEBUG] Created entry: "${template.comment}" (uid=${template.uid})`);
          }

          if (action.type === 'update' && action.target_comment && action.data) {
            const target = action.target_comment.toLowerCase().trim();
            let index = nextEntries.findIndex(e => e.comment.toLowerCase().trim() === target);
            
            if (index === -1) {
               index = nextEntries.findIndex(e => e.comment.toLowerCase().trim().includes(target) || target.includes(e.comment.toLowerCase().trim()));
            }

            if (index !== -1) {
               nextEntries[index] = { ...nextEntries[index], ...action.data };
               console.log(`[TAWA-DEBUG] Updated entry at index ${index}: "${nextEntries[index].comment}"`);
            } else {
               console.warn(`[TAWA-DEBUG] Update target not found: "${action.target_comment}"`);
            }
          }

          if (action.type === 'delete' && action.target_comment) {
             const target = action.target_comment.toLowerCase().trim();
             const before = nextEntries.length;
             nextEntries = nextEntries.filter(e => e.comment.toLowerCase().trim() !== target);
             console.log(`[TAWA-DEBUG] Delete "${action.target_comment}": removed ${before - nextEntries.length} entries`);
          }

          if (action.type === 'set_project_type' && action.project_type) {
            nextType = action.project_type;
            console.log(`[TAWA-DEBUG] Set project type to: ${nextType}`);
          }

          if (action.type === 'update_zod_schema' && action.zod_schema !== undefined) {
            nextCharData.zod_schema = action.zod_schema;
            console.log(`[TAWA-DEBUG] Updated Zod schema (${action.zod_schema.length} chars)`);
          }

          if (action.type === 'update_mvu_dictionary' && action.mvu_dictionary !== undefined) {
            nextCharData.mvu_dictionary = action.mvu_dictionary;
            console.log(`[TAWA-DEBUG] Updated MVU dictionary (${action.mvu_dictionary.length} chars)`);
          }

          if (action.type === 'update_ejs_template' && action.ejs_template !== undefined) {
            nextCharData.ejs_template = action.ejs_template;
            console.log(`[TAWA-DEBUG] Updated EJS template`);
          }

          if (action.type === 'update_character_data' && action.char_data) {
            nextCharData = { ...nextCharData, ...action.char_data };
            console.log(`[TAWA-DEBUG] Updated character data fields:`, Object.keys(action.char_data));
          }

          if (action.type === 'create_regex' && action.regex_data) {
            nextRegexScripts.push({
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
            console.log(`[TAWA-DEBUG] Created regex: "${action.regex_data.scriptName}"`);
          }

          if (action.type === 'update_regex' && action.target_regex_id && action.regex_data) {
            nextRegexScripts = nextRegexScripts.map(s => 
              s.id === action.target_regex_id ? { ...s, ...action.regex_data } : s
            );
          }

          if (action.type === 'delete_regex' && action.target_regex_id) {
            nextRegexScripts = nextRegexScripts.filter(s => s.id !== action.target_regex_id);
          }

          if (action.type === 'seed_regex') {
            // Defer seed_regex to avoid conflicting state updates
            const targetTypeForSeed = nextType;
            setTimeout(() => {
              handleSeedDefaultRegex(targetTypeForSeed);
            }, 100);
            console.log(`[TAWA-DEBUG] Scheduled seed_regex for type: ${nextType}`);
          }
        } catch (err) {
          console.error(`[TAWA-ERROR] Failed to process action ${actionIdx} (${action.type}):`, err, action);
        }
      });

      console.log(`[TAWA-DEBUG] After processing: entries=${nextEntries.length}, type=${nextType}, regexCount=${nextRegexScripts.length}`);

      return {
        ...prev,
        type: nextType,
        charData: nextCharData,
        regexScripts: nextRegexScripts,
        lorebook: {
          ...prev.lorebook,
          entries: nextEntries
        },
        updatedAt: Date.now()
      };
    });
  };

  // --- Card Manager actions ---
  const handleImportV3 = (jsonStr: string) => {
    try {
      const imported = importCardV3(jsonStr);
      setProject(imported);
      setSelectedUid(null);
      alert("Đã nhập Thẻ SillyTavern V3 thành công!");
    } catch (err: any) {
      alert("Lỗi nhập Thẻ V3: " + err.message);
    }
  };

  const handleImportLegacyLorebook = (jsonStr: string) => {
    try {
      const importedLbk = importLegacyLorebook(jsonStr);
      setProject(prev => ({
        ...prev,
        lorebook: importedLbk,
        updatedAt: Date.now()
      }));
      setSelectedUid(null);
      alert("Đã nhập Lorebook thành công!");
    } catch (err: any) {
      alert("Lỗi nhập Lorebook: " + err.message);
    }
  };

  const handleExportV3 = () => {
    try {
      const cardJson = exportCardV3(project);
      const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(cardJson);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${project.charData.name || "SillyTavern_Card"}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err: any) {
      alert("Lỗi xuất thẻ: " + err.message);
    }
  };

  // Seeding templates
  const handleSeedDefaultRegex = (targetType: CardType = project.type) => {
    const keyword = 'youyujun233';
    let seeded: RegexScript[] = [];
    
    if (targetType === 'mvu' || targetType === 'mvu_zod') {
      seeded = [
        {
          id: 'reg-0',
          scriptName: 'Ẩn keyword trigger',
          findRegex: keyword,
          replaceString: '',
          trimStrings: [],
          minDepth: null,
          maxDepth: null,
          runOnSource: false,
          promptOnly: true,
          isactive: true,
          markdownOnly: false,
          runOnEdit: true,
          substituteRegex: 0,
          placement: [2]
        },
        {
          id: 'reg-1',
          scriptName: 'Ẩn update tags',
          findRegex: '<UpdateVariable>[\s\S]*?</UpdateVariable>',
          replaceString: '',
          trimStrings: [],
          minDepth: null,
          maxDepth: null,
          runOnSource: false,
          promptOnly: true,
          isactive: true,
          markdownOnly: false,
          runOnEdit: true,
          substituteRegex: 0,
          placement: [2]
        },
        {
          id: 'reg-2',
          scriptName: 'Đang cập nhật biến',
          findRegex: '/<update(?:variable)?>(?!.*<\/update(?:variable)?>)\s*([\s\S]*?)$/gsi',
          replaceString: '<div class="mvu-updating-box">...Đang cập nhật biến...</div>',
          trimStrings: [],
          minDepth: null,
          maxDepth: null,
          runOnSource: false,
          promptOnly: false,
          isactive: true,
          markdownOnly: true,
          runOnEdit: false,
          substituteRegex: 0,
          placement: [2]
        },
        {
          id: 'reg-3',
          scriptName: 'Cập nhật xong',
          findRegex: '/<update(?:variable)?>\s*([\s\S]*?)\s*<\/update(?:variable)?>/gsi',
          replaceString: '<div class="mvu-success-box">✅ Cập nhật hoàn tất</div>',
          trimStrings: [],
          minDepth: null,
          maxDepth: null,
          runOnSource: false,
          promptOnly: false,
          isactive: true,
          markdownOnly: true,
          runOnEdit: false,
          substituteRegex: 0,
          placement: [2]
        }
      ];
    } else if (targetType === 'era') {
      seeded = [
        {
          id: 'reg-0',
          scriptName: 'Ẩn keyword trigger ERA',
          findRegex: keyword,
          replaceString: '',
          trimStrings: [],
          minDepth: null,
          maxDepth: null,
          runOnSource: false,
          promptOnly: true,
          isactive: true,
          markdownOnly: false,
          runOnEdit: true,
          substituteRegex: 0,
          placement: [2]
        },
        {
          id: 'reg-1',
          scriptName: 'Game Dashboard ERA',
          findRegex: keyword,
          replaceString: `\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {
      margin: 0; padding: 0;
      background-color: #0b0f19; color: #cdd6f4;
      font-family: 'Lora', serif;
    }
    .game-panel {
      display: flex; width: 100%; height: 100vh; overflow: hidden;
      box-sizing: border-box;
    }
    .left-pane {
      width: 300px; flex-shrink: 0; padding: 20px;
      border-right: 1px solid #1e1e2e; overflow-y: auto;
    }
    .center-pane {
      flex-grow: 1; padding: 20px; overflow-y: auto;
    }
    h2 { font-family: 'Cinzel', serif; color: #cba6f7; margin-top: 0; }
    .card {
      background-color: #181825; border: 1px solid #313244;
      border-radius: 8px; padding: 12px; margin-bottom: 15px;
    }
    .btn {
      background: linear-gradient(135deg, #cba6f7, #89b4fa); border: none;
      padding: 10px 15px; border-radius: 6px; color: #11111b; cursor: pointer;
      font-weight: bold; width: 100%; text-align: center; display: block;
      margin-bottom: 10px; transition: 0.2s;
    }
    .btn:hover {
      filter: brightness(1.1); transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="game-panel">
    <div class="left-pane">
      <h2><i class="fa-solid fa-dna"></i> ERA Variables</h2>
      <div class="card">
        <p><strong>Ngoại hình:</strong></p>
        <div id="appearance-val" style="font-size: 11px; color: #a6adc8; max-height: 120px; overflow-y: auto;">Đang tải...</div>
      </div>
      <button class="btn" onclick="updateAppearance()">Đổi Ngoại Hình</button>
    </div>
    <div class="center-pane">
      <h2><i class="fa-solid fa-terminal"></i> Nhật Ký ERA</h2>
      <div class="card">
        <p>Thẻ này liên kết trực tiếp Lorebook với biến số qua getwi/setwi.</p>
      </div>
    </div>
  </div>

  <script>
    async function init() {
      // Đọc trực tiếp Lorebook Entry làm biến ngoại hình
      const appearance = await getwi('Ngoại Hình ERA');
      document.getElementById('appearance-val').textContent = appearance || "Chưa thiết lập entry Ngoại Hình ERA";
    }
    
    async function updateAppearance() {
      const newDesc = prompt("Nhập mô tả ngoại hình mới cho nhân vật:");
      if (newDesc) {
        await setwi('Ngoại Hình ERA', newDesc);
        document.getElementById('appearance-val').textContent = newDesc;
      }
    }
    
    window.onload = init;
  </script>
</body>
</html>
\`\`\``,
          trimStrings: [],
          minDepth: null,
          maxDepth: null,
          runOnSource: false,
          promptOnly: false,
          isactive: true,
          markdownOnly: true,
          runOnEdit: false,
          substituteRegex: 0,
          placement: [2]
        }
      ];
    }
    
    if (seeded.length > 0) {
      setProject(prev => ({
        ...prev,
        regexScripts: seeded,
        updatedAt: Date.now()
      }));
      alert("Đã sinh các Regex Scripts mẫu thành công!");
    } else {
      alert("Thẻ thường không cần Regex Scripts mẫu.");
    }
  };

  const handleSeedSystemEntries = () => {
    let seededEntries: LorebookEntry[] = [];
    
    if (project.type === 'mvu' || project.type === 'mvu_zod') {
      seededEntries = [
        {
          uid: Date.now() + 1,
          key: ['[initvar]Khởi tạo biến'],
          secondary_keys: [],
          comment: '[initvar]Khởi tạo biến',
          content: 'MÃ YAML KHỞI TẠO BIẾN',
          constant: true,
          selective: false,
          vectorized: false,
          key_logic: 'and_any',
          order: 0,
          position: 'before_char',
          scan_depth: 4,
          case_sensitive: false,
          match_whole_words: true,
          prevent_recursion: false,
          delay_until_recursion: false,
          non_recursable: false,
          ignore_budget: false,
          priority: 0,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          probability: 100,
          enabled: false
        },
        {
          uid: Date.now() + 2,
          key: ['Danh sách biến số'],
          secondary_keys: [],
          comment: 'Danh sách biến số',
          content: '---\n<status_current_variables>\n{{format_message_variable::stat_data}}\n</status_current_variables>',
          constant: false,
          selective: true,
          vectorized: false,
          key_logic: 'and_any',
          order: 999,
          position: 'after_char',
          scan_depth: 4,
          case_sensitive: false,
          match_whole_words: true,
          prevent_recursion: false,
          delay_until_recursion: false,
          non_recursable: false,
          ignore_budget: false,
          priority: 0,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          probability: 100,
          enabled: true
        },
        {
          uid: Date.now() + 3,
          key: ['[mvu_update] Quy tắc cập nhật biến'],
          secondary_keys: [],
          comment: '[mvu_update] Quy tắc cập nhật biến',
          content: '---\nquy tắc cập nhật biến:\n  Người Chơi:\n    Trạng Thái:\n      type: string\n      check: Cập nhật khi thay đổi trạng thái.\n  (BỔ SUNG THÊM CÁC QUY TẮC DỰA TRÊN ZOD SCHEMA CỦA BẠN)',
          constant: false,
          selective: true,
          vectorized: false,
          key_logic: 'and_any',
          order: 200,
          position: 'after_char',
          scan_depth: 4,
          case_sensitive: false,
          match_whole_words: true,
          prevent_recursion: false,
          delay_until_recursion: false,
          non_recursable: false,
          ignore_budget: false,
          priority: 0,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          probability: 100,
          enabled: true
        },
        {
          uid: Date.now() + 4,
          key: ['[mvu_update] Định dạng xuất biến'],
          secondary_keys: [],
          comment: '[mvu_update] Định dạng xuất biến',
          content: '---\nđịnh dạng xuất biến:\n  rule:\n    - you must output the update analysis and the actual update commands at once in the end of the next reply\n    - the update commands works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:\n      - replace: replace the value of existing paths (absolute set)\n      - delta: update the value of existing number paths by a positive/negative delta value (numerical incremental adjust)\n      - insert: insert new items into an object or array (using `-` as array index intends appending to the end)\n      - remove: remove an existing path or item\n    - don\'t update field names starting with `_` (readonly fields)\n    - [History context check]: Before writing updates, scan prior messages for events reflecting these changes. If already processed, do NOT apply redundant updates.\n  format: |-\n    <UpdateVariable>\n    <Analysis>$(IN ENGLISH, no more than 80 words)\n    - ${calculate time passed: ...}\n    - ${history check: check if the variable change was already processed in previous messages}\n    - ${analyze every variable based on its corresponding check: ...}\n    </Analysis>\n    <JSONPatch>\n    [\n      { "op": "replace", "path": "/Người Chơi/Vị Trí", "value": "Hào Châu" },\n      { "op": "delta", "path": "/Người Chơi/Tài Sản Chính/Bạc Vụn", "value": -10 }\n    ]\n    </JSONPatch>\n    </UpdateVariable>',
          constant: false,
          selective: true,
          vectorized: false,
          key_logic: 'and_any',
          order: 190,
          position: 'after_char',
          scan_depth: 4,
          case_sensitive: false,
          match_whole_words: true,
          prevent_recursion: false,
          delay_until_recursion: false,
          non_recursable: false,
          ignore_budget: false,
          priority: 0,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          probability: 100,
          enabled: true
        }
      ];
    } else if (project.type === 'era') {
      seededEntries = [
        {
          uid: Date.now() + 1,
          key: ['youyujun233', 'era_system'],
          secondary_keys: [],
          comment: 'ERA Architecture System Rules',
          content: `<Hệ Thống ERA>
Quy tắc ERA liên kết trực tiếp lorebook entries làm biến số. Các hàm getwi('Tên_Entry') và setwi('Tên_Entry', 'Nội dung mới') sẽ được frontend gọi.
AI hãy chú ý diễn giải thông tin dựa trên các lorebook entries này. Kết thúc tin nhắn bằng keyword trigger: youyujun233
</Hệ Thống ERA>`,
          constant: true,
          selective: false,
          vectorized: false,
          key_logic: 'and_any',
          order: 0,
          position: 'before_char',
          scan_depth: 4,
          case_sensitive: false,
          match_whole_words: true,
          prevent_recursion: false,
          delay_until_recursion: false,
          non_recursable: false,
          ignore_budget: false,
          priority: 0,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          probability: 100,
          enabled: true
        },
        {
          uid: Date.now() + 2,
          key: ['Ngoại_Hình_ERA'],
          secondary_keys: [],
          comment: 'Biến ngoại hình nhân vật (ERA)',
          content: 'Hình dạng slime màu xanh lam nhạt, lấp lánh như sương mù buổi sớm.',
          constant: false,
          selective: true,
          vectorized: false,
          key_logic: 'and_any',
          order: 10,
          position: 'before_char',
          scan_depth: 4,
          case_sensitive: false,
          match_whole_words: true,
          prevent_recursion: false,
          delay_until_recursion: false,
          non_recursable: false,
          ignore_budget: false,
          priority: 0,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          probability: 100,
          enabled: true
        }
      ];
    }
    
    if (seededEntries.length > 0) {
      setProject(prev => ({
        ...prev,
        lorebook: {
          ...prev.lorebook,
          entries: [...prev.lorebook.entries, ...seededEntries]
        },
        updatedAt: Date.now()
      }));
      alert("Đã sinh các Lorebook Entries hệ thống mẫu thành công!");
    } else {
      alert("Thẻ thường không cần Entries hệ thống mẫu.");
    }
  };

  const handleResetProject = () => {
    const confirmReset = window.confirm("Bạn có chắc chắn muốn xóa toàn bộ dự án hiện tại? Tất cả các thông tin nhân vật, lorebook và regex sẽ bị xóa sạch và đưa về trạng thái trống.");
    if (!confirmReset) return;
    
    setProject({
      id: 'proj-' + Date.now(),
      name: 'Dự án Mới',
      type: 'normal',
      charData: {
        name: '',
        first_mes: '',
        description: '',
        personality: '',
        scenario: '',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        zod_schema: '',
        ejs_template: '',
        mvu_dictionary: ''
      },
      lorebook: {
        name: 'Worldbook Mới',
        description: '',
        entries: []
      },
      regexScripts: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setSelectedUid(null);
    setChatMessages([
      {
        id: 'intro',
        role: 'assistant',
        content: 'Chào mừng ngươi đến với Cõi Tạo Thẻ. Ta là Tawa, người nắm giữ chìa khóa định hình thực tại của các nhân vật SillyTavern. Hãy đưa cho ta ý tưởng lorebook, bối cảnh thế giới của ngươi, ta sẽ dệt nên cấu trúc của nó!',
        timestamp: Date.now()
      }
    ]);
    alert("Đã reset dự án thành công!");
  };

  const selectedEntry = lorebook.entries.find(e => e.uid === selectedUid) || null;

  const tabs = [
    { id: 'worldbuilding', label: 'Tawa AI', icon: <MessageSquare size={16} />, visible: true },
    { id: 'project', label: 'Dự án', icon: <Cpu size={16} />, visible: true },
    { id: 'character', label: 'Nhân vật', icon: <Edit size={16} />, visible: true },
    { id: 'dictionary', label: 'Từ điển biến', icon: <BookOpen size={16} />, visible: project.type !== 'normal' },
    { id: 'lorebook', label: 'Mục lục', icon: <BookOpen size={16} />, visible: true },
    { id: 'regex', label: 'Regex Scripts', icon: <Layers size={16} />, visible: project.type !== 'normal' },
    { id: 'ejs', label: 'EJS Template', icon: <Code size={16} />, visible: project.type !== 'normal' },
    { id: 'preview', label: 'Xem trước', icon: <Eye size={16} />, visible: true }
  ];

  const getTypeBadgeStyles = (type: CardType) => {
    switch (type) {
      case 'mvu':
        return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
      case 'mvu_zod':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      case 'era':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#060813] text-slate-100 overflow-hidden font-sans relative">
      {/* Animated Ambient Glow Orbs */}
      <div className="absolute inset-0 bg-glow-orb-1 pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-glow-orb-2 pointer-events-none z-0"></div>

      {/* Top Bar */}
      <header className="h-14 glass-panel border-b border-white/5 flex items-center justify-between px-6 shrink-0 shadow-xl z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
             <BookOpen size={18} className="text-white"/>
          </div>
          <h1 className="font-extrabold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Tawa Card Studio 2.0
          </h1>
        </div>

        <div className="flex items-center gap-3 z-10">
           <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs text-slate-300 font-mono shadow-inner">
             <span>Card: <strong className="text-white">{project.name}</strong></span>
             <span className="text-slate-600">|</span>
             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getTypeBadgeStyles(project.type)}`}>
               {project.type === 'normal' ? 'Normal' : project.type.toUpperCase().replace('_', ' ')}
             </span>
           </div>

           <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)} title="Cài đặt AI">
             <Settings size={18} className="text-slate-400 hover:text-slate-200" />
           </Button>

           <Button variant="ghost" size="sm" onClick={() => setIsGuideOpen(true)} title="Hướng dẫn sử dụng">
             <HelpCircle size={18} className="text-slate-400 hover:text-slate-200" />
           </Button>
        </div>
      </header>


      {/* Tab Navigation */}
      <TabBar
        tabs={tabs}
        activeTab={activeView}
        onChange={(tabId) => {
          // If moving away from regex or ejs if not allowed
          if ((tabId === 'regex' || tabId === 'ejs' || tabId === 'dictionary') && project.type === 'normal') {
            setActiveView('project');
          } else {
            setActiveView(tabId);
          }
        }}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {activeView === 'project' && (
          <CardProjectManager
            project={project}
            onChange={setProject}
            onImportV3={handleImportV3}
            onImportLegacyLorebook={handleImportLegacyLorebook}
            onExportV3={handleExportV3}
            onSeedDefaultRegex={handleSeedDefaultRegex}
            onSeedSystemEntries={handleSeedSystemEntries}
            onResetProject={handleResetProject}
          />
        )}

        {activeView === 'character' && (
          <CharacterEditor
            project={project}
            onChange={(updatedCharData) => {
              setProject(prev => ({
                ...prev,
                charData: updatedCharData,
                updatedAt: Date.now()
              }));
            }}
            settings={settings}
            chatMessages={charMessages}
            setChatMessages={setCharMessages}
          />
        )}

        {activeView === 'lorebook' && (
          <div className="flex h-full overflow-hidden">
            <LorebookList 
              entries={lorebook.entries}
              selectedId={selectedUid}
              onSelect={setSelectedUid}
              onAdd={handleAddEntry}
              onDelete={setDeleteConfirmId}
              onDuplicate={handleDuplicateEntry}
              onToggle={(uid) => {
                setLorebook(prev => ({
                  ...prev,
                  entries: prev.entries.map(e => 
                    e.uid === uid ? { ...e, enabled: !e.enabled } : e
                  )
                }));
              }}
            />
            <EntryEditor 
              entry={selectedEntry}
              onChange={handleUpdateEntry}
              onOpenAI={() => setIsAIGeneratorOpen(true)}
              project={project}
              settings={settings}
              chatMessages={entryMessages}
              setChatMessages={setEntryMessages}
            />
          </div>
        )}

        {activeView === 'worldbuilding' && (
          <div className="w-full h-full flex justify-center bg-slate-950 relative">
             <div className="absolute inset-0 bg-[url('https://files.catbox.moe/o82o4z.png')] bg-cover bg-center opacity-20 pointer-events-none"></div>
             <div className="w-full h-full relative z-10 px-4">
               <WorldbuildingChat 
                  project={project}
                  settings={settings}
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  onApplyActions={handleWorldbuildingActions}
               />
             </div>
          </div>
        )}

        {activeView === 'regex' && project.type !== 'normal' && (
          <RegexBuilder
            project={project}
            onChange={setProject}
            settings={settings}
            chatMessages={regexMessages}
            setChatMessages={setRegexMessages}
          />
        )}

        {activeView === 'ejs' && project.type !== 'normal' && (
          <EJSEditor
            project={project}
            onChange={setProject}
            settings={settings}
            chatMessages={ejsMessages}
            setChatMessages={setEjsMessages}
          />
        )}

        {activeView === 'dictionary' && project.type !== 'normal' && (
          <VariableDictionary
            project={project}
            onChange={(updatedCharData) => {
              setProject(prev => ({
                ...prev,
                charData: updatedCharData,
                updatedAt: Date.now()
              }));
            }}
            settings={settings}
            chatMessages={dictMessages}
            setChatMessages={setDictMessages}
          />
        )}

        {activeView === 'preview' && (
          <CardPreview project={project} settings={settings} />
        )}
      </div>

      {/* Global Modals */}
      <GuideModal 
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />

      <AIGeneratorModal 
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        settings={settings}
        onGenerate={handleAIInsert}
      />

      <TranslationModal 
        isOpen={isTranslationOpen}
        onClose={() => setIsTranslationOpen(false)}
        entries={lorebook.entries}
        settings={settings}
        onUpdateEntries={handleTranslationUpdate}
      />

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={deleteConfirmId !== null} 
        onClose={() => setDeleteConfirmId(null)} 
        title="Xác nhận xóa"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
             <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Hủy</Button>
             <Button variant="danger" onClick={handleDeleteEntry}>Xóa vĩnh viễn</Button>
          </div>
        }
      >
        <p className="text-slate-300">
          Bạn có chắc chắn muốn xóa mục này không? Hành động này không thể hoàn tác.
        </p>
      </Modal>

    </div>
  );
};

export default App;
