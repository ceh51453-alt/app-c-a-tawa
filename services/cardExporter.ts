import { CardProject, CardType, CharacterData, RegexScript, Lorebook, LorebookEntry } from '../types';

// Helper to convert position strings to ST numeric positions
const positionToNumber = (pos: string): number => {
  switch (pos) {
    case 'before_char': return 0;
    case 'after_char': return 1;
    case 'before_em': return 2;
    case 'after_em': return 3;
    case 'before_an': return 4;
    case 'after_an': return 5;
    case 'at_depth_system': return 6;
    case 'at_depth_user': return 7;
    case 'at_depth_assistant': return 8;
    default: return 1; // default after_char
  }
};

const numberToPosition = (num: number): string => {
  const mapping = [
    'before_char',
    'after_char',
    'before_em',
    'after_em',
    'before_an',
    'after_an',
    'at_depth_system',
    'at_depth_user',
    'at_depth_assistant'
  ];
  return mapping[num] || 'after_char';
};

// Generate a UUID-v4-like ID for tavern_helper scripts
const generateScriptId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

// Export to ST Chara Card V3 format
export const exportCardV3 = (project: CardProject): string => {
  const dateStr = new Date(project.createdAt || Date.now()).toISOString();
  
  // Format Lorebook entries to V3 format
  const stEntries = project.lorebook.entries.map((entry, idx) => {
    return {
      id: entry.uid,
      keys: entry.key,
      secondary_keys: entry.secondary_keys || [],
      comment: entry.comment,
      content: entry.content,
      name: "",
      constant: entry.constant,
      selective: entry.selective,
      insertion_order: entry.order,
      enabled: entry.enabled,
      position: entry.position,
      use_regex: true,
      extensions: {
        position: positionToNumber(entry.position),
        exclude_recursion: entry.non_recursable ?? false,
        display_index: idx,
        probability: entry.probability ?? 100,
        useProbability: true,
        depth: entry.scan_depth ?? 4,
        selectiveLogic: entry.key_logic === 'and_any' ? 0 : entry.key_logic === 'and_all' ? 1 : entry.key_logic === 'not_any' ? 2 : 3,
        outlet_name: "",
        group: "",
        group_override: false,
        group_weight: entry.probability ?? 100,
        prevent_recursion: entry.prevent_recursion ?? false,
        delay_until_recursion: entry.delay_until_recursion ?? false,
        scan_depth: entry.scan_depth ?? 4,
        match_whole_words: entry.match_whole_words ?? true,
        use_group_scoring: false,
        case_sensitive: entry.case_sensitive ?? false,
        automation_id: "",
        role: 0,
        vectorized: entry.vectorized ?? false,
        sticky: entry.sticky ?? 0,
        cooldown: entry.cooldown ?? 0,
        delay: entry.delay ?? 0,
        match_persona_description: false,
        match_character_description: false,
        match_character_personality: false,
        match_character_depth_prompt: false,
        match_scenario: false,
        match_creator_notes: false,
        triggers: [],
        ignore_budget: entry.ignore_budget ?? false
      }
    };
  });

  const stLorebook = {
    name: project.lorebook.name || `${project.charData.name} Worldbook`,
    description: project.lorebook.description || "",
    entries: stEntries
  };

  // Compile TavernHelper scripts based on card type (REAL ST format)
  const thScripts: any[] = [];
  if (project.type === 'mvu' || project.type === 'mvu_zod') {
    // 1. Zod Schema script (must come BEFORE MVU engine for proper initialization)
    if (project.type === 'mvu_zod' && project.charData.zod_schema) {
      thScripts.push({
        type: "script",
        enabled: true,
        name: "MVU Zod Schema",
        id: generateScriptId(),
        content: project.charData.zod_schema,
        info: "",
        button: { enabled: true, buttons: [] },
        data: {}
      });
    }

    // 2. MVU engine script
    thScripts.push({
      type: "script",
      enabled: true,
      name: "MVU",
      id: generateScriptId(),
      content: "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'",
      info: "",
      button: {
        enabled: true,
        buttons: [
          { name: "重新处理变量", visible: true },
          { name: "重新读取初始变量", visible: true },
          { name: "清除旧楼层变量", visible: false },
          { name: "快照楼层", visible: false },
          { name: "重演楼层", visible: false },
          { name: "重试额外模型解析", visible: false }
        ]
      },
      data: {}
    });
  }

  // Compile Regex scripts (REAL ST format: disabled instead of isactive)
  const baseRegexScripts = [...project.regexScripts];
  if (project.type === 'mvu' || project.type === 'mvu_zod') {
    const dashboardIndex = baseRegexScripts.findIndex(r =>
      /Bảng MVUZOD/i.test(r.scriptName) ||
      /Làm đẹp thanh trạng thái/i.test(r.scriptName) ||
      (r.findRegex === "<StatusPlaceHolderImpl/>" && !r.promptOnly && r.markdownOnly)
    );
    const replacement = `\`\`\`html\n${project.charData.ejs_template || ""}\n\`\`\``;
    if (dashboardIndex >= 0) {
      baseRegexScripts[dashboardIndex] = {
        ...baseRegexScripts[dashboardIndex],
        replaceString: replacement
      };
    } else if (project.charData.ejs_template) {
      baseRegexScripts.push({
        id: generateScriptId(),
        scriptName: "Bảng MVUZOD ",
        findRegex: "<StatusPlaceHolderImpl/>",
        replaceString: replacement,
        trimStrings: [],
        placement: [2],
        isactive: true,
        markdownOnly: true,
        promptOnly: false,
        runOnEdit: true,
        substituteRegex: 0,
        minDepth: null,
        maxDepth: 3,
        runOnSource: false
      });
    }
  }

  const regexScripts = baseRegexScripts.map(script => ({
    id: script.id || generateScriptId(),
    scriptName: script.scriptName,
    findRegex: script.findRegex,
    replaceString: script.replaceString,
    trimStrings: script.trimStrings || [],
    placement: script.placement,
    disabled: !script.isactive,
    markdownOnly: script.markdownOnly,
    promptOnly: script.promptOnly,
    runOnEdit: script.runOnEdit ?? true,
    substituteRegex: script.substituteRegex ?? 0,
    minDepth: script.minDepth,
    maxDepth: script.maxDepth
  }));

  // Structure the V3 card JSON (matches real card structure exactly)
  const cardV3: any = {
    name: project.charData.name,
    description: project.charData.description,
    personality: project.charData.personality,
    scenario: project.charData.scenario,
    first_mes: project.charData.first_mes,
    mes_example: project.charData.mes_example,
    creatorcomment: project.charData.creator_notes,
    avatar: "none",
    talkativeness: "0.5",
    fav: false,
    tags: [],
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: project.charData.name,
      description: project.charData.description,
      personality: project.charData.personality,
      scenario: project.charData.scenario,
      first_mes: project.charData.first_mes,
      mes_example: project.charData.mes_example,
      creator_notes: project.charData.creator_notes,
      system_prompt: project.charData.system_prompt,
      post_history_instructions: project.charData.post_history_instructions,
      tags: [],
      creator: "Tawa Card Studio",
      character_version: "1.0",
      alternate_greetings: [],
      extensions: {
        talkativeness: "0.5",
        fav: false,
        world: project.lorebook.name || "",
        depth_prompt: {
          prompt: "",
          depth: 4,
          role: "system"
        },
        tavern_helper: {
          scripts: thScripts,
          variables: {}
        },
        regex_scripts: regexScripts
      },
      character_book: stLorebook
    },
    create_date: dateStr
  };

  return JSON.stringify(cardV3, null, 2);
};

