import { toYamlString, evaluateMacros, applyRegexByPlacement, parseSlashRegex } from '../services/simulator';
import { RegexScript } from '../types';

const assertEqual = (actual: any, expected: any, message: string) => {
  if (actual !== expected) {
    console.error(`❌ FAILURE: ${message}`);
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
};

console.log("Starting Regex & Macro Engine tests...");

// Test 1: toYamlString
const mockObjectState = {
  "Nhân vật": {
    "HP": 120,
    "Linh Lực": 85,
    "Công pháp": ["Dẫn Khí Quyết", "Thủy Kính Thuật"],
    "Mô tả": "Tu sĩ luyện khí tầng 3.\nCó linh căn thuộc tính Thủy."
  }
};

const yamlResult = toYamlString(mockObjectState).trim();
const expectedYaml = `Nhân vật:
  HP: 120
  Linh Lực: 85
  Công pháp:
    - Dẫn Khí Quyết
    - Thủy Kính Thuật
  Mô tả: |
    Tu sĩ luyện khí tầng 3.
    Có linh căn thuộc tính Thủy.`;

assertEqual(yamlResult, expectedYaml, "toYamlString parses nested object with array and multi-line strings correctly");

// Test 2: evaluateMacros
const rawMessageTemplate = "Hệ thống trạng thái: \n{{format_message_variable::Nhân vật}}\nHồi phục HP: {{getvars::Nhân vật.HP}}";
const evaluatedMessage = evaluateMacros(rawMessageTemplate, mockObjectState);

const expectedMessage = `Hệ thống trạng thái: \nHP: 120\nLinh Lực: 85\nCông pháp:\n  - Dẫn Khí Quyết\n  - Thủy Kính Thuật\nMô tả: |\n  Tu sĩ luyện khí tầng 3.\n  Có linh căn thuộc tính Thủy.\nHồi phục HP: 120`;

assertEqual(evaluatedMessage, expectedMessage, "evaluateMacros parses format_message_variable and getvars correctly");

// Test 3: parseSlashRegex
const pattern1 = "/<UpdateVariable>([\\s\S]*?)<\\/UpdateVariable>/gi";
const parsed1 = parseSlashRegex(pattern1);
assertEqual(parsed1?.pattern, "<UpdateVariable>([\\s\S]*?)<\\/UpdateVariable>", "parseSlashRegex extracts pattern");
assertEqual(parsed1?.flags, "gi", "parseSlashRegex extracts flags");

const pattern2 = "normal_keyword";
const parsed2 = parseSlashRegex(pattern2);
assertEqual(parsed2, null, "parseSlashRegex returns null for non-slash regex patterns");

// Test 4: applyRegexByPlacement
const scripts: RegexScript[] = [
  {
    id: "script-1",
    scriptName: "Ẩn tag UpdateVariable và hiển thị Panel",
    findRegex: "/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/g",
    replaceString: "GIAO DIỆN PANEL [Linh Lực: {{getvars::Nhân vật.Linh Lực}}]",
    trimStrings: [],
    minDepth: null,
    maxDepth: null,
    runOnSource: false,
    promptOnly: false,
    isactive: true,
    markdownOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    placement: [2] // Display / Render
  }
];

const inputText = "Tin nhắn của tu sĩ\r\n<UpdateVariable>\n<JSONPatch>\n[{\"op\": \"delta\", \"path\": \"/Nhân vật/HP\", \"value\": 10}]\n</JSONPatch>\n</UpdateVariable>\r\nChúc mừng!";
const outputText = applyRegexByPlacement(inputText, scripts, 2, { userState: mockObjectState });

// Expect CRLF to be normalized to LF, and tag replaced with evaluation of getvars macro
const expectedOutput = "Tin nhắn của tu sĩ\nGIAO DIỆN PANEL [Linh Lực: 85]\nChúc mừng!";
assertEqual(outputText.trim(), expectedOutput, "applyRegexByPlacement normalizes line endings and replaces tag with evaluated macro replacement");

console.log("\n🎉 All tests passed successfully!");
