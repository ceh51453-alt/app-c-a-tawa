/**
 * RAG (Retrieval-Augmented Generation) Engine
 * Client-side TF-IDF + Cosine Similarity vector search
 * No external API needed — runs entirely in-browser
 */

// --- Types ---

export interface RAGDocument {
  id: string;
  source: 'guide' | 'lorebook' | 'charData' | 'zodSchema' | 'ejsTemplate' | 'dictionary' | 'regex';
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface RAGChunk {
  docId: string;
  source: RAGDocument['source'];
  title: string;
  chunkIndex: number;
  text: string;
  tokens: string[];
  tfidfVector: Map<string, number>;
}

export interface RAGResult {
  chunk: RAGChunk;
  score: number;
  source: string;
  title: string;
  preview: string;
}

// --- Vietnamese-aware Tokenizer ---

const STOP_WORDS = new Set([
  'và', 'của', 'là', 'có', 'được', 'cho', 'trong', 'này', 'đó', 'các',
  'một', 'với', 'không', 'khi', 'từ', 'tại', 'để', 'theo', 'về', 'trên',
  'hoặc', 'nếu', 'nhưng', 'mà', 'thì', 'cũng', 'rồi', 'hay', 'sẽ', 'đã',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'that', 'this',
  'these', 'those', 'it', 'its', 'or', 'and', 'but', 'if', 'not', 'no',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_.-]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

// --- TF-IDF Engine ---

export class TFIDFEngine {
  private chunks: RAGChunk[] = [];
  private idf: Map<string, number> = new Map();
  private totalDocs: number = 0;

  clear() {
    this.chunks = [];
    this.idf.clear();
    this.totalDocs = 0;
  }

  /**
   * Index a list of documents, chunking them automatically
   */
  indexDocuments(documents: RAGDocument[], chunkSize: number = 400, overlap: number = 80) {
    this.clear();

    // Step 1: Chunk all documents
    for (const doc of documents) {
      const textChunks = this.chunkText(doc.content, chunkSize, overlap);
      for (let i = 0; i < textChunks.length; i++) {
        const tokens = tokenize(textChunks[i]);
        if (tokens.length < 3) continue; // Skip very short chunks

        this.chunks.push({
          docId: doc.id,
          source: doc.source,
          title: doc.title,
          chunkIndex: i,
          text: textChunks[i],
          tokens,
          tfidfVector: new Map(),
        });
      }
    }

    this.totalDocs = this.chunks.length;

    // Step 2: Compute IDF
    const docFreq: Map<string, number> = new Map();
    for (const chunk of this.chunks) {
      const uniqueTokens = new Set(chunk.tokens);
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    for (const [term, df] of docFreq) {
      this.idf.set(term, Math.log((this.totalDocs + 1) / (df + 1)) + 1);
    }

    // Step 3: Compute TF-IDF vectors
    for (const chunk of this.chunks) {
      const tf: Map<string, number> = new Map();
      for (const token of chunk.tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      for (const [term, count] of tf) {
        const tfidf = (count / chunk.tokens.length) * (this.idf.get(term) || 0);
        chunk.tfidfVector.set(term, tfidf);
      }
    }
  }

  /**
   * Search for relevant chunks given a query
   */
  search(query: string, topK: number = 5, minScore: number = 0.05): RAGResult[] {
    if (this.chunks.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // Build query TF-IDF vector
    const queryTf: Map<string, number> = new Map();
    for (const token of queryTokens) {
      queryTf.set(token, (queryTf.get(token) || 0) + 1);
    }

    const queryVector: Map<string, number> = new Map();
    for (const [term, count] of queryTf) {
      const tfidf = (count / queryTokens.length) * (this.idf.get(term) || 0);
      queryVector.set(term, tfidf);
    }

    // Compute cosine similarity with each chunk
    const scores: { chunk: RAGChunk; score: number }[] = [];

    for (const chunk of this.chunks) {
      const score = this.cosineSimilarity(queryVector, chunk.tfidfVector);
      if (score > minScore) {
        scores.push({ chunk, score });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Deduplicate: prefer highest-scored chunk per document
    const seen = new Set<string>();
    const results: RAGResult[] = [];

    for (const { chunk, score } of scores) {
      if (results.length >= topK) break;
      
      const dedupeKey = `${chunk.docId}:${chunk.chunkIndex}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      results.push({
        chunk,
        score,
        source: chunk.source,
        title: chunk.title,
        preview: chunk.text.slice(0, 200),
      });
    }

    return results;
  }

  /**
   * Get stats about the indexed corpus
   */
  getStats() {
    return {
      totalChunks: this.chunks.length,
      vocabularySize: this.idf.size,
      sources: [...new Set(this.chunks.map(c => c.source))],
    };
  }

  // --- Private Helpers ---

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const words = text.split(/\s+/);
    if (words.length <= chunkSize) return [text];

    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (const [term, val] of a) {
      magA += val * val;
      const bVal = b.get(term);
      if (bVal !== undefined) {
        dot += val * bVal;
      }
    }

    for (const [, val] of b) {
      magB += val * val;
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }
}

// --- RAG Manager (High-level API) ---

import type { CardProject } from '../types';

export class RAGManager {
  private engine: TFIDFEngine;
  private guideDocuments: RAGDocument[] = [];
  private lastProjectHash: string = '';

  constructor() {
    this.engine = new TFIDFEngine();
  }

  /**
   * Register static knowledge base documents (guides)
   */
  registerGuides(guides: { id: string; title: string; content: string }[]) {
    this.guideDocuments = guides.map(g => ({
      id: g.id,
      source: 'guide' as const,
      title: g.title,
      content: g.content,
    }));
  }

  /**
   * Rebuild the index from guides + current project data
   */
  buildIndex(project: CardProject) {
    const projectHash = this.computeProjectHash(project);
    if (projectHash === this.lastProjectHash && this.engine.getStats().totalChunks > 0) {
      return; // No change, skip rebuild
    }
    this.lastProjectHash = projectHash;

    const documents: RAGDocument[] = [...this.guideDocuments];

    // Add charData fields
    const charFields: (keyof typeof project.charData)[] = [
      'name', 'description', 'personality', 'scenario', 'first_mes',
      'system_prompt', 'post_history_instructions', 'creator_notes', 'mes_example'
    ];
    for (const field of charFields) {
      const val = project.charData[field];
      if (val && typeof val === 'string' && val.length > 20) {
        documents.push({
          id: `char_${field}`,
          source: 'charData',
          title: `Character: ${field}`,
          content: val,
        });
      }
    }

    // Add Zod Schema
    if (project.charData.zod_schema) {
      documents.push({
        id: 'zod_schema',
        source: 'zodSchema',
        title: 'Zod Schema',
        content: project.charData.zod_schema,
      });
    }

    // Add EJS Template
    if (project.charData.ejs_template) {
      documents.push({
        id: 'ejs_template',
        source: 'ejsTemplate',
        title: 'EJS Template',
        content: project.charData.ejs_template,
      });
    }

    // Add MVU Dictionary
    if (project.charData.mvu_dictionary) {
      documents.push({
        id: 'mvu_dictionary',
        source: 'dictionary',
        title: 'Từ Điển Biến Số',
        content: project.charData.mvu_dictionary,
      });
    }

    // Add Lorebook entries
    for (const entry of project.lorebook.entries) {
      if (entry.content && entry.content.length > 10) {
        documents.push({
          id: `lorebook_${entry.uid}`,
          source: 'lorebook',
          title: `Lorebook: ${entry.comment || `Entry #${entry.uid}`}`,
          content: `[Tên] ${entry.comment}\n[Keywords] ${entry.key.join(', ')}\n[Nội dung]\n${entry.content}`,
        });
      }
    }

    // Add Regex scripts summaries
    for (const rx of project.regexScripts) {
      documents.push({
        id: `regex_${rx.id}`,
        source: 'regex',
        title: `Regex: ${rx.scriptName}`,
        content: `[Script] ${rx.scriptName}\n[FindRegex] ${rx.findRegex}\n[ReplaceString] ${rx.replaceString.slice(0, 500)}\n[Placement] ${rx.placement.join(',')}\n[Active] ${rx.isactive}`,
      });
    }

    this.engine.indexDocuments(documents);
  }

  /**
   * Search the knowledge base
   */
  search(query: string, topK: number = 5): RAGResult[] {
    return this.engine.search(query, topK);
  }

  /**
   * Format RAG results as XML context block for injection into system prompts
   */
  formatContext(results: RAGResult[]): string {
    if (results.length === 0) return '';

    const chunks = results.map((r, i) => 
      `  <CHUNK rank="${i + 1}" source="${r.source}" title="${r.title}" score="${r.score.toFixed(3)}">\n${r.chunk.text.slice(0, 600)}\n  </CHUNK>`
    ).join('\n');

    return `\n<RAG_KNOWLEDGE_BASE>\nDưới đây là các đoạn kiến thức được truy xuất tự động từ cơ sở dữ liệu, liên quan đến câu hỏi của người dùng. Hãy tham chiếu và sử dụng chúng khi trả lời:\n${chunks}\n</RAG_KNOWLEDGE_BASE>\n`;
  }

  /**
   * One-shot: search + format
   */
  retrieve(query: string, topK: number = 5): string {
    const results = this.search(query, topK);
    return this.formatContext(results);
  }

  getStats() {
    return this.engine.getStats();
  }

  private computeProjectHash(project: CardProject): string {
    // Simple hash based on key data lengths
    return [
      project.charData.description?.length || 0,
      project.charData.zod_schema?.length || 0,
      project.charData.mvu_dictionary?.length || 0,
      project.charData.ejs_template?.length || 0,
      project.lorebook.entries.length,
      project.regexScripts.length,
      project.updatedAt
    ].join(':');
  }
}

// --- Singleton ---
let _ragManager: RAGManager | null = null;

export function getRAGManager(): RAGManager {
  if (!_ragManager) {
    _ragManager = new RAGManager();
  }
  return _ragManager;
}
