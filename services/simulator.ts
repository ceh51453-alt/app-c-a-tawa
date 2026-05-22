import { CharacterData, Lorebook, LorebookEntry, OpenAISettings, SimulatorMessage, RegexScript } from '../types';

// Helper to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scan chat history and lorebook to find triggered entries
 */
export const scanLorebook = (
  chatHistory: SimulatorMessage[],
  lorebook: Lorebook
): { injectedEntries: LorebookEntry[]; log: string[] } => {
  const injectedEntries: LorebookEntry[] = [];
  const log: string[] = [];

  if (!lorebook || !lorebook.entries) {
    return { injectedEntries, log };
  }

  // Combine last few messages to scan for keywords (standard ST scan depth)
  // Let's take the last 3 messages as scanning context
  const scanMessages = chatHistory.slice(-3);
  const scanText = scanMessages.map(m => m.content).join('\n');

  log.push(`Bắt đầu quét Lorebook với ngữ cảnh từ ${scanMessages.length} tin nhắn gần nhất.`);

  lorebook.entries.forEach(entry => {
    if (!entry.enabled) return;

    // Constant entries are always injected
    if (entry.constant) {
      injectedEntries.push(entry);
      log.push(`Đã kích hoạt mục Constant: "${entry.comment}"`);
      return;
    }

    // Check keywords matching
    const keywords = entry.key || [];
    let isMatched = false;

    if (keywords.length === 0) return;

    // Selective check
    // Currently support matching any key (OR) or all keys (AND)
    // Default key_logic logic
    const logic = entry.key_logic || 'and_any'; // and_any = OR, and_all = AND
    const caseSensitive = entry.case_sensitive || false;
    const matchWholeWords = entry.match_whole_words !== false;

    const checkMatch = (kw: string): boolean => {
      if (!kw.trim()) return false;
      let pattern = escapeRegExp(kw.trim());
      if (matchWholeWords) {
        pattern = `(?<=^|[^a-zA-Z0-9\\u00C0-\\u1EF9_])${pattern}(?=$|[^a-zA-Z0-9\\u00C0-\\u1EF9_])`;
      }
      const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
      return regex.test(scanText);
    };

    if (logic === 'and_any') {
      // At least one keyword matches
      isMatched = keywords.some(checkMatch);
    } else if (logic === 'and_all') {
      // All keywords must match
      isMatched = keywords.length > 0 && keywords.every(checkMatch);
    } else if (logic === 'not_any') {
      // None of the keywords should match
      isMatched = !keywords.some(checkMatch);
    } else if (logic === 'not_all') {
      // At least one keyword should NOT match
      isMatched = !keywords.every(checkMatch);
    }

    if (isMatched) {
      injectedEntries.push(entry);
      log.push(`Đã kích hoạt mục: "${entry.comment}" (khớp từ khóa: [${keywords.join(', ')}])`);
    }
  });

  // Sort entries by order ascending
  injectedEntries.sort((a, b) => (a.order || 0) - (b.order || 0));

  return { injectedEntries, log };
};

/**
 * Basic template evaluator for EJS-like syntax inside character description/scenario
 */
