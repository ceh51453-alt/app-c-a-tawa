// Simulator Logic Unit Tests (Vanilla JS Version matching TS implementation)

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 1. scanLorebook
function scanLorebook(chatHistory, lorebook) {
  const injectedEntries = [];
  const log = [];

  if (!lorebook || !lorebook.entries) {
    return { injectedEntries, log };
  }

  const scanMessages = chatHistory.slice(-3);
  const scanText = scanMessages.map(m => m.content).join('\n');

  lorebook.entries.forEach(entry => {
    if (!entry.enabled) return;

    if (entry.constant) {
      injectedEntries.push(entry);
      return;
    }

    const keywords = entry.key || [];
    let isMatched = false;

    if (keywords.length === 0) return;

    const logic = entry.key_logic || 'and_any'; 
    const caseSensitive = entry.case_sensitive || false;
    const matchWholeWords = entry.match_whole_words !== false;

    const checkMatch = (kw) => {
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
    } else if (logic === 'and_all') {
      isMatched = keywords.length > 0 && keywords.every(checkMatch);
    }

    if (isMatched) {
      injectedEntries.push(entry);
    }
  });

  injectedEntries.sort((a, b) => (a.order || 0) - (b.order || 0));
  return { injectedEntries, log };
}

// 2. evaluateTemplate
function evaluateTemplate(template, characterName, userState) {
  if (!template) return '';
  
  let result = template;
  result = result.replace(/\{\{char\}\}/gi, characterName || 'Char');
  result = result.replace(/\{\{user\}\}/gi, 'You');
  
  const ejsRegex = /<%=\s*([\s\S]*?)\s*%>/g;
  result = result.replace(ejsRegex, (match, expression) => {
    try {
      const trimmedExpr = expression.trim();
      
      const getvarMatch = trimmedExpr.match(/getvar\(['"]([\s\S]*?)['"]\)/);
      if (getvarMatch) {
        const path = getvarMatch[1];
        const val = getNestedValue(userState, path);
        return val !== undefined ? String(val) : '';
      }

      if (trimmedExpr === 'name') return characterName || 'Char';
      
      if (userState && userState[trimmedExpr] !== undefined) {
        return String(userState[trimmedExpr]);
      }
      return '';
    } catch (e) {
      return '';
    }
  });

  return result;
}

const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

// 3. extractJsonPatchFromText
function extractJsonPatchFromText(text) {
  const patches = [];
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
    } catch (e) {
      log = `Lỗi phân tích cú pháp JSON: ${e.message}`;
    }
  }
  return { patches, log };
}

// 4. applyJsonPatch
function applyJsonPatch(patchArray, currentState) {
  let state = JSON.parse(JSON.stringify(currentState));
  const appliedLog = [];

  patchArray.forEach((opObj) => {
    const { op, path, value } = opObj;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const parts = cleanPath.split('/');

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
      current[lastPart] = value;
      appliedLog.push(`replace ${path}`);
    } else if (op === 'delta') {
      const currentVal = Number(current[lastPart]) || 0;
      const delta = Number(value) || 0;
      current[lastPart] = currentVal + delta;
      appliedLog.push(`delta ${path}`);
    }
  });

  return { nextState: state, appliedLog };
}

// RUN TESTS
console.log("=== RUNNING SIMULATOR TESTS ===");
let failed = false;

// 1. Test Lorebook keyword matching
const mockLorebook = {
  entries: [
    { comment: 'Gươm ánh sáng', key: ['gươm', 'kiếm'], enabled: true, key_logic: 'and_any' },
    { comment: 'Bí mật', key: ['bí mật'], enabled: false, key_logic: 'and_any' },
    { comment: 'Cơ mật', key: ['mật', 'quân sự'], enabled: true, key_logic: 'and_all' }
  ]
};

const chatHistory = [
  { content: 'Tôi nhặt được một thanh gươm cũ.' }
];

const scan1 = scanLorebook(chatHistory, mockLorebook);
if (scan1.injectedEntries.length !== 1 || scan1.injectedEntries[0].comment !== 'Gươm ánh sáng') {
  console.error("ERROR: Lorebook scan failed to match OR keyword");
  failed = true;
} else {
  console.log("OK: Lorebook OR keyword scanning matched correctly");
}

const chatHistory2 = [
  { content: 'Đây là tài liệu mật của quân sự.' }
];
const scan2 = scanLorebook(chatHistory2, mockLorebook);
if (scan2.injectedEntries.length !== 1 || scan2.injectedEntries[0].comment !== 'Cơ mật') {
  console.error("ERROR: Lorebook scan failed to match AND keywords");
  failed = true;
} else {
  console.log("OK: Lorebook AND keywords scanning matched correctly");
}

// 2. Test template evaluation
const testState = {
  stat_data: {
    Player: {
      HP: 85
    }
  }
};
const template = "Xin chào {{char}}! Chỉ số HP của ta là <%= getvar('stat_data.Player.HP') %>.";
const evaluated = evaluateTemplate(template, "Rimuru", testState);
const expectedEvaluated = "Xin chào Rimuru! Chỉ số HP của ta là 85.";
if (evaluated !== expectedEvaluated) {
  console.error(`ERROR: Template evaluation failed. Got: "${evaluated}"`);
  failed = true;
} else {
  console.log("OK: Template evaluation succeeded");
}

// 3. Test JSONPatch extraction
const aiText = `Tôi sẽ tấn công bạn!
<JSONPatch>
[
  { "op": "delta", "path": "/stat_data/Player/HP", "value": -15 }
]
</JSONPatch>`;
const patchExtraction = extractJsonPatchFromText(aiText);
if (patchExtraction.patches.length !== 1 || patchExtraction.patches[0].op !== 'delta') {
  console.error("ERROR: JSON Patch extraction failed");
  failed = true;
} else {
  console.log("OK: JSON Patch extraction succeeded");
}

// 4. Test JSONPatch apply
const patchApply = applyJsonPatch(patchExtraction.patches, testState);
if (patchApply.nextState.stat_data.Player.HP !== 70) {
  console.error(`ERROR: JSON Patch apply failed. HP was ${patchApply.nextState.stat_data.Player.HP}, expected 70`);
  failed = true;
} else {
  console.log("OK: JSON Patch apply succeeded (HP delta check passed)");
}

if (!failed) {
  console.log("SUCCESS: All simulator tests passed!");
} else {
  process.exit(1);
}
