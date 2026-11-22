export type WritingDocumentType =
  | 'cv'
  | 'cover_letter'
  | 'job_application'
  | 'scholarship_application'
  | 'training_application'
  | 'conference_application'
  | 'professional_email'
  | 'personal_statement'
  | 'motivation_letter';

export type WritingStyleOption =
  | 'professional'
  | 'natural_conversational'
  | 'academic'
  | 'formal'
  | 'concise';

export interface WritingDocumentTypeMeta {
  id: WritingDocumentType;
  label: string;
  guidance: string;
}

export interface WritingStyleMeta {
  id: WritingStyleOption;
  label: string;
  description: string;
}

export const WRITING_DOCUMENT_TYPES: WritingDocumentTypeMeta[] = [
  { id: 'cv', label: 'CV / Resume', guidance: 'Action-oriented, factual, concise achievement statements.' },
  { id: 'cover_letter', label: 'Cover Letter', guidance: 'Direct, tailored, authentic employer-focused prose.' },
  { id: 'job_application', label: 'Job Application', guidance: 'Clear responses connecting real experience to role requirements.' },
  { id: 'scholarship_application', label: 'Scholarship Application', guidance: 'Focused academic purpose, impact, and grounded career goals.' },
  { id: 'training_application', label: 'Training Application', guidance: 'Practical learning objectives and workplace application.' },
  { id: 'conference_application', label: 'Conference Application', guidance: 'Relevant professional contribution and domain engagement.' },
  { id: 'professional_email', label: 'Professional Email', guidance: 'Polite, direct, respectful, and easy to act on.' },
  { id: 'personal_statement', label: 'Personal Statement', guidance: 'Genuine personal narrative grounded in verifiable milestones.' },
  { id: 'motivation_letter', label: 'Motivation Letter', guidance: 'Clear motivation linking background, program fit, and goals.' },
];

export const WRITING_STYLES: WritingStyleMeta[] = [
  { id: 'professional', label: 'Professional', description: 'Clear, direct, confident workplace prose.' },
  { id: 'natural_conversational', label: 'Natural and conversational', description: 'Warm, human, readable without stiff phrasing.' },
  { id: 'academic', label: 'Academic', description: 'Structured, precise, evidence-minded phrasing.' },
  { id: 'formal', label: 'Formal', description: 'Polished, respectful tone without contractions.' },
  { id: 'concise', label: 'Concise', description: 'Tight, high-clarity sentences with filler removed.' },
];

export type WritingIssueCategory =
  | 'generic_expression'
  | 'unnatural_wording'
  | 'repetitive_sentence'
  | 'overly_complicated'
  | 'inconsistent_tone';

export interface WritingQualityIssue {
  id: string;
  category: WritingIssueCategory;
  severity: 'high' | 'medium' | 'low';
  excerpt: string;
  explanation: string;
  suggestion: string;
}

export interface NaturalAlternativeSuggestion {
  original: string;
  naturalAlternative: string;
  reason: string;
  category: WritingIssueCategory;
}

export interface ReadabilityMetrics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  readingLevelLabel: string;
  lexicalDiversityPercent: number;
  longSentenceCount: number;
}

export interface WritingQualityReport {
  overallQualityScore: number;
  subScores: {
    readability: number;
    naturalness: number;
    conciseness: number;
    toneConsistency: number;
  };
  summaryVerdict: string;
  metrics: ReadabilityMetrics;
  issues: WritingQualityIssue[];
  alternatives: NaturalAlternativeSuggestion[];
  improvedVersion: string;
  preservedTechnicalTerms: string[];
  engineMode: 'gemini_ai' | 'built_in_linguistic';
  transparencyNotice: string;
  analyzedAt: string;
}

export interface HumanizeTextResult {
  revisedText: string;
  documentType: WritingDocumentType;
  style: WritingStyleOption;
  improvementsApplied: string[];
  preservedTechnicalTerms: string[];
  wordCountBefore: number;
  wordCountAfter: number;
  engineMode: 'gemini_ai' | 'built_in_linguistic';
  integrityNotice: string;
  processedAt: string;
}

