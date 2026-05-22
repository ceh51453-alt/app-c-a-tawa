import { CardProject } from '../types';
import { parseZodSchema } from '../components/VariableDictionary';

/**
 * Standardize path representation, removing brackets, quotes, and double dots.
 * E.g. "stat_data['Nhân vật'].HP" -> "stat_data.Nhân vật.HP"
 */
export function normalizePath(path: string): string {
  if (!path) return '';
  return path
    .trim()
    // Replace brackets with dots, e.g. ['Nhân vật'] or ["Nhân vật"] -> .Nhân vật
    .replace(/\[\s*['"`](.*?)['"`]\s*\]/g, '.$1')
    // Replace array brackets, e.g. [0] -> .0
    .replace(/\[\s*(\d+)\s*\]/g, '.$1')
    // Remove leading and trailing dots
    .replace(/^\.+|\.+$/g, '')
    // Normalize multiple consecutive dots to a single dot
    .replace(/\.{2,}/g, '.');
}

/**
 * Scan text to find all accessed MVU variable paths.
 */
export function extractVariablePaths(text: string): string[] {
  if (!text) return [];
  const paths = new Set<string>();

  // 1. Matches: getvar('path') or getvar("path") or getvar(`path`)
  // Also setvar, addvar
  const getvarRegex = /\b(getvar|setvar|addvar)\s*\(\s*['"`]([a-zA-Z0-9_\.\u00C0-\u1EF9\u4e00-\u9fa5\s\-\[\]'"]+?)['"`]/g;
  let match;
  while ((match = getvarRegex.exec(text)) !== null) {
    const p = normalizePath(match[2]);
    if (p && (p.startsWith('stat_data') || p.startsWith('variables'))) {
      paths.add(p);
    }
  }

  // 2. Matches data-var="path" or data-prop="path" in HTML templates
  const dataVarRegex = /\b(data-var|data-prop)\s*=\s*['"`]([a-zA-Z0-9_\.\u00C0-\u1EF9\u4e00-\u9fa5\s\-\[\]'"]+?)['"`]/g;
  while ((match = dataVarRegex.exec(text)) !== null) {
    const p = normalizePath(match[2]);
    if (p && (p.startsWith('stat_data') || p.startsWith('variables'))) {
      paths.add(p);
    }
  }

  // 3. Matches SillyTavern macro: {{getvars::path}} or {{format_message_variable::path}}
  const macroRegex = /\{\{(getvars|format_message_variable)::([a-zA-Z0-9_\.\u00C0-\u1EF9\u4e00-\u9fa5\s\-\[\]'"]+?)\}\}/g;
  while ((match = macroRegex.exec(text)) !== null) {
    const p = normalizePath(match[2]);
    if (p && (p.startsWith('stat_data') || p.startsWith('variables'))) {
      paths.add(p);
    }
  }

  // 4. Matches JSON Patch paths: "path": "/stat_data/Nhân vật/HP"
  const patchRegex = /"path"\s*:\s*['"`]\/([a-zA-Z0-9_\/\u00C0-\u1EF9\u4e00-\u9fa5\s\-]+?)['"`]/g;
  while ((match = patchRegex.exec(text)) !== null) {
    const jsonPath = match[1].trim();
    const p = normalizePath(jsonPath.replace(/\//g, '.'));
    if (p && (p.startsWith('stat_data') || p.startsWith('variables'))) {
      paths.add(p);
    }
  }

  return Array.from(paths);
}

export interface CovarianceError {
  path: string;
  location: string;
  type: string; // 'number' | 'string' | 'boolean' | 'unknown'
}

export interface CovarianceWarning {
  path: string;
  details: string;
}

export interface CovarianceResult {
  errors: CovarianceError[];
  warnings: CovarianceWarning[];
  isValid: boolean;
}

/**
 * Compare Zod Schema variables against EJS, Regex, and Lorebook usage.
 */
export function validateSchemaRegexCovariance(project: CardProject): CovarianceResult {
  const schema = project.charData.zod_schema || '';
  const parsedSchemaVars = parseZodSchema(schema);
  const schemaPaths = new Set(parsedSchemaVars.map(v => normalizePath(v.path)));

  const errors: CovarianceError[] = [];
  const referencedPathsMap = new Map<string, string[]>(); // path -> locations[]

  const addReference = (path: string, location: string) => {
    const norm = normalizePath(path);
    if (!norm) return;
    if (!referencedPathsMap.has(norm)) {
      referencedPathsMap.set(norm, []);
    }
    referencedPathsMap.get(norm)!.push(location);
  };

  // 1. Scan EJS template
  const ejsTemplate = project.charData.ejs_template || '';
  extractVariablePaths(ejsTemplate).forEach(p => addReference(p, 'EJS Prompt Template'));

  // 2. Scan Regex scripts
  project.regexScripts.forEach(script => {
    extractVariablePaths(script.replaceString).forEach(p => 
      addReference(p, `Regex Script: "${script.scriptName}"`)
    );
  });

  // 3. Scan Lorebook entries
  project.lorebook.entries.forEach(entry => {
    extractVariablePaths(entry.content).forEach(p => 
      addReference(p, `Lorebook Entry: "${entry.comment}"`)
    );
  });

  // 4. Scan Character details (first_mes)
  const firstMes = project.charData.first_mes || '';
  extractVariablePaths(firstMes).forEach(p => addReference(p, 'First Message (Greeting)'));

  // Identify Errors: used in UI/EJS but missing in Zod Schema
  referencedPathsMap.forEach((locations, path) => {
    if (!schemaPaths.has(path)) {
      // Guess type from usage context
      let guessedType = 'number';
      const locStr = locations.join('; ');
      
      // HP, XP, Level, Gold are usually numbers, locations with math/arithmetic usually numbers
      if (
        path.toLowerCase().includes('name') || 
        path.toLowerCase().includes('tên') || 
        path.toLowerCase().includes('vị trí') || 
        path.toLowerCase().includes('location') ||
        path.toLowerCase().includes('tiểu sử')
      ) {
        guessedType = 'string';
      } else if (
        path.toLowerCase().includes('is_') || 
        path.toLowerCase().includes('has_') || 
        path.toLowerCase().includes('đã_') || 
        path.toLowerCase().includes('hoạt động')
      ) {
        guessedType = 'boolean';
      }

      locations.forEach(loc => {
        errors.push({
          path,
          location: loc,
          type: guessedType
        });
      });
    }
  });

  // Identify Warnings: defined in Zod Schema but not referenced anywhere
  const warnings: CovarianceWarning[] = [];
  parsedSchemaVars.forEach(v => {
    const normPath = normalizePath(v.path);
    if (!referencedPathsMap.has(normPath)) {
      warnings.push({
        path: normPath,
        details: `Khai báo trong Zod Schema nhưng không được gọi ở EJS hay Regex HTML/JS UI.`
      });
    }
  });

  return {
    errors,
    warnings,
    isValid: errors.length === 0
  };
}

/**
 * Programmatically inject a missing variable path into the schema string.
 */
export function addVariableToSchemaText(schemaText: string, varPath: string, varType: string = 'number'): string {
  const parts = varPath.split('.');
  if (parts.length < 2) return schemaText;

  // We only support absolute paths starting with stat_data or variables
  if (parts[0] !== 'stat_data' && parts[0] !== 'variables') {
    return schemaText;
  }

  let text = schemaText.trim();
  if (!text) {
    text = `// MVU Zod Schema v4\nconst schema = z.object({\n  stat_data: z.object({\n  }).prefault({})\n});\n\nregisterMvuSchema(schema);`;
  }

  const newFieldName = parts[parts.length - 1];
  // Determine standard initialization definition
  let zodTypeStr = 'z.coerce.number().prefault(0)';
  if (varType === 'string') {
    zodTypeStr = `z.coerce.string().prefault('')`;
  } else if (varType === 'boolean') {
    zodTypeStr = `z.coerce.boolean().prefault(false)`;
  }

  const formattedFieldName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(newFieldName)
    ? newFieldName
    : `'${newFieldName}'`;
  const newFieldLine = `      ${formattedFieldName}: ${zodTypeStr},`;

  // Search from deepest parent block to grandparent
  // e.g. path is "stat_data.Nhân vật.HP", parts is ["stat_data", "Nhân vật", "HP"]
  // parentKey is "Nhân vật", grandparent is "stat_data"
  const parentKey = parts[parts.length - 2];

  // Look for: parentKey: z.object({
  const parentRegex = new RegExp(`(['"]?${parentKey}['"]?\\s*:\\s*z\\s*\\.\\s*object\\s*\\(\\s*\\{\\s*)`, 'g');

  if (parentRegex.test(text)) {
    // Parent exists. Insert new field right after the opening brace
    return text.replace(parentRegex, `$1\n${newFieldLine}`);
  } else {
    // Parent object is missing. Check if grandparent exists (usually stat_data)
    const grandparentKey = parts[parts.length - 3] || 'stat_data';
    const grandparentRegex = new RegExp(`(['"]?${grandparentKey}['"]?\\s*:\\s*z\\s*\\.\\s*object\\s*\\(\\s*\\{\\s*)`, 'g');

    if (grandparentRegex.test(text)) {
      // Grandparent exists. Insert parent object with the new field nested inside it
      const parentFormattedName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(parentKey)
        ? parentKey
        : `'${parentKey}'`;
      const parentObjectStr = `      ${parentFormattedName}: z.object({\n  ${newFieldLine}\n      }).prefault({}),`;
      return text.replace(grandparentRegex, `$1\n${parentObjectStr}`);
    }
  }

  // Fallback: If no anchor matches, append to the end of the root object (before the last closing brace)
  const rootRegex = /(const\s+schema\s*=\s*z\s*\.\s*object\s*\(\s*\{\s*)/i;
  if (rootRegex.test(text)) {
    const fallbackFieldLine = `  ${parts.join('_').replace(/['"\s]/g, '')}: ${zodTypeStr},`;
    return text.replace(rootRegex, `$1\n${fallbackFieldLine}`);
  }

  return text;
}