export const evaluateTemplate = (template: string, characterName: string, userState: any): string => {
  if (!template) return '';
  
  let result = template;
  // Replace standard SillyTavern placeholders
  result = result.replace(/\{\{char\}\}/gi, characterName || 'Char');
  result = result.replace(/\{\{user\}\}/gi, 'You');
  
  // Custom evaluator for getvar/lodash get
  // e.g. <%= getvar('stat_data.Nhân vật.Cấp độ') %>
  // We will support a simple replacement of <%= variable %> using lodash-like syntax
  const ejsRegex = /<%=\s*([\s\S]*?)\s*%>/g;
  result = result.replace(ejsRegex, (match, expression) => {
    try {
      const trimmedExpr = expression.trim();
      
      // If it is getvar('path') or getvar("path")
      const getvarMatch = trimmedExpr.match(/getvar\(['"]([\s\S]*?)['"]\)/);
      if (getvarMatch) {
        const path = getvarMatch[1];
        const val = getNestedValue(userState, path);
        return val !== undefined ? String(val) : '';
      }

      // If it refers to direct properties like name, scenario, etc.
      if (trimmedExpr === 'name') return characterName || 'Char';
      
      // Evaluate generic JS properties in userState
      if (userState && userState[trimmedExpr] !== undefined) {
        return String(userState[trimmedExpr]);
      }
      return '';
    } catch (e) {
      return '';
    }
  });

  return result;
};

// Helper for nested paths
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

const setNestedValue = (obj: any, path: string, value: any): any => {
  if (!obj || !path) return obj;
  const newObj = JSON.parse(JSON.stringify(obj)); // Deep clone
  const parts = path.startsWith('/') ? path.split('/').filter(p => p) : path.split('.');
  let current = newObj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
  return newObj;
};

/**
 * Apply regex scripts matching a specific placement type
 */
export const applyRegexByPlacement = (
  text: string,
  scripts: RegexScript[],
  placement: number
): string => {
  if (!text || !scripts) return text;
  let result = text;
  scripts.forEach(script => {
    if (!script.isactive) return;
    const placements = script.placement || [];
    if (!placements.includes(placement)) return;

    try {
      const regex = new RegExp(script.findRegex, 'g');
      result = result.replace(regex, script.replaceString);
    } catch (e) {
      // Silently skip if invalid regex
    }
  });
  return result;
};

/**
 * Splice depth-based lorebook entries into the chat history
 */
export const injectDepthEntries = (
  history: SimulatorMessage[],
  depthEntries: LorebookEntry[],
  charName: string,
  mockState: any
): SimulatorMessage[] => {
  if (depthEntries.length === 0) return history;

  const insertions: { index: number; order: number; msg: SimulatorMessage }[] = [];
  
  depthEntries.forEach(entry => {
    const depth = entry.scan_depth || 0;
    const index = Math.max(0, history.length - depth);
    const role = entry.position === 'at_depth_system' 
      ? 'system' 
      : (entry.position === 'at_depth_user' ? 'user' : 'assistant');
    
    insertions.push({
      index,
      order: entry.order || 0,
      msg: {
        id: `lorebook-${entry.uid}-${Date.now()}`,
        role,
        content: evaluateTemplate(entry.content, charName, mockState),
        timestamp: Date.now(),
        injectedLorebook: [entry.comment]
      }
    });
  });

  // Sort insertions: primary by index ascending, secondary by order ascending
  insertions.sort((a, b) => {
    if (a.index !== b.index) {
      return a.index - b.index;
    }
    return a.order - b.order;
  });

  const resultHistory = [...history];
  let offset = 0;
  insertions.forEach(ins => {
    resultHistory.splice(ins.index + offset, 0, ins.msg);
    offset++;
  });

  return resultHistory;
};

/**
 * Build the system prompt and context for SillyTavern Simulator
 */
export const buildSillyTavernPrompt = (
  charData: CharacterData,
  injectedEntries: LorebookEntry[],
  mockState: any
): { 
  systemPrompt: string; 
  postHistoryInstructions: string; 
  depthEntries: LorebookEntry[];
  promptInjects: string; 
} => {
  const charName = charData.name || 'Char';

  // Evaluate templates inside character attributes
  const description = evaluateTemplate(charData.description || '', charName, mockState);
  const personality = evaluateTemplate(charData.personality || '', charName, mockState);
  const scenario = evaluateTemplate(charData.scenario || '', charName, mockState);
  const sysPromptInput = evaluateTemplate(charData.system_prompt || '', charName, mockState);
  const mesExample = evaluateTemplate(charData.mes_example || '', charName, mockState);
  const creatorNotes = evaluateTemplate(charData.creator_notes || '', charName, mockState);
  const postHistoryInstructions = evaluateTemplate(charData.post_history_instructions || '', charName, mockState);

  // Group injected lorebook entries
  const compileEntries = (pos: string): string => {
    return injectedEntries
      .filter(e => e.position === pos)
      .map(e => `[Lorebook: ${e.comment}]\n${evaluateTemplate(e.content, charName, mockState)}`)
      .join('\n\n');
  };

  const beforeCharLb = compileEntries('before_char');
  const afterCharLb = compileEntries('after_char');
  const beforeEmLb = compileEntries('before_em');
  const afterEmLb = compileEntries('after_em');
  const beforeAnLb = compileEntries('before_an');
  const afterAnLb = compileEntries('after_an');

  const depthEntries = injectedEntries.filter(e => 
    e.position === 'at_depth_system' || 
    e.position === 'at_depth_user' || 
    e.position === 'at_depth_assistant'
  );

  let systemPrompt = `You are a creative roleplay engine simulating a SillyTavern character.
Your main objective is to write the next response for the character: ${charName}.

${sysPromptInput || `Roleplay Guideline:
- Stay in character at all times.
- Write descriptive actions in asterisks, e.g., *mỉm cười nhẹ* or *nhìn quanh*.
- Avoid speak for the user.`}`;

  if (beforeCharLb) {
    systemPrompt += `\n\n=== BEFORE CHAR LOREBOOK ===\n${beforeCharLb}`;
  }

  systemPrompt += `\n\n=== CHARACTER DESCRIPTION ===
Name: ${charName}
Personality: ${personality}
Description: ${description}
Scenario: ${scenario}`;

  if (afterCharLb) {
    systemPrompt += `\n\n=== AFTER CHAR LOREBOOK ===\n${afterCharLb}`;
  }

  if (creatorNotes) {
    systemPrompt += `\n\n=== CREATOR NOTES ===\n${creatorNotes}`;
  }

  if (beforeEmLb) {
    systemPrompt += `\n\n=== BEFORE EXAMPLE DIALOGUE LOREBOOK ===\n${beforeEmLb}`;
  }

  if (mesExample) {
    const dialogues = mesExample
      .split(/<START>/i)
      .map(d => d.trim())
      .filter(Boolean);
    
    if (dialogues.length > 0) {
      systemPrompt += `\n\n=== EXAMPLE DIALOGUES ===\n` + dialogues.map((d, i) => `[Example Dialogue #${i+1}]\n${d}`).join('\n\n');
    }
  }

  if (afterEmLb) {
    systemPrompt += `\n\n=== AFTER EXAMPLE DIALOGUE LOREBOOK ===\n${afterEmLb}`;
  }

  // Compile postHistoryInstructions
  let finalPostHistoryInstructions = '';
  
  if (beforeAnLb) {
    finalPostHistoryInstructions += `=== BEFORE AUTHOR'S NOTE LOREBOOK ===\n${beforeAnLb}\n\n`;
  }

  if (postHistoryInstructions) {
    finalPostHistoryInstructions += `${postHistoryInstructions}\n\n`;
  }

  if (charData.zod_schema || charData.mvu_dictionary) {
    finalPostHistoryInstructions += `=== MVU DỰ PHÒNG CẬP NHẬT BIẾN SỐ ===
Bạn đang đóng vai nhân vật trong trò chơi RPG. Bạn có nhiệm vụ duy trì trạng thái của thế giới và nhân vật.
Dựa trên hành động trong cuộc trò chuyện, bạn PHẢI cập nhật các biến số tương ứng bằng cách chèn thẻ <UpdateVariable> vào CUỐI tin nhắn phản hồi của bạn.
Cấu trúc bắt buộc ở cuối câu trả lời của bạn:
<UpdateVariable>
<Analysis>
Giải thích ngắn gọn thay đổi chỉ số bằng tiếng Anh (tối đa 80 từ).
</Analysis>
<JSONPatch>
[
  { "op": "replace", "path": "/stat_data/Nhân vật/HP", "value": 90 },
  { "op": "delta", "path": "/stat_data/Nhân vật/Vàng", "value": -10 }
]
</JSONPatch>
</UpdateVariable>

Lưu ý:
- Chỉ cập nhật khi có biến đổi (ví dụ: bị tấn công mất HP, mua đồ mất Vàng, làm nhiệm vụ nhận exp, tăng hảo cảm, di chuyển sang vùng khác).
- Cú pháp JSONPatch tuân thủ chuẩn RFC 6902: op có thể là "replace", "delta" (cho phép cộng/trừ số), "insert", "remove".
- path phải bắt đầu bằng dấu gạch chéo (/), ví dụ: /stat_data/Nhân vật/Vàng.
- KHÔNG cập nhật trùng lặp nếu hành động đó đã được xử lý trong tin nhắn trước.
`;
  }

  if (afterAnLb) {
    if (finalPostHistoryInstructions && !finalPostHistoryInstructions.endsWith('\n\n')) {
      finalPostHistoryInstructions += '\n\n';
    }
    finalPostHistoryInstructions += `=== AFTER AUTHOR'S NOTE LOREBOOK ===\n${afterAnLb}`;
  }

  return {
    systemPrompt,
    postHistoryInstructions: finalPostHistoryInstructions.trim(),
    depthEntries,
    promptInjects: `Description: ${description.substring(0, 100)}... Injected Lorebooks: ${injectedEntries.map(e => e.comment).join(', ') || 'None'}`
  };
};

/**
 * Apply JSON Patch operations on mock state
 */
export const applyJsonPatch = (patchArray: any[], currentState: any): { nextState: any; appliedLog: string[] } => {
  let state = JSON.parse(JSON.stringify(currentState));
  const appliedLog: string[] = [];

  if (!Array.isArray(patchArray)) {
    return { nextState: state, appliedLog: ['Lỗi: JSON Patch không phải là mảng.'] };
  }

  patchArray.forEach((opObj, idx) => {
    try {
      const { op, path, value } = opObj;
      if (!op || !path) {
        appliedLog.push(`[Op #${idx}] Bỏ qua vì thiếu op hoặc path.`);
        return;
      }

      // Convert path "/stat_data/Nhân vật/HP" to nested keys
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const parts = cleanPath.split('/');

      // Helper to traverse and retrieve parent container
      let current = state;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined) {
          current[part] = {};
        }
        current = current[part];
      }

      const lastPart = parts[parts.length - 1];

      if (op === 'replace') {
        const oldVal = current[lastPart];
        current[lastPart] = value;
        appliedLog.push(`[Replace] ${path}: ${JSON.stringify(oldVal)} -> ${JSON.stringify(value)}`);
      } else if (op === 'delta') {
        const currentVal = Number(current[lastPart]) || 0;
        const delta = Number(value) || 0;
        const newVal = currentVal + delta;
        current[lastPart] = newVal;
        appliedLog.push(`[Delta] ${path}: ${currentVal} (${delta >= 0 ? '+' : ''}${delta}) -> ${newVal}`);
      } else if (op === 'insert') {
        if (Array.isArray(current[lastPart])) {
          current[lastPart].push(value);
          appliedLog.push(`[Insert Array] ${path} <- ${JSON.stringify(value)}`);
        } else if (typeof current[lastPart] === 'object' && current[lastPart] !== null) {
          // Object insert (like key-value)
          if (value && typeof value === 'object') {
            current[lastPart] = { ...current[lastPart], ...value };
            appliedLog.push(`[Insert Object] ${path} <- ${JSON.stringify(value)}`);
          }
        } else {
          // If not exists, initialize as array or set direct
          current[lastPart] = [value];
          appliedLog.push(`[Insert New Array] ${path} <- ${JSON.stringify(value)}`);
        }
      } else if (op === 'remove') {
        if (Array.isArray(current)) {
          const index = Number(lastPart);
          if (!isNaN(index)) {
            current.splice(index, 1);
            appliedLog.push(`[Remove Index] ${path}`);
          }
        } else {
          delete current[lastPart];
          appliedLog.push(`[Remove Key] ${path}`);
        }
      } else {
        appliedLog.push(`[Op #${idx}] Không hỗ trợ phép toán: ${op}`);
      }
    } catch (e: any) {
      appliedLog.push(`[Op #${idx}] Lỗi khi áp dụng patch: ${e.message}`);
    }
  });

  return { nextState: state, appliedLog };
};

/**
 * Extracts JSON Patch array from AI response string
 */
export const extractJsonPatchFromText = (text: string): { patches: any[]; log: string } => {
  const patches: any[] = [];
  let log = '';

  const jsonPatchMatch = text.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/i);
  if (jsonPatchMatch) {
    try {
      const rawJson = jsonPatchMatch[1].trim();
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        patches.push(...parsed);
        log = 'Tìm thấy thẻ <JSONPatch> hợp lệ.';
      } else {
        log = 'Thẻ <JSONPatch> chứa JSON nhưng không phải mảng.';
      }
    } catch (e: any) {
      log = `Lỗi phân tích cú pháp JSON trong <JSONPatch>: ${e.message}`;
    }
  } else {
    // Fallback: search for any array of patch objects if tag not explicitly found
    const arrayRegex = /\[\s*\{\s*"op"\s*:[\s\S]*?\}\s*\]/g;
    const matches = text.match(arrayRegex);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        try {
          const parsed = JSON.parse(m);
          if (Array.isArray(parsed) && parsed.some(op => op.op && op.path)) {
            patches.push(...parsed);
            log = 'Trích xuất JSON Patch thành công từ nội dung văn bản.';
            break;
          }
        } catch (e) {}
      }
    }
  }

  if (patches.length === 0 && !log) {
    log = 'Không tìm thấy cập nhật biến số (JSONPatch) trong phản hồi của AI.';
  }

  return { patches, log };
};

