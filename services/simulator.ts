import { CharacterData, Lorebook, LorebookEntry, OpenAISettings, SimulatorMessage, RegexScript } from '../types';
import { jsonrepair } from 'jsonrepair';
import { normalizeOpenAiUrl } from './openai';

// Helper to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scan chat history and lorebook to find triggered entries
 */
export interface ParsedEntryContent {
  decorators: Set<string>;
  ifCondition?: string;
  body: string;
}

export const parseDecorators = (content: string): ParsedEntryContent => {
  const decorators = new Set<string>();
  let ifCondition: string | undefined = undefined;
  const lines = content.split(/\r?\n/);
  let bodyStartIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('@@if ')) {
      ifCondition = line.substring(5).trim();
      bodyStartIndex = i + 1;
    } else if (line.startsWith('@@')) {
      decorators.add(line);
      bodyStartIndex = i + 1;
    } else {
      break;
    }
  }
  
  const body = lines.slice(bodyStartIndex).join('\n');
  return { decorators, ifCondition, body };
};

export const createSandboxContext = (
  characterName: string,
  userState: any,
  helpers?: {
    getwi?: (name: any) => Promise<string>;
    activewi?: (name: any, force?: boolean) => Promise<void>;
    matchChatMessages?: (regex: any, options?: any) => boolean;
    lorebook?: Lorebook;
    chatHistory?: SimulatorMessage[];
    userName?: string;
    charData?: CharacterData;
  }
) => {
  const getvar = (path: string, options?: { defaults?: any }) => {
    const val = getNestedValue(userState, path);
    if (val === undefined && options && options.defaults !== undefined) {
      return options.defaults;
    }
    return val;
  };

  const setvar = (path: string, val: any) => {
    const updated = setNestedValue(userState, path, val);
    Object.assign(userState, updated);
  };

  const incvar = (path: string, val: any = 1) => {
    const numVal = Number(val);
    const current = Number(getvar(path, { defaults: 0 }));
    setvar(path, current + numVal);
  };

  const decvar = (path: string, val: any = 1) => {
    const numVal = Number(val);
    const current = Number(getvar(path, { defaults: 0 }));
    setvar(path, current - numVal);
  };

  const delvar = (path: string, indexOrKey?: any) => {
    const parts = parsePath(path);
    if (parts.length === 0) return;
    
    if (indexOrKey !== undefined) {
      const parent = getNestedValue(userState, path);
      if (parent && typeof parent === 'object') {
        delete parent[indexOrKey];
      }
    } else {
      const parentParts = parts.slice(0, -1);
      const lastKey = parts[parts.length - 1];
      const parent = parentParts.length === 0 ? userState : getNestedValue(userState, parentParts.join('.'));
      if (parent && typeof parent === 'object') {
        delete parent[lastKey];
      }
    }
  };

  const insvar = (path: string, val: any, indexOrKey?: any) => {
    let current = getvar(path);
    if (current === undefined || current === null) {
      current = indexOrKey !== undefined && typeof indexOrKey === 'number' ? [] : {};
      setvar(path, current);
    }
    
    if (Array.isArray(current)) {
      const idx = indexOrKey !== undefined ? Number(indexOrKey) : current.length;
      current.splice(idx, 0, val);
    } else if (current && typeof current === 'object') {
      const key = indexOrKey !== undefined ? String(indexOrKey) : `key_${Object.keys(current).length}`;
      current[key] = val;
    }
  };

  const define = (name: string, val: any, merge?: boolean) => {
    if (merge && typeof val === 'object') {
      const current = getvar(name);
      if (typeof current === 'object') {
        setvar(name, { ...current, ...val });
        return;
      }
    }
    setvar(name, val);
  };

  const patchVariables = (path: string, changes: any[]) => {
    if (!Array.isArray(changes)) return;
    const target = getvar(path);
    if (!target || typeof target !== 'object') return;
    
    changes.forEach((op: any) => {
      const subpath = op.path ? op.path.split('/').filter(Boolean).join('.') : '';
      const fullPath = subpath ? `${path}.${subpath}` : path;
      if (op.op === 'replace' || op.op === 'add') {
        setvar(fullPath, op.value);
      } else if (op.op === 'remove') {
        delvar(fullPath);
      } else if (op.op === 'move') {
        const fromSub = op.from ? op.from.split('/').filter(Boolean).join('.') : '';
        const fromPath = fromSub ? `${path}.${fromSub}` : path;
        const val = getvar(fromPath);
        delvar(fromPath);
        setvar(fullPath, val);
      }
    });
  };

  const getwi = helpers?.getwi || (async (name: any) => {
    if (!helpers?.lorebook?.entries) return '';
    const nameStr = String(name).trim();
    const entry = helpers.lorebook.entries.find(e => 
      e.comment === nameStr || 
      String(e.uid) === nameStr || 
      (e.key && e.key.includes(nameStr))
    );
    return entry ? entry.content : '';
  });

  const activewi = helpers?.activewi || (async () => {});

  const getEnabledWorldInfoEntries = () => {
    return helpers?.lorebook?.entries.filter(e => e.enabled) || [];
  };

  const getWorldInfoData = (name?: string) => {
    return helpers?.lorebook?.entries || [];
  };

  const getchar = async (name?: string) => {
    return {
      name: helpers?.charData?.name || characterName || 'Char',
      description: helpers?.charData?.description || '',
      personality: helpers?.charData?.personality || '',
      scenario: helpers?.charData?.scenario || '',
      first_mes: helpers?.charData?.first_mes || '',
      system_prompt: helpers?.charData?.system_prompt || '',
      post_history_instructions: helpers?.charData?.post_history_instructions || '',
      creator_notes: helpers?.charData?.creator_notes || ''
    };
  };

  const getCharData = async (name?: string) => {
    return getchar(name);
  };

  const getpreset = async () => '';
  const getqr = async () => '';
  const getQuickReplyData = () => [];

  const getChatMessage = (idx: any, role?: string) => {
    const idxNum = Number(idx);
    const chat = helpers?.chatHistory || [];
    const filtered = role ? chat.filter(m => m.role === role) : chat;
    const targetIdx = idxNum < 0 ? filtered.length + idxNum : idxNum;
    const msg = filtered[targetIdx];
    return msg ? {
      message: msg.content,
      role: msg.role,
      is_user: msg.role === 'user',
      is_system: msg.role === 'system',
      name: msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? characterName : 'System')
    } : null;
  };

  const getChatMessages = (start: any, end?: any, role?: string) => {
    const chat = helpers?.chatHistory || [];
    if (typeof start === 'number' && end === undefined && role === undefined) {
      return chat.slice(-start).map(msg => ({
        message: msg.content,
        role: msg.role,
        is_user: msg.role === 'user',
        is_system: msg.role === 'system',
        name: msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? characterName : 'System')
      }));
    }
    const filtered = role ? chat.filter(m => m.role === role) : chat;
    const s = typeof start === 'number' ? start : 0;
    const e = typeof end === 'number' ? end : filtered.length;
    return filtered.slice(s, e).map(msg => ({
      message: msg.content,
      role: msg.role,
      is_user: msg.role === 'user',
      is_system: msg.role === 'system',
      name: msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? characterName : 'System')
    }));
  };

  const matchChatMessages = helpers?.matchChatMessages || (() => false);

  const mockLodash = {
    get: (obj: any, path: string, defaultValue?: any) => {
      const val = getNestedValue(obj, path);
      return val !== undefined ? val : defaultValue;
    },
    random: (min: number, max: number, floating?: boolean) => {
      if (floating) {
        return Math.random() * (max - min) + min;
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    sample: (arr: any[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      return arr[Math.floor(Math.random() * arr.length)];
    }
  };

  const mockYAML = {
    stringify: (obj: any) => toYamlString(obj)
  };

  const toastr = {
    info: (...args: any[]) => console.info('[toastr info]', ...args),
    success: (...args: any[]) => console.log('[toastr success]', ...args),
    warning: (...args: any[]) => console.warn('[toastr warning]', ...args),
    error: (...args: any[]) => console.error('[toastr error]', ...args)
  };

  const parseJSON = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      try {
        return JSON.parse(jsonrepair(text));
      } catch {
        return null;
      }
    }
  };

  const jsonPatch = (dest: any, changes: any[]) => {
    if (!dest || !Array.isArray(changes)) return dest;
    changes.forEach((op: any) => {
      const subpath = op.path ? op.path.split('/').filter(Boolean).join('.') : '';
      if (op.op === 'replace' || op.op === 'add') {
        const parts = parsePath(subpath);
        if (parts.length > 0) {
          const updated = setNestedValue(dest, subpath, op.value);
          Object.assign(dest, updated);
        }
      }
    });
    return dest;
  };

  const evalTemplate = async (content: string, data?: any) => {
    const state = data || userState;
    return evaluateTemplate(content, characterName, state, helpers);
  };

  const injectPrompt = () => {};
  const getPromptsInjected = () => [];
  const hasPromptsInjected = () => false;
  const activateRegex = () => {};
  const getSyntaxErrorInfo = () => null;
  const execute = async () => '';

  const context: any = {
    getvar,
    setvar,
    incvar,
    decvar,
    delvar,
    insvar,
    define,
    patchVariables,
    getwi,
    activewi,
    getEnabledWorldInfoEntries,
    getWorldInfoData,
    getchar,
    getCharData,
    getpreset,
    getqr,
    getQuickReplyData,
    getChatMessage,
    getChatMessages,
    matchChatMessages,
    toastr,
    alert: (...args: any[]) => console.warn('[alert]', ...args),
    parseJSON,
    jsonPatch,
    evalTemplate,
    injectPrompt,
    getPromptsInjected,
    hasPromptsInjected,
    activateRegex,
    getSyntaxErrorInfo,
    execute,
    _: mockLodash,
    YAML: mockYAML,
    variables: userState
  };

  if (userState && typeof userState === 'object') {
    Object.entries(userState).forEach(([key, val]) => {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
        context[key] = val;
      }
    });
  }

  return context;
};

