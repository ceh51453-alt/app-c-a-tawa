/**
 * RAG Knowledge Base — Static guide content for Tawa AI
 * Imports project markdown guides as raw strings via Vite's ?raw import
 */

import { getRAGManager } from './rag';

// Vite raw imports for markdown guides
import CARD_BUILDING_GUIDE from '../CARD_BUILDING_GUIDE.md?raw';
import CARD_MASTERY from '../CARD_MASTERY_COMPLETE (1).md?raw';
import HUONG_DAN_ZOD from '../HUONG_DAN_TAO_CARD_ZOD.md?raw';
import EJS_MVU_ZOD from '../TOAN_BO_EJS_MVU_ZOD.md?raw';
import FRONTEND_TUTORIAL from '../FRONTEND_TUTORIAL.md?raw';
import MVUZOD_TUTORIAL from '../MVUZOD_TUTORIAL (1).md?raw';

export const GUIDE_DOCUMENTS = [
  {
    id: 'guide_card_building',
    title: 'Hướng Dẫn Xây Dựng Card Frontend — SillyTavern V3',
    content: CARD_BUILDING_GUIDE,
  },
  {
    id: 'guide_card_mastery',
    title: 'Card Mastery Complete — Toàn Bộ Kỹ Thuật Card',
    content: CARD_MASTERY,
  },
  {
    id: 'guide_zod_creation',
    title: 'Hướng Dẫn Tạo Card Zod',
    content: HUONG_DAN_ZOD,
  },
  {
    id: 'guide_ejs_mvu_zod',
    title: 'Toàn Bộ EJS MVU Zod — Tham Chiếu Kỹ Thuật',
    content: EJS_MVU_ZOD,
  },
  {
    id: 'guide_frontend_tutorial',
    title: 'Frontend Tutorial — Hướng Dẫn Giao Diện',
    content: FRONTEND_TUTORIAL,
  },
  {
    id: 'guide_mvuzod_tutorial',
    title: 'MVU Zod Tutorial — Hướng Dẫn Nhanh',
    content: MVUZOD_TUTORIAL,
  },
];

/**
 * Initialize the RAG knowledge base with static guides
 * Call this once when the app starts
 */
export function initializeRAGKnowledgeBase() {
  const rag = getRAGManager();
  rag.registerGuides(GUIDE_DOCUMENTS);
}
