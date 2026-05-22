import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cardPath = path.join(__dirname, '..', 'Ngự Thú Sư.json');
const cardData = JSON.parse(fs.readFileSync(cardPath, 'utf8'));

const data = cardData.data || {};
const extensions = data.extensions || {};
const thScripts = extensions.tavern_helper?.scripts || extensions.TavernHelper_scripts || [];

console.log("=== NÚT BẤM SCRIPT CONTENT ===");
const nutBam = thScripts.find(s => s.name === 'Nút Bấm');
if (nutBam) {
  console.log(nutBam.content);
} else {
  console.log("Not found 'Nút Bấm' script");
}

console.log("\n=== MVU SCRIPT CONTENT ===");
const mvu = thScripts.find(s => s.name === 'MVU');
if (mvu) {
  console.log(mvu.content);
}

console.log("\n=== REGEX SCRIPTS DETAILS ===");
const regexScripts = extensions.regex_scripts || [];
regexScripts.forEach((r, idx) => {
  console.log(`\nScript #${idx + 1}: "${r.scriptName}"`);
  console.log(`  findRegex: ${r.findRegex}`);
  console.log(`  replaceString length: ${r.replaceString?.length}`);
  console.log(`  disabled: ${r.disabled}`);
  console.log(`  markdownOnly: ${r.markdownOnly}`);
  console.log(`  promptOnly: ${r.promptOnly}`);
  console.log(`  placement: ${JSON.stringify(r.placement)}`);
  console.log(`  runOnEdit: ${r.runOnEdit}`);
  console.log(`  substituteRegex: ${r.substituteRegex}`);
  console.log(`  minDepth: ${r.minDepth}, maxDepth: ${r.maxDepth}`);
});