export const ETHICAL_TRANSPARENCY_NOTICE =
  'Writing-Quality Transparency: Humanize Checker evaluates real editorial quality — readability, natural phrasing, tone consistency, repetition, and sentence clarity. No automated detector can reliably prove whether text was written by a human or by AI, and this tool does not promise to bypass AI detectors or guarantee any detector score.';

export const INTEGRITY_PRESERVATION_NOTICE =
  'Factual Integrity Policy: Humanize Text improves clarity, tone, and flow while preserving your original meaning and technical terminology. It never invents qualifications, job titles, dates, or experience.';

interface PhraseRule {
  pattern: RegExp;
  replacement: string;
  conciseReplacement?: string;
  formalReplacement?: string;
  category: 'generic_expression' | 'unnatural_wording';
  reason: string;
}

const PHRASE_REPLACEMENT_RULES: PhraseRule[] = [
  {
    pattern: /\bin today['’]s fast-paced (?:world|environment|landscape|digital era)\b/gi,
    replacement: 'today',
    conciseReplacement: 'today',
    formalReplacement: 'in the current environment',
    category: 'generic_expression',
    reason: 'Overused cliché opener that adds little concrete meaning.',
  },
  {
    pattern: /\bdelve(?:s|d|ing)?\s+(?:deeply\s+)?into\b/gi,
    replacement: 'examine',
    conciseReplacement: 'review',
    formalReplacement: 'examine',
    category: 'unnatural_wording',
    reason: 'Overused stiff verb; plain verbs read more naturally.',
  },
  {
    pattern: /\bserve(?:s|d)?\s+as\s+a\s+testament\s+to\b/gi,
    replacement: 'demonstrates',
    conciseReplacement: 'shows',
    formalReplacement: 'demonstrates',
    category: 'generic_expression',
    reason: 'Inflated phrasing that can be stated directly.',
  },
  {
    pattern: /\ba\s+rich\s+tapestry\s+of\b/gi,
    replacement: 'a wide range of',
    conciseReplacement: 'various',
    formalReplacement: 'a broad range of',
    category: 'unnatural_wording',
    reason: 'Florid metaphor that feels unnatural in professional applications.',
  },
  {
    pattern: /\bof\s+paramount\s+importance\b/gi,
    replacement: 'essential',
    conciseReplacement: 'critical',
    formalReplacement: 'essential',
    category: 'generic_expression',
    reason: 'Wordy emphasis phrase; a direct adjective is stronger.',
  },
  {
    pattern: /\bpassionate\s+and\s+results-driven\b/gi,
    replacement: 'dedicated and results-focused',
    conciseReplacement: 'results-focused',
    formalReplacement: 'committed and results-focused',
    category: 'generic_expression',
    reason: 'Generic resume cliché; specific, grounded phrasing sounds more authentic.',
  },
  {
    pattern: /\bleveraging\s+synergies\b/gi,
    replacement: 'coordinating strengths',
    conciseReplacement: 'working together',
    formalReplacement: 'coordinating across teams',
    category: 'generic_expression',
    reason: 'Corporate buzzword that obscures what was actually done.',
  },
  {
    pattern: /\bin\s+order\s+to\b/gi,
    replacement: 'to',
    conciseReplacement: 'to',
    formalReplacement: 'to',
    category: 'unnatural_wording',
    reason: 'Unnecessary filler words before an infinitive.',
  },
  {
    pattern: /\bdue\s+to\s+the\s+fact\s+that\b/gi,
    replacement: 'because',
    conciseReplacement: 'because',
    formalReplacement: 'because',
    category: 'unnatural_wording',
    reason: 'Wordy connector that slows down the sentence.',
  },
  {
    pattern: /\bat\s+this\s+point\s+in\s+time\b/gi,
    replacement: 'currently',
    conciseReplacement: 'now',
    formalReplacement: 'currently',
    category: 'unnatural_wording',
    reason: 'Padded phrasing; a single word conveys the same meaning.',
  },
  {
    pattern: /\bwith\s+regard\s+to\b/gi,
    replacement: 'regarding',
    conciseReplacement: 'about',
    formalReplacement: 'regarding',
    category: 'unnatural_wording',
    reason: 'Can be tightened for cleaner flow.',
  },
  {
    pattern: /\bplease\s+do\s+not\s+hesitate\s+to\s+contact\s+me\b/gi,
    replacement: 'please feel free to contact me',
    conciseReplacement: 'please contact me',
    formalReplacement: 'please contact me if you need further information',
    category: 'generic_expression',
    reason: 'Formulaic email closing that can sound fresher and more direct.',
  },
  {
    pattern: /\bi\s+am\s+writing\s+to\s+express\s+my\s+(?:keen|strong|deep|enthusiastic)\s+interest\s+in\b/gi,
    replacement: 'I am applying for',
    conciseReplacement: 'I am applying for',
    formalReplacement: 'I am writing to apply for',
    category: 'generic_expression',
    reason: 'Standard template opener; direct openings engage reviewers faster.',
  },
  {
    pattern: /\bpossess(?:es|ed|ing)?\s+a\s+(?:strong|solid|deep|extensive)\s+background\s+in\b/gi,
    replacement: 'have strong experience in',
    conciseReplacement: 'have experience in',
    formalReplacement: 'bring substantial experience in',
    category: 'unnatural_wording',
    reason: '"Possess a background" sounds stiff compared to "have experience".',
  },
  {
    pattern: /\butilize(?:s|d|ing)?\b/gi,
    replacement: 'use',
    conciseReplacement: 'use',
    formalReplacement: 'apply',
    category: 'unnatural_wording',
    reason: 'Simple verbs like "use" or "apply" read more clearly than "utilize".',
  },
  {
    pattern: /\bfacilitate\s+the\s+implementation\s+of\b/gi,
    replacement: 'help implement',
    conciseReplacement: 'implement',
    formalReplacement: 'support the implementation of',
    category: 'unnatural_wording',
    reason: 'Heavy nominalization slows reading comprehension.',
  },
  {
    pattern: /\ba\s+myriad\s+of\b/gi,
    replacement: 'many',
    conciseReplacement: 'many',
    formalReplacement: 'numerous',
    category: 'unnatural_wording',
    reason: 'Overly dramatic phrasing for standard professional writing.',
  },
  {
    pattern: /\bnavigat(?:e|ing|ed)\s+the\s+complexities\s+of\b/gi,
    replacement: 'manage',
    conciseReplacement: 'handle',
    formalReplacement: 'manage the complexities of',
    category: 'generic_expression',
    reason: 'Stock phrase often used instead of stating the concrete action.',
  },
  {
    pattern: /\bproven\s+track\s+record\s+of\s+success\s+in\b/gi,
    replacement: 'consistent record in',
    conciseReplacement: 'experience in',
    formalReplacement: 'demonstrated record in',
    category: 'generic_expression',
    reason: 'Heavily overused resume cliché.',
  },
  {
    pattern: /\bseamless(?:ly)?\s+integrat(?:e|ed|ing|ion)\b/gi,
    replacement: 'smoothly integrate',
    conciseReplacement: 'integrate',
    formalReplacement: 'effectively integrate',
    category: 'generic_expression',
    reason: '"Seamlessly" is an overused filler adverb.',
  },
  {
    pattern: /\bfurthermore,\s+moreover,\b/gi,
    replacement: 'In addition,',
    conciseReplacement: 'Also,',
    formalReplacement: 'Furthermore,',
    category: 'unnatural_wording',
    reason: 'Stacked transitions feel robotic and redundant.',
  },
  {
    pattern: /\bit\s+is\s+worth\s+noting\s+that\b/gi,
    replacement: 'notably,',
    conciseReplacement: '',
    formalReplacement: 'notably,',
    category: 'unnatural_wording',
    reason: 'Throat-clearing phrase that delays the main point.',
  },
  {
    pattern: /\bmoreover,\s+it\s+is\s+important\s+to\s+highlight\s+that\b/gi,
    replacement: 'In addition,',
    conciseReplacement: 'Also,',
    formalReplacement: 'Additionally,',
    category: 'unnatural_wording',
    reason: 'Wordy transition that pads the sentence without adding information.',
  },
];

const INFORMAL_MARKERS =
  /\b(gonna|wanna|kinda|sorta|awesome|super\s+excited|stuff|things|tons\s+of|cool|hey\s+there|btw|fyi|lots\s+of|pretty\s+much|totally)\b/gi;

const STIFF_FORMAL_MARKERS =
  /\b(heretofore|aforementioned|herein|whereby|notwithstanding|pursuant\s+to|endeavor\s+to|hitherto|henceforth|commence|peruse)\b/gi;

const CONTRACTION_EXPANSIONS: Array<[RegExp, string]> = [
  [/\bI'm\b/g, 'I am'],
  [/\bI've\b/g, 'I have'],
  [/\bI'll\b/g, 'I will'],
  [/\bI'd\b/g, 'I would'],
  [/\bdon't\b/gi, 'do not'],
  [/\bdoesn't\b/gi, 'does not'],
  [/\bdidn't\b/gi, 'did not'],
  [/\bcan't\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'],
  [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'],
  [/\bwe're\b/gi, 'we are'],
  [/\bwe've\b/gi, 'we have'],
  [/\bit's\b/gi, 'it is'],
  [/\bthat's\b/gi, 'that is'],
];

const CONVERSATIONAL_CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bI am\b/g, "I'm"],
  [/\bI have\b/g, "I've"],
  [/\bdo not\b/g, "don't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bcannot\b/g, "can't"],
  [/\bwill not\b/g, "won't"],
  [/\bwe are\b/g, "we're"],
];

function matchCapitalization(source: string, replacement: string): string {
  if (!replacement) return '';
  if (!source) return replacement;
  if (source === source.toUpperCase() && source.length > 1) {
    return replacement.toUpperCase();
  }
  if (source[0] === source[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function extractPreservedTechnicalTerms(text: string): string[] {
  const found = new Set<string>();
  // Acronyms & domain standards (IFRS, WASH, AML/CFT, KYC, SQL, ISO, GIS, EPA, CPA, CFA, etc.)
  const acronymMatches = text.match(/\b[A-Z]{2,}(?:[/-][A-Z0-9]{2,})?\b/g) || [];
  for (const term of acronymMatches) {
    if (!['IN', 'ON', 'AT', 'TO', 'OF', 'OR', 'AND', 'THE', 'FOR', 'WITH'].includes(term)) {
      found.add(term);
    }
  }
  // Known technical domain phrases
  const domainPatterns = [
    /\b(?:IFRS|GAAP|Basel\s+III|AML\/CFT|KYC|SWIFT|SAP|ERP|Power\s+BI|Python|SQL|AutoCAD|EPANET|GIS|QGIS|ArcGIS)\b/gi,
    /\b(?:credit\s+risk|treasury\s+management|financial\s+modeling|internal\s+audit|microfinance|fintech|capital\s+markets|regulatory\s+compliance)\b/gi,
    /\b(?:water\s+supply|sanitation\s+and\s+hygiene|wastewater\s+treatment|hydrogeology|water\s+quality\s+testing|borehole\s+drilling|environmental\s+health|climate-resilient\s+water)\b/gi,
  ];
  for (const regex of domainPatterns) {
    const matches = text.match(regex) || [];
    for (const m of matches) {
      found.add(m.trim());
    }
  }
  return Array.from(found).slice(0, 20);
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const raw = normalized
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return raw;
}

function extractWords(text: string): string[] {
  const matches = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches : [];
}

function countSyllablesInWord(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return 1;
  if (cleaned.length <= 3) return 1;
  const stripped = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const vowelGroups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

function computeReadingLevelLabel(fleschScore: number): string {
  if (fleschScore >= 80) return 'Very Easy to Read (Plain Conversational)';
  if (fleschScore >= 65) return 'Clear & Accessible (Ideal for Applications)';
  if (fleschScore >= 50) return 'Standard Professional / Graduate';
  if (fleschScore >= 35) return 'Dense Academic / Technical';
  return 'Very Complex — Consider Simplifying Sentences';
}

export function computeReadabilityMetrics(text: string): ReadabilityMetrics {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const sentences = splitIntoSentences(text);
  const words = extractWords(text);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const totalSyllables = words.reduce((sum, w) => sum + countSyllablesInWord(w), 0);

  const avgWordsPerSentence = wordCount > 0 ? Number((wordCount / sentenceCount).toFixed(1)) : 0;
  const avgSyllablesPerWord = wordCount > 0 ? Number((totalSyllables / wordCount).toFixed(2)) : 0;

  const rawFlesch =
    wordCount > 0 ? 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord : 0;
  const fleschReadingEase = Math.max(0, Math.min(100, Math.round(rawFlesch)));

  const rawGrade =
    wordCount > 0 ? 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59 : 0;
  const fleschKincaidGrade = Math.max(1, Math.min(20, Number(rawGrade.toFixed(1))));

  const uniqueLower = new Set(words.map((w) => w.toLowerCase()));
  const lexicalDiversityPercent =
    wordCount > 0 ? Math.round((uniqueLower.size / wordCount) * 100) : 0;

  const longSentenceCount = sentences.filter((s) => extractWords(s).length >= 28).length;

  return {
    wordCount,
    sentenceCount: sentences.length,
    paragraphCount: Math.max(paragraphs.length, text.trim() ? 1 : 0),
    averageWordsPerSentence: avgWordsPerSentence,
    averageSyllablesPerWord: avgSyllablesPerWord,
    fleschReadingEase,
    fleschKincaidGrade,
    readingLevelLabel: computeReadingLevelLabel(fleschReadingEase),
    lexicalDiversityPercent,
    longSentenceCount,
  };
}

function tightenLongSentence(sentence: string): string {
  const words = extractWords(sentence);
  if (words.length < 28) return sentence;
  // Look for a safe clause boundary near the middle to split into two clear sentences
  const splitPatterns = [
    /,\s+which\s+/i,
    /,\s+and\s+(?=(?:I|we|this|it|the|my|our|they)\b)/i,
    /;\s+/,
    /,\s+while\s+(?=(?:I|we|this|it|the|my|our|they)\b)/i,
  ];
  for (const pat of splitPatterns) {
    const match = sentence.match(pat);
    if (match && typeof match.index === 'number') {
      const idx = match.index;
      const before = sentence.slice(0, idx).trim();
      const afterRaw = sentence.slice(idx + match[0].length).trim();
      if (extractWords(before).length >= 8 && extractWords(afterRaw).length >= 7) {
        const prefix = /which/i.test(match[0]) ? 'This ' : '';
        const secondSentence = prefix
          ? `${prefix}${afterRaw.charAt(0).toLowerCase()}${afterRaw.slice(1)}`
          : `${afterRaw.charAt(0).toUpperCase()}${afterRaw.slice(1)}`;
        return `${before.replace(/[.;,]+$/, '')}. ${secondSentence}`;
      }
    }
  }
  return sentence;
}

/**
 * Deterministic, meaning-preserving linguistic humanizer used both as a fast built-in engine
 * and as a reliable fallback whenever Gemini API is unavailable.
 */
export function humanizeTextDeterministically(params: {
  text: string;
  documentType: WritingDocumentType;
  style: WritingStyleOption;
}): HumanizeTextResult {
  const original = params.text.replace(/\r\n/g, '\n').trim();
  const wordCountBefore = extractWords(original).length;
  const preservedTechnicalTerms = extractPreservedTechnicalTerms(original);
  const improvementsApplied: string[] = [];

  let working = original;
  let clicheCount = 0;

  for (const rule of PHRASE_REPLACEMENT_RULES) {
    if (rule.pattern.test(working)) {
      clicheCount += 1;
      const targetReplacement =
        params.style === 'concise' && rule.conciseReplacement !== undefined
          ? rule.conciseReplacement
          : params.style === 'formal' && rule.formalReplacement !== undefined
          ? rule.formalReplacement
          : rule.replacement;
      working = working.replace(rule.pattern, (matched) =>
        matchCapitalization(matched, targetReplacement)
      );
    }
    rule.pattern.lastIndex = 0;
  }

  if (clicheCount > 0) {
    improvementsApplied.push(
      `Replaced ${clicheCount} generic or overly stiff expression${clicheCount === 1 ? '' : 's'} with natural phrasing.`
    );
  }

  // Style-specific adjustments without inventing any content
  if (params.style === 'formal' || params.style === 'academic') {
    let expandedCount = 0;
    for (const [pat, rep] of CONTRACTION_EXPANSIONS) {
      if (pat.test(working)) {
        expandedCount += 1;
        working = working.replace(pat, (m) => matchCapitalization(m, rep));
      }
      pat.lastIndex = 0;
    }
    if (expandedCount > 0) {
      improvementsApplied.push(`Expanded contractions to maintain a consistent ${params.style} register.`);
    }
    // Replace casual slang markers cleanly
    if (/\bgonna\b/i.test(working)) {
      working = working.replace(/\bgonna\b/gi, 'going to');
      improvementsApplied.push('Replaced informal phrasing with formal equivalents.');
    }
    if (/\bwanna\b/i.test(working)) {
      working = working.replace(/\bwanna\b/gi, 'want to');
    }
    if (/\btons of\b/gi.test(working)) {
      working = working.replace(/\btons of\b/gi, 'substantial');
    }
  } else if (params.style === 'natural_conversational') {
    let contracted = 0;
    for (const [pat, rep] of CONVERSATIONAL_CONTRACTIONS) {
      if (pat.test(working)) {
        contracted += 1;
        working = working.replace(pat, rep);
      }
      pat.lastIndex = 0;
    }
    if (contracted > 0) {
      improvementsApplied.push('Adopted natural contractions for a warmer, more conversational flow.');
    }
  }

  // Split overly long sentences in concise/professional/natural styles
  const paragraphs = working.split(/\n{2,}/);
  let splitCount = 0;
  const refinedParagraphs = paragraphs.map((para) => {
    const lines = para.split('\n');
    return lines
      .map((line) => {
        if (/^\s*[-•*]\s+/.test(line)) {
          // Preserve bullet structure cleanly
          return line.replace(/\s{2,}/g, ' ').trim();
        }
        const sentences = line.split(/(?<=[.!?])\s+/);
        const improvedSentences = sentences.map((s) => {
          const tightened =
            params.style === 'concise' ||
            params.style === 'professional' ||
            params.style === 'natural_conversational'
              ? tightenLongSentence(s)
              : s;
          if (tightened !== s) splitCount += 1;
          return tightened;
        });
        return improvedSentences.join(' ');
      })
      .join('\n');
  });

  working = refinedParagraphs.join('\n\n');

  if (splitCount > 0) {
    improvementsApplied.push(
      `Broke ${splitCount} overly long sentence${splitCount === 1 ? '' : 's'} into clearer, easier-to-read statements.`
    );
  }

  // Deduplicate repetitive transitions at sentence openings (e.g., repeated "Furthermore," or "Additionally,")
  const transitionTracker: Record<string, number> = {};
  const transitionAlts: Record<string, string[]> = {
    furthermore: ['In addition', 'Beyond that', 'Also'],
    moreover: ['In addition', 'Alongside this', 'Also'],
    additionally: ['In addition', 'Also', 'Next'],
  };
  let transitionVaried = 0;
  working = working.replace(/\b(Furthermore|Moreover|Additionally),/g, (full, word: string) => {
    const key = word.toLowerCase();
    transitionTracker[key] = (transitionTracker[key] || 0) + 1;
    if (transitionTracker[key] > 1) {
      transitionVaried += 1;
      const alts = transitionAlts[key] || ['Also'];
      const chosen = alts[(transitionTracker[key] - 2) % alts.length];
      return `${chosen},`;
    }
    return full;
  });

  if (transitionVaried > 0) {
    improvementsApplied.push('Varied repeated transition words so sentences flow more naturally.');
  }

  // Clean extra whitespace and punctuation spacing
  working = working
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (improvementsApplied.length === 0) {
    improvementsApplied.push(
      'Your draft already reads clearly and naturally; minor spacing and flow polish were applied while preserving your exact meaning.'
    );
  }

  return {
    revisedText: working,
    documentType: params.documentType,
    style: params.style,
    improvementsApplied,
    preservedTechnicalTerms,
    wordCountBefore,
    wordCountAfter: extractWords(working).length,
    engineMode: 'built_in_linguistic',
    integrityNotice: INTEGRITY_PRESERVATION_NOTICE,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Full deterministic writing quality audit for HUMANIZE CHECKER.
 * Identifies readability, repetitive sentences, generic expressions, unnatural wording,
 * inconsistent tone, overly complicated sentences, concrete natural alternatives, and an improved version.
 */
export function analyzeWritingQuality(params: {
  text: string;
  documentType?: WritingDocumentType;
}): WritingQualityReport {
  const original = params.text.replace(/\r\n/g, '\n').trim();
  const metrics = computeReadabilityMetrics(original);
  const sentences = splitIntoSentences(original);
  const preservedTechnicalTerms = extractPreservedTechnicalTerms(original);

  const issues: WritingQualityIssue[] = [];
  const alternatives: NaturalAlternativeSuggestion[] = [];
  const seenAlternatives = new Set<string>();

  // 1. Generic expressions & unnatural wording
  for (const rule of PHRASE_REPLACEMENT_RULES) {
    let match: RegExpExecArray | null;
    rule.pattern.lastIndex = 0;
    while ((match = rule.pattern.exec(original)) !== null) {
      const excerpt = match[0];
      const normKey = excerpt.toLowerCase();
      if (!seenAlternatives.has(normKey)) {
        seenAlternatives.add(normKey);
        const suggested = rule.replacement || '(remove filler phrase)';
        alternatives.push({
          original: excerpt,
          naturalAlternative: suggested,
          reason: rule.reason,
          category: rule.category,
        });
        issues.push({
          id: `issue_${issues.length + 1}`,
          category: rule.category,
          severity: rule.category === 'generic_expression' ? 'medium' : 'low',
          excerpt,
          explanation: rule.reason,
          suggestion: `Replace "${excerpt}" with "${suggested}".`,
        });
      }
    }
    rule.pattern.lastIndex = 0;
  }

  // 2. Repetitive sentence starters & near-duplicate sentences
  const starterCounts = new Map<string, string[]>();
  const normalizedSentenceMap = new Map<string, string>();
  for (const s of sentences) {
    const words = extractWords(s);
    if (words.length >= 4) {
      const starter = words.slice(0, 2).join(' ').toLowerCase();
      const list = starterCounts.get(starter) || [];
      list.push(s);
      starterCounts.set(starter, list);
    }
    const normSentence = words.map((w) => w.toLowerCase()).join(' ');
    if (normSentence.length >= 25) {
      if (normalizedSentenceMap.has(normSentence)) {
        issues.push({
          id: `issue_${issues.length + 1}`,
          category: 'repetitive_sentence',
          severity: 'high',
          excerpt: s.slice(0, 140),
          explanation: 'This sentence repeats an earlier statement almost word-for-word.',
          suggestion: 'Combine the two points or remove the duplicate sentence to keep the reader engaged.',
        });
      } else {
        normalizedSentenceMap.set(normSentence, s);
      }
    }
  }

  for (const [starter, group] of starterCounts.entries()) {
    if (group.length >= 3) {
      issues.push({
        id: `issue_${issues.length + 1}`,
        category: 'repetitive_sentence',
        severity: 'medium',
        excerpt: `"${starter}..." used ${group.length} times`,
        explanation: `Multiple sentences open with the exact same words ("${starter}"), creating a repetitive rhythm.`,
        suggestion: 'Vary sentence openings by leading with the concrete outcome, action, or context.',
      });
    }
  }

  // 3. Overly complicated / long sentences
  for (const s of sentences) {
    const wc = extractWords(s).length;
    if (wc >= 28) {
      const shortened = tightenLongSentence(s);
      issues.push({
        id: `issue_${issues.length + 1}`,
        category: 'overly_complicated',
        severity: wc >= 38 ? 'high' : 'medium',
        excerpt: s.length > 160 ? `${s.slice(0, 157)}...` : s,
        explanation: `This sentence is ${wc} words long. Sentences over 28 words are harder for recruiters and review panels to scan quickly.`,
        suggestion:
          shortened !== s
            ? `Split into shorter sentences, e.g.: "${shortened.slice(0, 180)}${shortened.length > 180 ? '...' : ''}"`
            : 'Split this into two focused sentences with one main idea each.',
      });
    }
  }

  // 4. Inconsistent tone detection (mixing casual slang/contractions with stiff formal/archaic terms)
  const informalMatches = original.match(INFORMAL_MARKERS) || [];
  const stiffMatches = original.match(STIFF_FORMAL_MARKERS) || [];
  const hasContractions = /\b(?:I'm|I've|don't|can't|won't|isn't|aren't|it's|that's)\b/i.test(original);
  const hasFormalOpeners = /\b(?:Dear\s+Sir|To\s+Whom\s+It\s+May\s+Concern|Furthermore|Moreover|Pursuant|Herein)\b/i.test(
    original
  );

  let tonePenalty = 0;
  if (informalMatches.length > 0 && (stiffMatches.length > 0 || hasFormalOpeners)) {
    tonePenalty += 22;
    issues.push({
      id: `issue_${issues.length + 1}`,
      category: 'inconsistent_tone',
      severity: 'high',
      excerpt: `Casual ("${informalMatches[0]}") mixed with formal register`,
      explanation:
        'Your draft shifts abruptly between casual conversational phrasing and formal institutional language.',
      suggestion: 'Pick one consistent tone (such as Professional or Formal) throughout the document.',
    });
    alternatives.push({
      original: informalMatches[0] || 'informal phrasing',
      naturalAlternative: 'clear professional phrasing',
      reason: 'Aligns casual wording with the rest of your formal application.',
      category: 'inconsistent_tone',
    });
  } else if (hasContractions && hasFormalOpeners && (params.documentType === 'motivation_letter' || params.documentType === 'scholarship_application')) {
    tonePenalty += 12;
    issues.push({
      id: `issue_${issues.length + 1}`,
      category: 'inconsistent_tone',
      severity: 'low',
      excerpt: 'Contractions combined with formal salutations/transitions',
      explanation: 'Mixing contractions with formal openers can make the tone feel slightly uneven.',
      suggestion: 'Either use a consistent professional/conversational register or expand contractions for formal submissions.',
    });
  } else if (stiffMatches.length >= 2) {
    tonePenalty += 15;
    issues.push({
      id: `issue_${issues.length + 1}`,
      category: 'inconsistent_tone',
      severity: 'medium',
      excerpt: stiffMatches.slice(0, 3).join(', '),
      explanation: 'Archaic or legalistic words make the writing sound unnecessarily rigid.',
      suggestion: 'Replace archaic terms with modern, clear professional equivalents.',
    });
  }

  // Compute sub-scores (0-100)
  const readabilityScore = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        metrics.fleschReadingEase >= 50 && metrics.fleschReadingEase <= 80
          ? 92
          : metrics.fleschReadingEase > 80
          ? 88
          : Math.max(35, 50 + metrics.fleschReadingEase * 0.7)
      ) - Math.min(20, metrics.longSentenceCount * 5)
    )
  );

  const genericOrUnnaturalCount = issues.filter(
    (i) => i.category === 'generic_expression' || i.category === 'unnatural_wording'
  ).length;
  const repetitiveCount = issues.filter((i) => i.category === 'repetitive_sentence').length;

  const naturalnessScore = Math.max(
    25,
    Math.min(100, 96 - genericOrUnnaturalCount * 8 - repetitiveCount * 9)
  );

  const concisenessScore = Math.max(
    25,
    Math.min(
      100,
      95 -
        metrics.longSentenceCount * 10 -
        (metrics.averageWordsPerSentence > 24 ? 12 : 0) -
        genericOrUnnaturalCount * 4
    )
  );

  const toneConsistencyScore = Math.max(35, Math.min(100, 96 - tonePenalty));

  const overallQualityScore = Math.round(
    readabilityScore * 0.28 +
      naturalnessScore * 0.3 +
      concisenessScore * 0.22 +
      toneConsistencyScore * 0.2
  );

  const improved = humanizeTextDeterministically({
    text: original,
    documentType: params.documentType || 'cover_letter',
    style: 'professional',
  });

  const summaryVerdict =
    overallQualityScore >= 85
      ? 'Strong, clear writing with natural phrasing and good readability.'
      : overallQualityScore >= 68
      ? 'Solid foundation — tightening long sentences and replacing generic phrases will make it noticeably stronger.'
      : 'Needs editorial refinement — simplify complex sentences, remove clichés, and align the tone for stronger clarity.';

  return {
    overallQualityScore,
    subScores: {
      readability: readabilityScore,
      naturalness: naturalnessScore,
      conciseness: concisenessScore,
      toneConsistency: toneConsistencyScore,
    },
    summaryVerdict,
    metrics,
    issues,
    alternatives,
    improvedVersion: improved.revisedText,
    preservedTechnicalTerms,
    engineMode: 'built_in_linguistic',
    transparencyNotice: ETHICAL_TRANSPARENCY_NOTICE,
    analyzedAt: new Date().toISOString(),
  };
}
