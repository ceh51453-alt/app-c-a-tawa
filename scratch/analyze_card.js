import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cardPath = path.join(__dirname, '..', 'Ngự Thú Sư.json');
const cardData = JSON.parse(fs.readFileSync(cardPath, 'utf8'));

const data = cardData.data || {};
const extensions = data.extensions || {};

console.log("=== TavernHelper Scripts Sizes ===");
const thScripts = extensions.tavern_helper?.scripts || extensions.TavernHelper_scripts || [];
thScripts.forEach((s) => {
  console.log(`  - Name: "${s.name}", content size: ${s.content?.length || 0} characters`);
});

console.log("\n=== Regex Scripts Sizes ===");
const regexScripts = extensions.regex_scripts || [];
regexScripts.forEach((r) => {
  console.log(`  - Name: "${r.scriptName}", replaceString size: ${r.replaceString?.length || 0} characters`);
});