export const evaluateCondition = async (
  condExpr: string,
  characterName: string,
  userState: any,
  helpers?: any
): Promise<boolean> => {
  let processedExpr = condExpr;
  processedExpr = processedExpr.replace(/\{\{char\}\}/gi, characterName || 'Char');
  processedExpr = processedExpr.replace(/\{\{user\}\}/gi, helpers?.userName || 'You');

  const jsCode = `return Boolean(${processedExpr});`;
  const context = createSandboxContext(characterName, userState, helpers);

  try {
    const fnKeys = Object.keys(context);
    const fnValues = Object.values(context);
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction(...fnKeys, jsCode);
    return await fn(...fnValues);
  } catch (e: any) {
    console.error('Error evaluating condition:', e, '\nExpression:', condExpr);
    return false;
  }
};

const createEjsHelpers = (
  lorebook: Lorebook | undefined,
  mockState: any,
  characterName: string,
  forcedActiveEntries: Set<string>,
  evaluatedContents: Map<string, string>,
  chatHistory?: SimulatorMessage[],
  charData?: CharacterData
) => {
  const getwi = async (name: any): Promise<string> => {
    if (!lorebook || !lorebook.entries) return '';
    const nameStr = String(name).trim();
    
    const entry = lorebook.entries.find(e => 
      e.comment === nameStr || 
      String(e.uid) === nameStr || 
      (e.key && e.key.includes(nameStr))
    );
    
    if (!entry) return '';
    
    const cached = evaluatedContents.get(String(entry.uid));
    if (cached !== undefined) return cached;
    
    evaluatedContents.set(String(entry.uid), '');
    
    const { decorators, body } = parseDecorators(entry.content || '');
    
    const evaluated = await evaluateTemplate(body, characterName, mockState, {
      getwi,
      activewi,
      matchChatMessages,
      lorebook,
      chatHistory,
      userName: 'You',
      charData
    });
    
    evaluatedContents.set(String(entry.uid), evaluated);
    return evaluated;
  };

  const activewi = async (name: any, force?: boolean): Promise<void> => {
    if (!lorebook || !lorebook.entries) return;
    const nameStr = String(name).trim();
    
    const entry = lorebook.entries.find(e => 
      e.comment === nameStr || 
      String(e.uid) === nameStr || 
      (e.key && e.key.includes(nameStr))
    );
    
    if (entry) {
      forcedActiveEntries.add(String(entry.uid));
    }
  };

  const matchChatMessages = (regexInput: any, options?: any): boolean => {
    if (!chatHistory || chatHistory.length === 0) return false;
    
    let pattern = '';
    let flags = 'i';
    
    if (regexInput instanceof RegExp) {
      pattern = regexInput.source;
      flags = regexInput.flags;
    } else {
      const slashRegex = parseSlashRegex(String(regexInput));
      if (slashRegex) {
        pattern = slashRegex.pattern;
        flags = slashRegex.flags;
      } else {
        pattern = escapeRegExp(String(regexInput));
      }
    }
    
    try {
      const r = new RegExp(pattern, flags);
      const limit = options?.limit || 3;
      const textToMatch = chatHistory.slice(-limit).map(m => m.content).join('\n');
      return r.test(textToMatch);
    } catch (e) {
      console.warn("Invalid regex in matchChatMessages:", e);
      return false;
    }
  };

  return { getwi, activewi, matchChatMessages, charData };
};