// Import SillyTavern V3 character card
export const importCardV3 = (jsonStr: string): CardProject => {
  const parsed = JSON.parse(jsonStr);
  
  if (parsed.spec !== 'chara_card_v3') {
    throw new Error("Không phải file Card SillyTavern V3 hợp lệ");
  }

  const data = parsed.data || {};
  const charData: CharacterData = {
    name: data.name || "Nhân vật mới",
    first_mes: data.first_mes || "",
    description: data.description || "",
    personality: data.personality || "",
    scenario: data.scenario || "",
    mes_example: data.mes_example || "",
    creator_notes: data.creator_notes || data.creatorcomment || "",
    system_prompt: data.system_prompt || "",
    post_history_instructions: data.post_history_instructions || "",
    zod_schema: "",
    ejs_template: ""
  };

  // Find Zod Schema and card type by searching script CONTENT (not just name)
  let cardType: CardType = 'normal';
  let zodSchema = "";

  const extensions = data.extensions || {};
  const thScripts = extensions.tavern_helper?.scripts || extensions.TavernHelper_scripts || [];
  
  // Detect MVU engine by checking content for MagVarUpdate import
  const mvuScript = thScripts.find((s: any) => 
    s.content?.includes('MagVarUpdate') || 
    s.name === 'MVU' || 
    s.name === 'MVUbeta'
  );
  
  // Detect Zod schema by checking content for registerMvuSchema
  const schemaScript = thScripts.find((s: any) => 
    s.content?.includes('registerMvuSchema') || 
    s.name === 'ZOD' || 
    s.name === 'MVU Zod Schema'
  );

  if (mvuScript || schemaScript) {
    if (schemaScript) {
      cardType = 'mvu_zod';
      zodSchema = schemaScript.content || "";
    } else {
      cardType = 'mvu';
    }
  }

  // Import Lorebook
  const stLorebook = data.character_book || extensions.character_book || { name: "", entries: [] };
  const stEntries = stLorebook.entries || [];
  
  // Check if it's ERA card by looking for getwi/setwi in regex scripts or lorebook
  const allRegexContent = (extensions.regex_scripts || []).map((r: any) => r.replaceString || '').join(' ');
  if (cardType === 'normal' && (allRegexContent.includes('getwi') || allRegexContent.includes('setwi'))) {
    cardType = 'era';
  }
  
  const entries: LorebookEntry[] = stEntries.map((entry: any, index: number) => {
    const ext = entry.extensions || {};
    
    // selectiveLogic mapping
    let keyLogic: LorebookEntry['key_logic'] = 'and_any';
    if (ext.selectiveLogic === 1) keyLogic = 'and_all';
    else if (ext.selectiveLogic === 2) keyLogic = 'not_any';
    else if (ext.selectiveLogic === 3) keyLogic = 'not_all';

    return {
      uid: entry.id ?? entry.uid ?? index,
      key: entry.keys || entry.key || [],
      secondary_keys: entry.secondary_keys || [],
      comment: entry.comment || "",
      content: entry.content || "",
      constant: entry.constant ?? false,
      selective: entry.selective ?? true,
      vectorized: ext.vectorized ?? false,
      key_logic: keyLogic,
      order: entry.insertion_order ?? entry.order ?? 100,
      position: entry.position ?? numberToPosition(ext.position ?? 1),
      scan_depth: ext.depth ?? ext.scan_depth ?? 4,
      case_sensitive: ext.case_sensitive ?? false,
      match_whole_words: ext.match_whole_words ?? true,
      prevent_recursion: ext.prevent_recursion ?? false,
      delay_until_recursion: ext.delay_until_recursion ?? false,
      non_recursable: ext.exclude_recursion ?? false,
      ignore_budget: ext.ignore_budget ?? false,
      priority: entry.priority ?? 0,
      sticky: ext.sticky ?? 0,
      cooldown: ext.cooldown ?? 0,
      delay: ext.delay ?? 0,
      probability: ext.probability ?? 100,
      enabled: entry.enabled ?? true
    };
  });

  // Extract Regex Scripts (convert disabled→isactive, add new fields)
  const stRegex = extensions.regex_scripts || [];
  const regexScripts: RegexScript[] = stRegex.map((r: any, idx: number) => ({
    id: r.id || `regex-${idx}-${Date.now()}`,
    scriptName: r.scriptName || `Regex ${idx}`,
    findRegex: r.findRegex || "",
    replaceString: r.replaceString || "",
    trimStrings: r.trimStrings || [],
    markdownOnly: r.markdownOnly ?? true,
    placement: r.placement || [2],
    runOnSource: r.runOnSource ?? false,
    promptOnly: r.promptOnly ?? false,
    // Handle both formats: real cards use "disabled", old app used "isactive"
    isactive: r.isactive ?? (r.disabled !== undefined ? !r.disabled : true),
    runOnEdit: r.runOnEdit ?? true,
    substituteRegex: r.substituteRegex ?? 0,
    minDepth: r.minDepth ?? null,
    maxDepth: r.maxDepth ?? null
  }));

  const lorebook: Lorebook = {
    name: stLorebook.name || `${charData.name} Worldbook`,
    description: stLorebook.description || "",
    entries
  };

  charData.zod_schema = zodSchema;

  // Extract EJS template from regex scripts if present
  const cleanEjsTemplate = (str: string): string => {
    if (!str) return "";
    let cleaned = str.trim();
    const matchStart = cleaned.match(/^```html\s*/i) || cleaned.match(/^```\s*/);
    if (matchStart) {
      cleaned = cleaned.substring(matchStart[0].length);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  };

  const dashboardRegex = regexScripts.find(r => 
    /Bảng MVUZOD/i.test(r.scriptName) || 
    /Làm đẹp thanh trạng thái/i.test(r.scriptName) ||
    (r.findRegex === "<StatusPlaceHolderImpl/>" && !r.promptOnly && r.markdownOnly)
  );

  if (dashboardRegex) {
    charData.ejs_template = cleanEjsTemplate(dashboardRegex.replaceString);
  }

  // Detect EJS in lorebook content
  const hasEjs = entries.some(e => e.content.includes('<%') && e.content.includes('%>'));
  if (hasEjs && cardType === 'normal') {
    // If it has EJS, maybe it is ERA or EJS card
    // We will let user decide, but we can tag it or set ejs_template placeholder
  }

  return {
    id: `proj-${Date.now()}`,
    name: charData.name,
    type: cardType,
    charData,
    lorebook,
    regexScripts,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
};

// Import legacy lorebook only (for backward compatibility)
export const importLegacyLorebook = (jsonStr: string): Lorebook => {
  const parsed = JSON.parse(jsonStr);
  
  // Check if this is a SillyTavern character book or legacy exports
  const entriesRaw = parsed.entries || (parsed.character_book?.entries) || [];
  const entriesSrc = Array.isArray(entriesRaw) ? entriesRaw : Object.values(entriesRaw);
  
  const entries: LorebookEntry[] = entriesSrc.map((entry: any, index: number) => {
    const ext = entry.extensions || {};
    let keyLogic: LorebookEntry['key_logic'] = 'and_any';
    if (ext.selectiveLogic === 1) keyLogic = 'and_all';
    else if (ext.selectiveLogic === 2) keyLogic = 'not_any';
    else if (ext.selectiveLogic === 3) keyLogic = 'not_all';

    return {
      uid: entry.id ?? entry.uid ?? index,
      key: entry.keys || entry.key || [],
      secondary_keys: entry.secondary_keys || [],
      comment: entry.comment || "",
      content: entry.content || "",
      constant: entry.constant ?? false,
      selective: entry.selective ?? true,
      vectorized: ext.vectorized ?? false,
      key_logic: keyLogic,
      order: entry.insertion_order ?? entry.order ?? 100,
      position: entry.position ?? numberToPosition(ext.position ?? 1),
      scan_depth: ext.depth ?? ext.scan_depth ?? 4,
      case_sensitive: ext.case_sensitive ?? false,
      match_whole_words: ext.match_whole_words ?? true,
      prevent_recursion: ext.prevent_recursion ?? false,
      delay_until_recursion: ext.delay_until_recursion ?? false,
      non_recursable: ext.exclude_recursion ?? false,
      ignore_budget: ext.ignore_budget ?? false,
      priority: entry.priority ?? 0,
      sticky: ext.sticky ?? 0,
      cooldown: ext.cooldown ?? 0,
      delay: ext.delay ?? 0,
      probability: ext.probability ?? 100,
      enabled: entry.enabled ?? true
    };
  });

  return {
    name: parsed.name || "Worldbook",
    description: parsed.description || "",
    entries
  };
};

// Export Zod Schema as a standalone Lorebook file
export const exportZodSchemaAsLorebook = (zod_schema: string, charName: string): string => {
  const stLorebook = {
    name: `${charName} Zod Schema`,
    description: "Tự động tạo từ Tawa Card Studio",
    entries: [
      {
        id: 1,
        keys: ["Zod Schema", "schema", "biến số", "biến mvu"],
        secondary_keys: [],
        comment: "[Tự động] Zod Schema",
        content: zod_schema,
        name: "",
        constant: false,
        selective: true,
        insertion_order: 500,
        enabled: true,
        position: "before_char",
        use_regex: true,
        extensions: {
          position: 0,
          exclude_recursion: false,
          display_index: 0,
          probability: 100,
          useProbability: true,
          depth: 4,
          selectiveLogic: 0,
          outlet_name: "",
          group: "",
          group_override: false,
          group_weight: 100,
          prevent_recursion: false,
          delay_until_recursion: false,
          scan_depth: 4,
          match_whole_words: true,
          use_group_scoring: false,
          case_sensitive: false,
          automation_id: "",
          role: 0,
          vectorized: false,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          match_persona_description: false,
          match_character_description: false,
          match_character_personality: false,
          match_character_depth_prompt: false,
          match_scenario: false,
          match_creator_notes: false,
          triggers: [],
          ignore_budget: false
        }
      }
    ]
  };

  return JSON.stringify(stLorebook, null, 2);
};

// Export standalone Worldbook / Lorebook JSON format
export const exportStandaloneLorebook = (project: CardProject): string => {
  const stEntries = project.lorebook.entries.map((entry, idx) => {
    return {
      id: entry.uid,
      keys: entry.key,
      secondary_keys: entry.secondary_keys || [],
      comment: entry.comment,
      content: entry.content,
      name: "",
      constant: entry.constant,
      selective: entry.selective,
      insertion_order: entry.order,
      enabled: entry.enabled,
      position: entry.position,
      use_regex: true,
      extensions: {
        position: positionToNumber(entry.position),
        exclude_recursion: entry.non_recursable ?? false,
        display_index: idx,
        probability: entry.probability ?? 100,
        useProbability: true,
        depth: entry.scan_depth ?? 4,
        selectiveLogic: entry.key_logic === 'and_any' ? 0 : entry.key_logic === 'and_all' ? 1 : entry.key_logic === 'not_any' ? 2 : 3,
        outlet_name: "",
        group: "",
        group_override: false,
        group_weight: entry.probability ?? 100,
        prevent_recursion: entry.prevent_recursion ?? false,
        delay_until_recursion: entry.delay_until_recursion ?? false,
        scan_depth: entry.scan_depth ?? 4,
        match_whole_words: entry.match_whole_words ?? true,
        use_group_scoring: false,
        case_sensitive: entry.case_sensitive ?? false,
        automation_id: "",
        role: 0,
        vectorized: entry.vectorized ?? false,
        sticky: entry.sticky ?? 0,
        cooldown: entry.cooldown ?? 0,
        delay: entry.delay ?? 0,
        match_persona_description: false,
        match_character_description: false,
        match_character_personality: false,
        match_character_depth_prompt: false,
        match_scenario: false,
        match_creator_notes: false,
        triggers: [],
        ignore_budget: entry.ignore_budget ?? false
      }
    };
  });

  return JSON.stringify({
    name: project.lorebook.name || `${project.charData.name} Worldbook`,
    description: project.lorebook.description || "",
    entries: stEntries
  }, null, 2);
};
