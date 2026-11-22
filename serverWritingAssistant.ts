import type { Express, Request, Response } from 'express';
import {
  analyzeWritingQuality,
  ETHICAL_TRANSPARENCY_NOTICE,
  humanizeTextDeterministically,
  INTEGRITY_PRESERVATION_NOTICE,
  WRITING_DOCUMENT_TYPES,
  WRITING_STYLES,
  WritingDocumentType,
  WritingStyleOption,
} from './src/utils/writingQualityAnalyzer';

interface RegisterWritingAssistantDeps {
  app: Express;
  getAiClient: () => Promise<any>;
}

const VALID_DOC_TYPES = new Set<WritingDocumentType>(WRITING_DOCUMENT_TYPES.map((d) => d.id));
const VALID_STYLES = new Set<WritingStyleOption>(WRITING_STYLES.map((s) => s.id));
const MAX_INPUT_CHARS = 15000;
const MIN_INPUT_CHARS = 15;

function sanitizeDocType(raw: unknown): WritingDocumentType {
  if (typeof raw === 'string' && VALID_DOC_TYPES.has(raw as WritingDocumentType)) {
    return raw as WritingDocumentType;
  }
  return 'cover_letter';
}

function sanitizeStyle(raw: unknown): WritingStyleOption {
  if (typeof raw === 'string' && VALID_STYLES.has(raw as WritingStyleOption)) {
    return raw as WritingStyleOption;
  }
  return 'professional';
}

function extractTextFromGeminiResponse(response: any): string {
  if (!response) return '';
  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }
  const candidates = response.candidates;
  if (Array.isArray(candidates) && candidates[0]?.content?.parts) {
    return candidates[0].content.parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim();
  }
  return '';
}

