// Zod Schema Variable Parser (Vanilla JS Version matching TS implementation)
function parseZodSchema(schemaText) {
  const vars = [];
  if (!schemaText) return vars;

  const lines = schemaText.split('\n');
  const stack = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Check if we are opening a z.object
    const objectMatch = line.match(/^([\w\u00C0-\u1EF9]+|['"][\s\S]+?['"])\s*:\s*z\s*\.\s*object\s*\(\s*\{/);
    if (objectMatch) {
      const rawKey = objectMatch[1];
      const key = rawKey.replace(/['"]/g, ''); // strip quotes
      stack.push(key);
      continue;
    }
    
    // Check if we are closing a z.object
    if (line.startsWith('}') || line.startsWith('})')) {
      stack.pop();
      continue;
    }
    
    // Check for a leaf property
    const leafMatch = line.match(/^([\w\u00C0-\u1EF9]+|['"][\s\S]+?['"])\s*:\s*z\s*\.\s*(.+)$/);
    if (leafMatch) {
      const rawKey = leafMatch[1];
      const key = rawKey.replace(/['"]/g, '');
      const definition = leafMatch[2];
      
      const fullPath = [...stack, key].join('.');
      
      // Determine type
      let type = 'unknown';
      if (definition.includes('number')) {
        type = 'number';
      } else if (definition.includes('string')) {
        type = 'string';
      } else if (definition.includes('boolean')) {
        type = 'boolean';
      } else if (definition.includes('array')) {
        type = 'array';
      }
      
      // Extract default value from .prefault(...) or .default(...)
      let defaultValue = '';
      const prefaultMatch = definition.match(/\.prefault\(([^)]*)\)/);
      const defaultMatch = definition.match(/\.default\(([^)]*)\)/);
      
      if (prefaultMatch) {
        defaultValue = prefaultMatch[1].trim();
      } else if (defaultMatch) {
        defaultValue = defaultMatch[1].trim();
      }
      
      vars.push({
        path: fullPath,
        type,
        defaultValue,
        description: ''
      });
    }
  }
  
  return vars;
}

// Parse markdown list descriptions
function parseDescriptions(dictionaryText) {
  const descriptions = {};
  if (!dictionaryText) return descriptions;
  
  const lines = dictionaryText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Matches: "- stat_data.X: description" or "- `stat_data.X`: description" or "* stat_data.X - description"
    const match = trimmed.match(/^[-*+]\s+`?([\w\u00C0-\u1EF9\u4e00-\u9fa5\s.-]+)`?\s*[:|-]\s*(.+)$/);
    if (match) {
      const path = match[1].trim();
      const desc = match[2].trim();
      descriptions[path] = desc;
    }
  }
  return descriptions;
}

// Test Zod Schema
const testSchema = `// MVU Zod Schema v4
const schema = z.object({
  stat_data: z.object({
    "Nhân vật": z.object({
      HP: z.coerce.number().prefault(100).transform(v => Math.max(0, v)),
      MaxHP: z.coerce.number().prefault(100),
      "Cấp độ": z.coerce.number().prefault(1),
      "Sức mạnh": z.coerce.number().prefault(10),
      "Kinh nghiệm": z.coerce.number().prefault(0),
      "Độ hảo cảm": z.coerce.number().prefault(50)
    }).prefault({})
  }).prefault({})
});
`;

console.log("=== RUNNING ZOD PARSER TESTS ===");
const parsedVars = parseZodSchema(testSchema);
console.log("Parsed variables:", JSON.stringify(parsedVars, null, 2));

// Assertions
const expectedPaths = [
  'stat_data.Nhân vật.HP',
  'stat_data.Nhân vật.MaxHP',
  'stat_data.Nhân vật.Cấp độ',
  'stat_data.Nhân vật.Sức mạnh',
  'stat_data.Nhân vật.Kinh nghiệm',
  'stat_data.Nhân vật.Độ hảo cảm'
];

let failed = false;
if (parsedVars.length !== expectedPaths.length) {
  console.error(`ERROR: Expected ${expectedPaths.length} variables, but parsed ${parsedVars.length}`);
  failed = true;
}

expectedPaths.forEach((path) => {
  const found = parsedVars.find(v => v.path === path);
  if (!found) {
    console.error(`ERROR: Missing expected path: ${path}`);
    failed = true;
  } else {
    console.log(`OK: Found path ${path} with type: ${found.type}, defaultValue: ${found.defaultValue}`);
  }
});

// Test Description parser
const testDictionary = `# BỘ TỪ ĐIỂN BIẾN SỐ\n\n- \`stat_data.Nhân vật.HP\`: Lượng máu hiện tại\n* \`stat_data.Nhân vật.MaxHP\` - Lượng máu tối đa\n- \`stat_data.Nhân vật.Cấp độ\`: Cấp độ hiện tại`;
const parsedDescs = parseDescriptions(testDictionary);
console.log("Parsed descriptions:", JSON.stringify(parsedDescs, null, 2));

if (parsedDescs['stat_data.Nhân vật.HP'] !== 'Lượng máu hiện tại') {
  console.error("ERROR: Failed to parse description for HP");
  failed = true;
}
if (parsedDescs['stat_data.Nhân vật.MaxHP'] !== 'Lượng máu tối đa') {
  console.error("ERROR: Failed to parse description for MaxHP");
  failed = true;
}
if (parsedDescs['stat_data.Nhân vật.Cấp độ'] !== 'Cấp độ hiện tại') {
  console.error("ERROR: Failed to parse description for Cấp độ");
  failed = true;
}

if (!failed) {
  console.log("SUCCESS: All tests passed!");
} else {
  process.exit(1);
}