/**
 * Scan chat history and lorebook to find triggered entries asynchronously
 */
export const scanLorebook = async (
  chatHistory: SimulatorMessage[],
  lorebook: Lorebook,
  mockState: any,
  characterName: string,
  userName: string = 'You',
  charData?: CharacterData
): Promise<{ injectedEntries: LorebookEntry[]; log: string[] }> => {
  const injectedEntries: LorebookEntry[] = [];
  const log: string[] = [];

  if (!lorebook || !lorebook.entries) {
    return { injectedEntries, log };
  }

  const forcedActiveEntries = new Set<string>();
  const evaluatedContents = new Map<string, string>();
  
  const helpers = createEjsHelpers(lorebook, mockState, characterName, forcedActiveEntries, evaluatedContents, chatHistory, charData);

  // 1. Run @@preprocessing EJS templates for all enabled entries
  log.push(`Khởi tạo tiền xử lý (Preprocessing) cho Lorebook entries...`);
  
  for (const entry of lorebook.entries) {
    if (!entry.enabled) continue;
    
    const { decorators, body } = parseDecorators(entry.content || '');
    if (decorators.has('@@preprocessing')) {
      try {
        const evaluated = await evaluateTemplate(body, characterName, mockState, {
          ...helpers,
          lorebook,
          chatHistory,
          userName,
          charData
        });
        evaluatedContents.set(String(entry.uid), evaluated);
        log.push(`[Preprocessing] Đã chạy tiền xử lý cho mục: "${entry.comment}"`);
      } catch (e: any) {
        log.push(`[Preprocessing Error] Lỗi ở mục "${entry.comment}": ${e.message}`);
      }
    }
  }

  // 2. Chaining / Recursive Keyword Scan Loop
  const scanMessages = chatHistory.slice(-3);
  let scanText = scanMessages.map(m => m.content).join('\n');
  
  log.push(`Bắt đầu quét Lorebook. Ngữ cảnh chat ban đầu: "${scanText.substring(0, 100)}..."`);
  
  const processedUids = new Set<string>();
  let newActivations = true;
  let iteration = 0;
  const maxIterations = 5;

  while (newActivations && iteration < maxIterations) {
    newActivations = false;
    iteration++;
    log.push(`[Vòng quét #${iteration}] Quét từ khóa và điều kiện kích hoạt...`);

    for (const entry of lorebook.entries) {
      if (!entry.enabled) continue;
      const uidStr = String(entry.uid);
      if (processedUids.has(uidStr)) continue;

      const { decorators, ifCondition, body } = parseDecorators(entry.content || '');

      // Rule: @@dont_activate takes absolute precedence
      if (decorators.has('@@dont_activate')) {
        log.push(`[Bỏ qua] Mục "${entry.comment}" bị cấm kích hoạt bởi @@dont_activate.`);
        processedUids.add(uidStr);
        continue;
      }

      // Rule: @@if condition check
      if (ifCondition) {
        try {
          const isCondMet = await evaluateCondition(ifCondition, characterName, mockState, {
            ...helpers,
            lorebook,
            chatHistory,
            userName
          });
          if (!isCondMet) {
            log.push(`[Bỏ qua] Mục "${entry.comment}" không thỏa mãn điều kiện @@if: ${ifCondition}`);
            processedUids.add(uidStr);
            continue;
          }
        } catch (e: any) {
          log.push(`[Error @@if] Lỗi khi đánh giá điều kiện mục "${entry.comment}": ${e.message}`);
          processedUids.add(uidStr);
          continue;
        }
      }

      // Check if always active/forced active
      const isAlwaysActive = entry.constant || decorators.has('@@activate') || forcedActiveEntries.has(uidStr) || forcedActiveEntries.has(entry.comment);
      
      let isMatched = false;
      let matchReason = '';

      if (isAlwaysActive) {
        isMatched = true;
        matchReason = entry.constant ? 'Mục Constant' : (decorators.has('@@activate') ? 'Decorator @@activate' : 'Được kích hoạt bởi activewi');
      } else {
        // Keyword checking
        const keywords = entry.key || [];
        if (keywords.length > 0) {
          const logic = entry.key_logic || 'and_any';
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
            isMatched = keywords.some(checkMatch);
            if (isMatched) matchReason = `Khớp từ khóa OR: [${keywords.join(', ')}]`;
          } else if (logic === 'and_all') {
            isMatched = keywords.length > 0 && keywords.every(checkMatch);
            if (isMatched) matchReason = `Khớp từ khóa AND: [${keywords.join(', ')}]`;
          } else if (logic === 'not_any') {
            isMatched = !keywords.some(checkMatch);
            if (isMatched) matchReason = `Không khớp từ khóa NOT ANY: [${keywords.join(', ')}]`;
          } else if (logic === 'not_all') {
            isMatched = !keywords.every(checkMatch);
            if (isMatched) matchReason = `Khớp từ khóa NOT ALL: [${keywords.join(', ')}]`;
          }
        }
      }

      if (isMatched) {
        processedUids.add(uidStr);
        injectedEntries.push(entry);
        newActivations = true;
        log.push(`[Kích hoạt] "${entry.comment}" (${matchReason})`);

        // Append this entry's evaluated/raw content to scanText for chaining
        let contentToScan = evaluatedContents.get(uidStr);
        if (contentToScan === undefined) {
          contentToScan = body;
        }
        scanText += '\n' + contentToScan;
      }
    }
  }

  // Sort entries by order ascending
  injectedEntries.sort((a, b) => (a.order || 0) - (b.order || 0));

  return { injectedEntries, log };
};

