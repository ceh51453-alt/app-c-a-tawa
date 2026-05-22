export interface LorebookEntry {
  uid: number;
  key: string[];
  secondary_keys: string[];
  comment: string;
  content: string;
  
  // Strategy & Logic
  constant: boolean; // Constant strategy
  selective: boolean; // Normal/Selective strategy
  vectorized: boolean; // Vectorized strategy
  key_logic: 'and_any' | 'and_all' | 'not_any' | 'not_all';
  
  // Order & Position
  order: number;
  position: 'before_char' | 'after_char' | 'before_em' | 'after_em' | 'before_an' | 'after_an' | 'at_depth_system' | 'at_depth_user' | 'at_depth_assistant';
  scan_depth: number; // Depth
  
  // Matching Settings
  case_sensitive: boolean;
  match_whole_words: boolean;
  
  // Toggles (Advanced)
  prevent_recursion: boolean;
  delay_until_recursion: boolean;
  non_recursable: boolean;
  ignore_budget: boolean;
  
  // Bottom Fields
  priority: number; // Prioritize (if used as sort key) or boolean flag in some implementations, keeping number for flexibility
  sticky: number;
  cooldown: number;
  delay: number;
  probability: number; // Group Weight
  
  enabled: boolean;
}

export interface Lorebook {
  name: string;
  description: string;
  entries: LorebookEntry[];
}

export interface OpenAISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  // Advanced Configs
  contextSize: number;
  maxTokens: number;
  temperature: number;
  topK: number;
  topP: number;
  streaming: boolean;
  nsfw: boolean;
  enableSearch: boolean;
  minTokens: number; // Target length enforcement
}

export interface AIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface GenerateParams {
  prompt: string;
  context?: string;
  settings: OpenAISettings;
}

// --- Worldbuilding Types ---

export type WorldbuildingMode = 'genesis' | 'evolution' | 'discussion' | 'document_extraction';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // Array of Base64 strings for Vision support
  timestamp: number;
  actions?: WorldbuildingAction[];
  regexActions?: RegexBuilderAction[];
  ejsActions?: EJSBuilderAction[];
  charActions?: CharacterEditorAction[];
  entryActions?: EntryEditorAction[];
  dictActions?: DictionaryAction[];
  isError?: boolean;
  isHidden?: boolean; // Used to hide large data payloads from UI
}

export interface WorldbuildingAction {
  type: 'create' | 'update' | 'delete' | 'fetch_fandom_data' | 'read_document' | 'set_project_type' | 'update_zod_schema' | 'update_ejs_template' | 'update_character_data' | 'seed_regex' | 'create_regex' | 'update_regex' | 'delete_regex' | 'update_mvu_dictionary';
  target_comment?: string; // Used for update/delete to find the entry
  data?: Partial<LorebookEntry>; // The data to create or update
  url?: string; // Used for fetch_fandom_data
  chunk_index?: number; // Used for read_document
  project_type?: CardType;
  zod_schema?: string;
  ejs_template?: string;
  char_data?: Partial<CharacterData>;
  regex_data?: Partial<RegexScript>;
  target_regex_id?: string;
  mvu_dictionary?: string;
  reason?: string; // Why Tawa did this
}

export interface WorldbuildingResponse {
  thought: string; // Tawa's internal reasoning
  message: string; // Conversational response to user
  status?: 'CONTINUE' | 'DONE'; // Used for auto_wiki mode
  actions: WorldbuildingAction[]; // List of actions to perform on the lorebook
}

// --- NEW CARD CREATION TYPES ---

export type CardType = 'normal' | 'mvu' | 'mvu_zod' | 'era';

export interface CharacterData {
  name: string;
  first_mes: string;
  description: string;
  personality: string;
  scenario: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  zod_schema?: string; // For MVU Zod
  ejs_template?: string; // EJS code
  mvu_dictionary?: string; // TỪ ĐIỂN BIẾN SỐ
}

export interface RegexScript {
  id: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  minDepth: number | null;
  maxDepth: number | null;
  runOnSource: boolean;
  promptOnly: boolean;
  isactive: boolean;
  markdownOnly: boolean;
  runOnEdit: boolean;
  substituteRegex: number;
  placement: number[];
}

export interface CardProject {
  id: string;
  name: string;
  type: CardType;
  charData: CharacterData;
  lorebook: Lorebook;
  regexScripts: RegexScript[];
  createdAt: number;
  updatedAt: number;
}

export interface RegexBuilderAction {
  type: 'create' | 'update' | 'delete';
  target_id?: string;
  target_name?: string;
  data?: Partial<RegexScript>;
  reason?: string;
}

export interface RegexBuilderResponse {
  thought: string;
  message: string;
  actions: RegexBuilderAction[];
}

export interface EJSBuilderAction {
  type: 'update_ejs';
  code: string;
  reason?: string;
}

export interface EJSBuilderResponse {
  thought: string;
  message: string;
  actions: EJSBuilderAction[];
}

export interface SimulatorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  injectedLorebook?: string[]; // Names/keys of injected lorebook entries for display/debugging
}

// --- SECTION CHAT TYPES (for inline Tawa chat in various tabs) ---

export interface CharacterEditorAction {
  type: 'update_field';
  field: keyof CharacterData;
  value: string;
  reason?: string;
}

export interface CharacterEditorResponse {
  thought: string;
  message: string;
  actions: CharacterEditorAction[];
}

export interface EntryEditorAction {
  type: 'update_content' | 'update_keys' | 'update_settings';
  content?: string;
  keys?: string[];
  secondary_keys?: string[];
  comment?: string;
  settings?: Partial<LorebookEntry>;
  reason?: string;
}

export interface EntryEditorResponse {
  thought: string;
  message: string;
  actions: EntryEditorAction[];
}

export interface DictionaryAction {
  type: 'update_dictionary';
  dictionary: string;
  reason?: string;
}

export interface DictionaryResponse {
  thought: string;
  message: string;
  actions: DictionaryAction[];
}