function safeParseJsonFromAi(raw: string): any | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function registerWritingAssistantRoutes(deps: RegisterWritingAssistantDeps) {
  const { app, getAiClient } = deps;

  /**
   * POST /api/writing/humanize
   * HUMANIZE TEXT: Rewrites user-provided text into clear, natural, professional human writing.
   * Preserves original meaning & technical terms; never invents qualifications or experience.
   */
  app.post('/api/writing/humanize', async (req: Request, res: Response) => {
    try {
      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (rawText.length < MIN_INPUT_CHARS) {
        return res.status(400).json({
          error: `Please enter at least ${MIN_INPUT_CHARS} characters of text to improve.`,
        });
      }
      if (rawText.length > MAX_INPUT_CHARS) {
        return res.status(400).json({
          error: `Text is too long (${rawText.length} characters). Maximum allowed length is ${MAX_INPUT_CHARS.toLocaleString()} characters.`,
        });
      }

      const documentType = sanitizeDocType(req.body?.documentType);
      const style = sanitizeStyle(req.body?.style);
      const docMeta = WRITING_DOCUMENT_TYPES.find((d) => d.id === documentType)!;
      const styleMeta = WRITING_STYLES.find((s) => s.id === style)!;

      // Always compute deterministic baseline first so we have preserved technical terms and a guaranteed safe fallback
      const deterministicResult = humanizeTextDeterministically({
        text: rawText,
        documentType,
        style,
      });

      const hasGeminiKey = Boolean((process.env.GEMINI_API_KEY || '').trim());
      if (hasGeminiKey) {
        try {
          const ai = await getAiClient();
          if (ai?.models?.generateContent) {
            const prompt = [
              'You are a senior career editor helping a job seeker, scholar, or professional refine their own writing.',
              `Document type: ${docMeta.label} (${docMeta.guidance})`,
              `Target writing style: ${styleMeta.label} (${styleMeta.description})`,
              '',
              'STRICT EDITORIAL RULES:',
              '1. Rewrite the text so it reads like natural, clear, authentic human writing in the requested style.',
              '2. Preserve 100% of the author\'s original meaning, facts, numbers, dates, employers, degrees, and technical terminology.',
              '3. NEVER invent qualifications, certifications, years of experience, awards, employers, metrics, or skills not present in the original text.',
              '4. Remove repetitive phrasing, generic clichés, and robotic transitions while keeping paragraph/bullet clarity.',
              '5. Do NOT add meta-commentary or mention AI detectors.',
              '',
              'Return ONLY valid JSON with this exact schema:',
              '{',
              '  "revisedText": "string (the complete improved text)",',
              '  "improvementsApplied": ["short concrete bullet explaining what was improved"]',
              '}',
              '',
              'ORIGINAL TEXT:',
              rawText,
            ].join('\n');

            const response = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: prompt,
              config: {
                temperature: 0.35,
                responseMimeType: 'application/json',
              },
            });

            const parsed = safeParseJsonFromAi(extractTextFromGeminiResponse(response));
            if (parsed && typeof parsed.revisedText === 'string' && parsed.revisedText.trim().length >= 10) {
              const revised = parsed.revisedText.trim();
              const improvements =
                Array.isArray(parsed.improvementsApplied) && parsed.improvementsApplied.length > 0
                  ? parsed.improvementsApplied
                      .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
                      .slice(0, 6)
                  : deterministicResult.improvementsApplied;

              return res.json({
                ...deterministicResult,
                revisedText: revised,
                improvementsApplied: improvements,
                wordCountAfter: (revised.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length,
                engineMode: 'gemini_ai',
                integrityNotice: INTEGRITY_PRESERVATION_NOTICE,
                processedAt: new Date().toISOString(),
              });
            }
          }
        } catch (aiErr: any) {
          console.warn('[WritingAssistant] Gemini humanize fallback triggered:', aiErr?.message || aiErr);
        }
      }

      return res.json(deterministicResult);
    } catch (err: any) {
      return res.status(500).json({
        error: 'Unable to process text refinement right now. Please try again.',
      });
    }
  });

  /**
   * POST /api/writing/check
   * HUMANIZE CHECKER: Separate editorial quality diagnostics tool.
   * Analyzes readability, repetition, generic expressions, unnatural wording, inconsistent tone,
   * overly complicated sentences, suggests natural alternatives, and provides an improved version.
   * Never falsely claims to detect human vs AI authorship or bypass AI detectors.
   */
  app.post('/api/writing/check', async (req: Request, res: Response) => {
    try {
      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (rawText.length < MIN_INPUT_CHARS) {
        return res.status(400).json({
          error: `Please enter at least ${MIN_INPUT_CHARS} characters of text to analyze.`,
        });
      }
      if (rawText.length > MAX_INPUT_CHARS) {
        return res.status(400).json({
          error: `Text is too long (${rawText.length} characters). Maximum allowed length is ${MAX_INPUT_CHARS.toLocaleString()} characters.`,
        });
      }

      const documentType = sanitizeDocType(req.body?.documentType);
      const report = analyzeWritingQuality({ text: rawText, documentType });

      const hasGeminiKey = Boolean((process.env.GEMINI_API_KEY || '').trim());
      if (hasGeminiKey) {
        try {
          const ai = await getAiClient();
          if (ai?.models?.generateContent) {
            const prompt = [
              'You are an editorial writing-quality reviewer. Analyze the draft below strictly for human writing quality: readability, generic clichés, unnatural wording, tone consistency, and sentence clarity.',
              'ETHICAL RULE: Never claim to detect AI authorship, never output an "AI probability" or "human percentage", and never claim to bypass AI detectors.',
              'FACTUAL RULE: Preserve all facts, credentials, and technical terms in improvedVersion. Never invent qualifications or experience.',
              '',
              'Return ONLY valid JSON with this exact schema:',
              '{',
              '  "summaryVerdict": "1-2 sentence objective writing-quality summary",',
              '  "additionalAlternatives": [',
              '    { "original": "exact short phrase from draft", "naturalAlternative": "clearer natural phrase", "reason": "short editorial reason", "category": "generic_expression | unnatural_wording | inconsistent_tone" }',
              '  ],',
              '  "improvedVersion": "complete improved rewrite preserving all original meaning and technical terms"',
              '}',
              '',
              'DRAFT TEXT:',
              rawText,
            ].join('\n');

            const response = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: prompt,
              config: {
                temperature: 0.25,
                responseMimeType: 'application/json',
              },
            });

            const parsed = safeParseJsonFromAi(extractTextFromGeminiResponse(response));
            if (parsed) {
              const mergedAlternatives = [...report.alternatives];
              const seen = new Set(mergedAlternatives.map((a) => a.original.toLowerCase()));
              if (Array.isArray(parsed.additionalAlternatives)) {
                for (const item of parsed.additionalAlternatives) {
                  if (
                    item &&
                    typeof item.original === 'string' &&
                    typeof item.naturalAlternative === 'string' &&
                    item.original.trim() &&
                    item.naturalAlternative.trim() &&
                    !seen.has(item.original.trim().toLowerCase())
                  ) {
                    seen.add(item.original.trim().toLowerCase());
                    const cat =
                      item.category === 'unnatural_wording' ||
                      item.category === 'inconsistent_tone' ||
                      item.category === 'generic_expression'
                        ? item.category
                        : 'unnatural_wording';
                    mergedAlternatives.push({
                      original: item.original.trim(),
                      naturalAlternative: item.naturalAlternative.trim(),
                      reason:
                        typeof item.reason === 'string' && item.reason.trim()
                          ? item.reason.trim()
                          : 'More natural editorial phrasing.',
                      category: cat,
                    });
                  }
                }
              }

              return res.json({
                ...report,
                summaryVerdict:
                  typeof parsed.summaryVerdict === 'string' && parsed.summaryVerdict.trim()
                    ? parsed.summaryVerdict.trim()
                    : report.summaryVerdict,
                alternatives: mergedAlternatives.slice(0, 14),
                improvedVersion:
                  typeof parsed.improvedVersion === 'string' && parsed.improvedVersion.trim().length >= 10
                    ? parsed.improvedVersion.trim()
                    : report.improvedVersion,
                engineMode: 'gemini_ai',
                transparencyNotice: ETHICAL_TRANSPARENCY_NOTICE,
                analyzedAt: new Date().toISOString(),
              });
            }
          }
        } catch (aiErr: any) {
          console.warn('[WritingAssistant] Gemini check fallback triggered:', aiErr?.message || aiErr);
        }
      }

      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({
        error: 'Unable to analyze writing quality right now. Please try again.',
      });
    }
  });
}