// EJS compiler to generate compiled JS function string from EJS template
export const compileEjsTemplate = (template: string): string => {
  let code = 'let __output = "";\n';
  code += 'const print = (str) => { if (str !== undefined && str !== null) __output += String(str); };\n';
  
  let index = 0;
  const ejsTagRegex = /(<%(?:-|=|#|_)?)([\s\S]*?)((?:_)?%>)/g;
  let match;
  let trimNextLeading = false;
  
  while ((match = ejsTagRegex.exec(template)) !== null) {
    const openTag = match[1];
    const content = match[2];
    const closeTag = match[3];
    
    let textBefore = template.substring(index, match.index);
    if (trimNextLeading) {
      textBefore = textBefore.trimStart();
      trimNextLeading = false;
    }
    if (openTag.endsWith('_')) {
      textBefore = textBefore.trimEnd();
    }
    
    if (textBefore) {
      code += `__output += ${JSON.stringify(textBefore)};\n`;
    }
    
    if (openTag.startsWith('<%#')) {
      // Comment, do nothing
    } else if (openTag === '<%-' || openTag === '<%=') {
      code += `__output += String(${content});\n`;
    } else {
      // Execution block
      code += `${content}\n`;
    }
    
    if (closeTag.startsWith('_')) {
      trimNextLeading = true;
    }
    index = ejsTagRegex.lastIndex;
  }
  
  let textAfter = template.substring(index);
  if (trimNextLeading) {
    textAfter = textAfter.trimStart();
  }
  if (textAfter) {
    code += `__output += ${JSON.stringify(textAfter)};\n`;
  }
  
  code += 'return __output;';
  return code;
};

/**
 * Advanced asynchronous EJS template evaluator with sandboxed context
 */
export const evaluateTemplate = async (
  template: string,
  characterName: string,
  userState: any,
  helpers?: {
    getwi?: (name: any) => Promise<string>;
    activewi?: (name: any, force?: boolean) => Promise<void>;
    matchChatMessages?: (regex: any, options?: any) => boolean;
    lorebook?: Lorebook;
    chatHistory?: SimulatorMessage[];
    userName?: string;
    charData?: CharacterData;
  }
): Promise<string> => {
  if (!template) return '';
  
  let processedTemplate = template;
  processedTemplate = processedTemplate.replace(/\{\{char\}\}/gi, characterName || 'Char');
  processedTemplate = processedTemplate.replace(/\{\{user\}\}/gi, helpers?.userName || 'You');
  
  if (!processedTemplate.includes('<%')) {
    return evaluateMacros(processedTemplate, userState);
  }

  const jsCode = compileEjsTemplate(processedTemplate);
  const context = createSandboxContext(characterName, userState, helpers);

  try {
    const fnKeys = Object.keys(context);
    const fnValues = Object.values(context);
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction(...fnKeys, jsCode);
    
    let result = await fn(...fnValues);
    result = evaluateMacros(result, userState);
    return result;
  } catch (e: any) {
    console.error('Error evaluating EJS template:', e, '\nJS Code:', jsCode);
    return `[EJS Error: ${e.message}]`;
  }
};

// Helper to parse paths including bracket notation and JSON pointers
export const parsePath = (path: string): string[] => {
  if (!path) return [];
  // If JSON pointer path starting with '/'
  if (path.startsWith('/')) {
    return path.split('/').filter(Boolean).map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  }
  
  const result: string[] = [];
  let i = 0;
  
  while (i < path.length) {
    const char = path[i];
    if (char === '.') {
      i++;
    } else if (char === '[') {
      i++; // skip '['
      // Find matching ']'
      let inside = '';
      let quoteChar = '';
      if (i < path.length && (path[i] === '"' || path[i] === "'")) {
        quoteChar = path[i];
        i++; // skip quote
      }
      
      while (i < path.length) {
        if (quoteChar) {
          if (path[i] === quoteChar && path[i - 1] !== '\\') {
            i++; // skip quote
            break;
          }
          inside += path[i];
        } else {
          if (path[i] === ']') {
            break;
          }
          inside += path[i];
        }
        i++;
      }
      
      result.push(inside);
      
      // skip trailing spaces and final ']'
      while (i < path.length && path[i] !== ']') {
        i++;
      }
      if (i < path.length && path[i] === ']') {
        i++;
      }
    } else {
      let currentToken = '';
      while (i < path.length && path[i] !== '.' && path[i] !== '[') {
        currentToken += path[i];
        i++;
      }
      result.push(currentToken);
    }
  }
  return result;
};

// Helper for nested paths
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  const parts = parsePath(path);
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

export const toYamlString = (obj: any, indent: number = 0): string => {
  if (obj === null || obj === undefined) return '';
  const spaces = ' '.repeat(indent);
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        return `\n${spaces}- ${toYamlString(item, indent + 2).trim()}`;
      } else {
        return `\n${spaces}- ${item}`;
      }
    }).join('');
  }
  
  if (typeof obj === 'object') {
    return Object.entries(obj).map(([key, val]) => {
      if (val === null || val === undefined) {
        return `${spaces}${key}: null`;
      }
      if (Array.isArray(val)) {
        if (val.length === 0) return `${spaces}${key}: []`;
        return `${spaces}${key}:${toYamlString(val, indent + 2)}`;
      }
      if (typeof val === 'object') {
        return `${spaces}${key}:\n${toYamlString(val, indent + 2)}`;
      }
      if (typeof val === 'string') {
        if (val.includes('\n')) {
          const lines = val.split('\n').map(line => ' '.repeat(indent + 2) + line).join('\n');
          return `${spaces}${key}: |\n${lines}`;
        }
        if (val.includes(':') || val.includes('#') || val.startsWith('-') || val.includes('[') || val.includes(']')) {
          return `${spaces}${key}: "${val.replace(/"/g, '\\"')}"`;
        }
        return `${spaces}${key}: ${val}`;
      }
      return `${spaces}${key}: ${val}`;
    }).join('\n');
  }
  
  return String(obj);
};