/**
 * Call the OpenAI/Gemini API to generate the character response in the simulator
 */
export const sendSimulatorMessage = async (
  settings: OpenAISettings,
  systemPrompt: string,
  history: SimulatorMessage[],
  postHistoryInstructions: string,
  regexScripts: RegexScript[],
  onProgress?: (partialContent: string) => void
): Promise<string> => {
  let url = settings.baseUrl.endsWith('/') ? settings.baseUrl : `${settings.baseUrl}/`;
  if (!url.includes('/v1/')) {
    url = `${url}v1/chat/completions`;
  } else {
    url = `${url}chat/completions`;
  }

  const cleanSystemPrompt = applyRegexByPlacement(systemPrompt, regexScripts, 2);
  const cleanPostHistoryInstructions = postHistoryInstructions
    ? applyRegexByPlacement(postHistoryInstructions, regexScripts, 2)
    : '';

  const apiMessages = [
    { role: "system", content: cleanSystemPrompt },
    ...history.slice(-15).map(msg => ({
      role: msg.role === 'system' ? 'system' : (msg.role === 'user' ? 'user' : 'assistant'),
      content: applyRegexByPlacement(msg.content, regexScripts, 2)
    }))
  ];

  if (cleanPostHistoryInstructions) {
    apiMessages.push({ role: "system", content: cleanPostHistoryInstructions });
  }

  const payload: any = {
    model: settings.model,
    messages: apiMessages,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    top_p: settings.topP,
    stream: settings.streaming
  };

  if (settings.topK > 0) payload.top_k = settings.topK;

  let fullContent = "";

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Lỗi API HTTP: ${response.status}`);
  }

  if (settings.streaming && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta?.content || "";
            if (delta) {
              fullContent += delta;
              if (onProgress) onProgress(fullContent);
            }
          } catch (e) {}
        }
      }
    }
  } else {
    const data = await response.json();
    fullContent = data.choices?.[0]?.message?.content || "";
    if (onProgress) onProgress(fullContent);
  }

  return fullContent;
};