export const evaluateMacros = (text: string, userState: any): string => {
  if (!text) return '';
  let result = text;

  // 1. Format message variable
  result = result.replace(/\{\{format_message_variable::([a-zA-Z0-9_\.\u00C0-\u1EF9\s\-\[\]'"]+?)\}\}/gi, (match, path) => {
    const val = getNestedValue(userState, path.trim());
    if (val === undefined) return '';
    if (typeof val === 'object' && val !== null) {
      return toYamlString(val);
    }
    return String(val);
  });

  // 2. Getvars macro
  result = result.replace(/\{\{getvars::([a-zA-Z0-9_\.\u00C0-\u1EF9\s\-\[\]'"]+?)\}\}/gi, (match, path) => {
    const val = getNestedValue(userState, path.trim());
    if (val === undefined) return '';
    if (typeof val === 'object' && val !== null) {
      return toYamlString(val);
    }
    return String(val);
  });

  return result;
};

const setNestedValue = (obj: any, path: string, value: any): any => {
  if (!obj || !path) return obj;
  const newObj = JSON.parse(JSON.stringify(obj)); // Deep clone
  const parts = parsePath(path);
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

export function parseSlashRegex(findRegex: string): { pattern: string; flags: string } | null {
  if (findRegex.startsWith('/') && findRegex.includes('/', 1)) {
    const match = findRegex.match(/^\/(.*)\/([gimsuy]*)$/s);
    if (match) {
      return {
        pattern: match[1],
        flags: match[2]
      };
    }
  }
  return null;
}

export function substituteMacros(str: string, charName: string, userName: string, escape: boolean): string {
  if (!str) return '';
  let result = str;
  const escapedChar = escape ? escapeRegExp(charName) : charName;
  const escapedUser = escape ? escapeRegExp(userName) : userName;

  result = result.replace(/\{\{char\}\}/gi, escapedChar);
  result = result.replace(/\{\{user\}\}/gi, escapedUser);
  return result;
}

export interface RegexOptions {
  depth?: number | null;
  charName?: string;
  userName?: string;
  isUiRender?: boolean;
  isApiPrompt?: boolean;
  userState?: any;
}

/**
 * Apply regex scripts matching a specific placement type with depth, macro, and flags support
 */
export const applyRegexByPlacement = (
  text: string,
  scripts: RegexScript[],
  placement: number,
  options?: RegexOptions
): string => {
  if (!text || !scripts) return text;
  let result = text.replace(/\r\n/g, '\n');

  const depth = options?.depth;
  const charName = options?.charName || 'Char';
  const userName = options?.userName || 'You';
  const isUiRender = options?.isUiRender || false;
  const isApiPrompt = options?.isApiPrompt || false;

  scripts.forEach(script => {
    if (!script.isactive) return;
    const placements = script.placement || [];
    if (!placements.includes(placement)) return;

    // 1. Depth check
    if (depth !== undefined && depth !== null) {
      if (script.minDepth !== null && script.minDepth !== undefined && depth < script.minDepth) {
        return;
      }
      if (script.maxDepth !== null && script.maxDepth !== undefined && depth > script.maxDepth) {
        return;
      }
    }

    // 2. Render / API / Raw constraints check
    if (isUiRender) {
      if (script.promptOnly) return;
    } else if (isApiPrompt) {
      if (script.markdownOnly) return;
    } else {
      if (script.markdownOnly || script.promptOnly) return;
    }

    try {
      // 3. Process search pattern with macro substitution if enabled
      let patternStr = script.findRegex;
      if (script.substituteRegex) {
        patternStr = substituteMacros(patternStr, charName, userName, true);
      }

      // 4. Parse slash syntax regex & flags
      let regex: RegExp;
      const slashRegex = parseSlashRegex(patternStr);
      if (slashRegex) {
        regex = new RegExp(slashRegex.pattern, slashRegex.flags);
      } else {
        regex = new RegExp(patternStr, 'g');
      }

      // 5. Process replacement string macros (always replaced)
      let replaceStr = script.replaceString || '';
      replaceStr = substituteMacros(replaceStr, charName, userName, false);
      if (options?.userState) {
        replaceStr = evaluateMacros(replaceStr, options.userState);
      }

      // 6. Execute replacement
      result = result.replace(regex, replaceStr);
    } catch (e) {
      console.warn(`Failed to apply regex script "${script.scriptName}":`, e);
    }
  });

  if (options?.userState) {
    result = evaluateMacros(result, options.userState);
  }

  return result;
};

/**
 * Splice depth-based lorebook entries into the chat history
 */
export const injectDepthEntries = async (
  history: SimulatorMessage[],
  depthEntries: LorebookEntry[],
  charName: string,
  mockState: any
): Promise<SimulatorMessage[]> => {
  if (depthEntries.length === 0) return history;

  const insertions: { index: number; order: number; msg: SimulatorMessage }[] = [];
  
  for (const entry of depthEntries) {
    const depth = entry.scan_depth || 0;
    const index = Math.max(0, history.length - depth);
    const role = entry.position === 'at_depth_system' 
      ? 'system' 
      : (entry.position === 'at_depth_user' ? 'user' : 'assistant');
    
    const evaluatedContent = await evaluateTemplate(entry.content || '', charName, mockState);
    
    insertions.push({
      index,
      order: entry.order || 0,
      msg: {
        id: `lorebook-${entry.uid}-${Date.now()}`,
        role,
        content: evaluatedContent,
        timestamp: Date.now(),
        injectedLorebook: [entry.comment]
      }
    });
  }

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
export const buildSillyTavernPrompt = async (
  charData: CharacterData,
  injectedEntries: LorebookEntry[],
  mockState: any
): Promise<{ 
  systemPrompt: string; 
  postHistoryInstructions: string; 
  depthEntries: LorebookEntry[];
  promptInjects: string; 
}> => {
  const charName = charData.name || 'Char';

  // Evaluate templates inside character attributes
  const helpers = { charData, userName: 'You' };
  const description = await evaluateTemplate(charData.description || '', charName, mockState, helpers);
  const personality = await evaluateTemplate(charData.personality || '', charName, mockState, helpers);
  const scenario = await evaluateTemplate(charData.scenario || '', charName, mockState, helpers);
  const sysPromptInput = await evaluateTemplate(charData.system_prompt || '', charName, mockState, helpers);
  const mesExample = await evaluateTemplate(charData.mes_example || '', charName, mockState, helpers);
  const creatorNotes = await evaluateTemplate(charData.creator_notes || '', charName, mockState, helpers);
  const postHistoryInstructions = await evaluateTemplate(charData.post_history_instructions || '', charName, mockState, helpers);

  // Group injected lorebook entries
  const compileEntries = async (pos: string): Promise<string> => {
    const filtered = injectedEntries.filter(e => e.position === pos);
    const compiledList: string[] = [];
    for (const e of filtered) {
      const evaluated = await evaluateTemplate(e.content || '', charName, mockState, helpers);
      compiledList.push(`[Lorebook: ${e.comment}]\n${evaluated}`);
    }
    return compiledList.join('\n\n');
  };

  const beforeCharLb = await compileEntries('before_char');
  const afterCharLb = await compileEntries('after_char');
  const beforeEmLb = await compileEntries('before_em');
  const afterEmLb = await compileEntries('after_em');
  const beforeAnLb = await compileEntries('before_an');
  const afterAnLb = await compileEntries('after_an');

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

      // Parse path using parsePath
      const parts = parsePath(path);

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
      let repaired = rawJson;
      try {
        repaired = jsonrepair(rawJson);
      } catch (e) {}
      const parsed = JSON.parse(repaired);
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
          let repaired = m;
          try {
            repaired = jsonrepair(m);
          } catch (e) {}
          const parsed = JSON.parse(repaired);
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
  charName: string = 'Char',
  userName: string = 'You',
  onProgress?: (partialContent: string) => void
): Promise<string> => {
  const url = normalizeOpenAiUrl(settings.baseUrl, 'chat/completions');

  const cleanSystemPrompt = applyRegexByPlacement(systemPrompt, regexScripts, 2, { charName, userName, isApiPrompt: true });
  const cleanPostHistoryInstructions = postHistoryInstructions
    ? applyRegexByPlacement(postHistoryInstructions, regexScripts, 2, { charName, userName, isApiPrompt: true })
    : '';

  const apiMessages = [
    { role: "system", content: cleanSystemPrompt },
    ...history.slice(-15).map((msg, index, arr) => {
      const depth = arr.length - 1 - index;
      return {
        role: msg.role === 'system' ? 'system' : (msg.role === 'user' ? 'user' : 'assistant'),
        content: applyRegexByPlacement(msg.content, regexScripts, 2, { depth, charName, userName, isApiPrompt: true })
      };
    })
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
