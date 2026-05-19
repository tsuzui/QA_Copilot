import React, { useState, useMemo, useCallback } from 'react';
import { 
  FileText, 
  Send, 
  Copy, 
  Download, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Loader2,
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
  Search,
  Upload,
  RefreshCw,
  Globe,
  Hash,
  X,
  Trash2,
  Edit2,
  Save,
  Undo2,
  History,
  Info,
  Clock,
  ArrowLeft,
  FileBox,
  PieChart,
  CopyPlus,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { saveAs } from 'file-saver';
import { useDropzone } from 'react-dropzone';
import { Toaster, toast } from 'sonner';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { cn } from './lib/utils';
import { TestCase, TestCaseType, TemplateType, LanguageType, HistoryItem, CoverageItem, CoverageResult } from './types.ts';

// Model config
const MODAL_NAME = "gemini-2.0-flash";

const TEMPLATES: TemplateType[] = ['Simple', 'Gherkin', 'Jira/Zephyr', 'TestRail'];
const FILTERS: (TestCaseType | 'All')[] = ['All', 'Positive', 'Negative', 'Edge Case'];
const LANGUAGES: LanguageType[] = ['Indonesia', 'English'];

const PREVIOUS_SESSIONS_KEY = 'qa_copilot_history';

function calculateCoverageRatio(fullCoverage: any[], partialCoverage: any[], missingCoverage: any[]) {
  const full = Array.isArray(fullCoverage) ? fullCoverage.length : 0;
  const partial = Array.isArray(partialCoverage) ? partialCoverage.length : 0;
  const missing = Array.isArray(missingCoverage) ? missingCoverage.length : 0;

  const total = full + partial + missing;

  if (total === 0) return 0;

  return Number((((full + partial * 0.5) / total) * 100).toFixed(2));
}

function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, '') // remove punctuation
    .trim()
    .split(/\s+/)
    .filter(word => !['the', 'a', 'an', 'is', 'are', 'in', 'on', 'at', 'dan', 'yang', 'ini', 'oleh', 'dari'].includes(word)) // basic stopwords
    .join(' ');
}

function isLikelyDuplicateRequirement(requirement: string, existingTestCases: TestCase[]): boolean {
  const normalizedReq = normalizeText(requirement);
  if (!normalizedReq) return false;

  return existingTestCases.some(tc => {
    const normalizedTitle = normalizeText(tc.title);
    const normalizedExpected = normalizeText(tc.expectedResult);
    
    // Simple verification: if significant words overlap heavily
    const reqWords = new Set(normalizedReq.split(' '));
    const titleWords = new Set(normalizedTitle.split(' '));
    const expectedWords = new Set(normalizedExpected.split(' '));

    let titleMatchCount = 0;
    reqWords.forEach(word => { if (titleWords.has(word)) titleMatchCount++; });
    
    let expectedMatchCount = 0;
    reqWords.forEach(word => { if (expectedWords.has(word)) expectedMatchCount++; });

    const overlapThreshold = 0.7; // 70% of requirement words found in test case
    return (titleMatchCount / reqWords.size > overlapThreshold) || (expectedMatchCount / reqWords.size > overlapThreshold);
  });
}

function getNextIdSequence(existingResults: TestCase[]): { prefix: string, nextNum: number } {
  if (existingResults.length === 0) return { prefix: 'TC', nextNum: 1 };
  
  let maxNum = 0;
  let prefix = 'TC';

  existingResults.forEach(tc => {
    // Pattern: TC-{MODULE_CODE}-{NUMBER}
    const match = tc.id.match(/^TC-([A-Z0-9]+)-(\d+)$/);
    if (match) {
      prefix = `TC-${match[1]}`;
      const num = parseInt(match[2], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  return { prefix, nextNum: maxNum + 1 };
}

const CoverageItemCard = ({ item, status }: { item: CoverageItem, status: 'full' | 'partial' | 'missing' }) => {
  const iconMap = {
    full: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
    partial: <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
    missing: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
  };

  const bgMap = {
    full: "bg-emerald-50/40 border border-emerald-100/50",
    partial: "bg-amber-50/40 border border-amber-100/50",
    missing: "bg-rose-50/40 border border-rose-100/50"
  };

  return (
    <div className={cn("p-4 rounded-2xl text-xs text-slate-700 flex flex-col gap-2", bgMap[status])}>
      <div className="flex gap-3">
        {iconMap[status]}
        <div className="flex flex-col gap-1 flex-1">
          <span className={cn("font-bold", status === 'missing' ? "text-rose-900" : "text-slate-800")}>{item.requirement}</span>
        </div>
      </div>
      
      {item.matchedTestCaseIds && item.matchedTestCaseIds.length > 0 && (
        <div className="ml-7 flex flex-wrap gap-1 items-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mr-1">Matched:</span>
          {item.matchedTestCaseIds.map(id => (
            <span key={id} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono font-bold text-blue-600 shadow-sm">{id}</span>
          ))}
        </div>
      )}

      {item.missingAspects && item.missingAspects.length > 0 && (
        <div className="ml-7 space-y-1">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tighter">Missing Aspects:</p>
          <div className="space-y-1">
            {item.missingAspects.map((aspect, idx) => (
              <p key={idx} className="text-[10px] text-amber-800 leading-tight">• {aspect}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  // Feature Selection
  const [activeFeature, setActiveFeature] = useState<'generator' | 'coverage'>('generator');
  
  // Generator Feature State
  const [inputMode, setInputMode] = useState<'manual' | 'upload'>('manual');
  const [prdText, setPrdText] = useState('');
  const [generatorFile, setGeneratorFile] = useState<{ 
    name: string, 
    base64: string, 
    mimeType: string,
    rawText?: string 
  } | null>(null);
  const [results, setResults] = useState<TestCase[]>([]);
  const [generatorCoverage, setGeneratorCoverage] = useState<CoverageResult | null>(null);
  const [suggestedMissingTestCases, setSuggestedMissingTestCases] = useState<TestCase[]>([]);
  
  // Checker Feature State
  const [checkerPrdFile, setCheckerPrdFile] = useState<{ 
    name: string, 
    base64: string, 
    mimeType: string,
    rawText?: string 
  } | null>(null);
  const [checkerTestCaseFile, setCheckerTestCaseFile] = useState<{ 
    name: string, 
    base64: string, 
    mimeType: string,
    rawText?: string 
  } | null>(null);
  const [checkerCoverage, setCheckerCoverage] = useState<CoverageResult | null>(null);

  // Common UI State
  const [loading, setLoading] = useState(false);
  const [isCheckingCoverage, setIsCheckingCoverage] = useState(false);
  const [isGeneratingMissingCases, setIsGeneratingMissingCases] = useState(false);
  const [activeResultsTemplate, setActiveResultsTemplate] = useState<TemplateType>('Simple');
  const [viewMode, setViewMode] = useState<'results' | 'coverage' | 'missing'>('results');
  const [template, setTemplate] = useState<TemplateType>('Simple');
  const [language, setLanguage] = useState<LanguageType>('Indonesia');
  const [activeFilter, setActiveFilter] = useState<TestCaseType | 'All'>('All');
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<TestCase | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => {
    const stored = localStorage.getItem(PREVIOUS_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [confirmation, setConfirmation] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const pageSize = 10;
  const handleInputModeChange = (mode: 'manual' | 'upload') => {
    setInputMode(mode);
    setInputError(null);
  };

  const handleTemplateChange = (val: TemplateType) => {
    setTemplate(val);
    setActiveResultsTemplate(val);
  };

  const handlePrdTextChange = (text: string) => {
    setPrdText(text);
    setInputError(null);
  };

  const processFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); 
      };
      reader.readAsDataURL(file);
    });

    const base64 = await base64Promise;
    
    let rawText = "";
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ arrayBuffer });
      rawText = result.value;
    } else if (file.type === "text/plain") {
      rawText = await file.text();
    } else if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel") {
      const workbook = XLSX.read(arrayBuffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rawText = XLSX.utils.sheet_to_txt(worksheet);
    }

    return {
      name: file.name,
      base64,
      mimeType: file.type,
      rawText: rawText || undefined
    };
  };

  const onDropGeneratorPrd = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setLoading(true);
    try {
      const processed = await processFile(file);
      setGeneratorFile(processed);
      setInputError(null);
    } catch (error) {
      alert("Gagal memproses PRD.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDropCheckerPrd = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setLoading(true);
    try {
      const processed = await processFile(file);
      setCheckerPrdFile(processed);
      setInputError(null);
    } catch (error) {
      alert("Gagal memproses PRD.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDropCheckerTestCases = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setLoading(true);
    try {
      const processed = await processFile(file);
      setCheckerTestCaseFile(processed);
      setInputError(null);
    } catch (error) {
      alert("Gagal memproses file Test Case.");
    } finally {
      setLoading(false);
    }
  }, []);

  const generatorDropzone = useDropzone({
    onDrop: onDropGeneratorPrd,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const checkerPrdDropzone = useDropzone({
    onDrop: onDropCheckerPrd,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const checkerTcDropzone = useDropzone({
    onDrop: onDropCheckerTestCases,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  // Gemini Setup
  const generateTestCases = async () => {
    const hasInput = inputMode === 'manual' ? prdText.trim() : generatorFile;
    if (!hasInput) return;
    
    setInputError(null);
    // Word count check
    const inputText = inputMode === 'manual' ? prdText : (generatorFile?.rawText || "");
    if (inputText) {
      const wordCount = inputText.trim().split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < 30) {
        setInputError("Deskripsi terlalu singkat. Tambahkan detail requirement (min. 30 kata) untuk hasil yang akurat.");
        return;
      }
    }

    setLoading(true);
    setGeneratorCoverage(null);
    setResults([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let parts: any[] = [];
      if (inputMode === 'manual') {
        parts.push({ text: `PRD/Fitur:\n${prdText}` });
      } else if (generatorFile) {
        if (generatorFile.mimeType === 'application/pdf') {
          parts.push({
            inlineData: {
              data: generatorFile.base64,
              mimeType: generatorFile.mimeType
            }
          });
        } else if (generatorFile.rawText) {
          parts.push({ text: `PRD Content from File (${generatorFile.name}):\n${generatorFile.rawText}` });
        } else {
          parts.push({ text: `Analyze the attached file content named ${generatorFile.name}` });
        }
      }

      const genPrompt = `Generate as many test cases as possible for all requirements found in this document. 
For EACH requirement, generate positive, negative, and edge cases where relevant. Do not limit the count.

ANTI-HALLUCINATION INSTRUCTIONS:
- Hanya generate test case berdasarkan requirement yang EKSPLISIT disebutkan dalam input. 
- Jangan tambahkan test case dari pengetahuan umum atau asumsi tentang fitur tersebut.

FOR EVERY TEST CASE, you MUST consider and generate:
1. Positive case: Valid variations.
2. Negative Cases (MANDATORY):
   - Invalid Input: Formatting errors, empty fields, data that exceeds limits.
   - Validation: Duplicate data, data that doesn't exist, or incorrect data types.
   - Permissions: Accessing features without proper authorization.
   - Logic: Conditions where a process should fail.
3. Edge case: Boundary values, special characters, extreme conditions.

STRICT INSTRUCTIONS:
- Detection: Choose a 3-6 char uppercase prefix (e.g., AUTH, PAY).
- Naming: Varied action verbs (Avoid "Verifikasi").
- Gherkin: given, when, then lowercase fields (1-2 sentences), no N/A.

Output Template: ${template}
Output Language: ${language}
Output in valid JSON format.`;

      // Retry mechanism for Resource Exhausted (429)
      let result;
      let lastError;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          result = await ai.models.generateContent({
            model: MODAL_NAME,
            contents: [{ role: 'user', parts: [...parts, { text: genPrompt }] }],
            config: {
              maxOutputTokens: 8192,
              systemInstruction: `You are a senior QA engineer. Generate exhaustive test cases for all requirements in the document. 
              STRICT RULES:
              - Hanya generate test case berdasarkan requirement yang EKSPLISIT disebutkan dalam input. Jangan tambahkan test case dari pengetahuan umum atau asumsi tentang fitur tersebut.
              - DO NOT skip negative/edge cases.
              - Cover invalid formats, empty data, duplicate data, limits, and permission/access errors.
              - Use varied action verbs for titles.
              - For Gherkin, keep given, when, and then (lowercase) fields short, strictly descriptive, no N/A. Output in ${language}.`,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  prefix: { type: Type.STRING },
                  testCases: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id_number: { type: Type.STRING },
                        title: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['Positive', 'Negative', 'Edge Case'] },
                        priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                        preconditions: { type: Type.STRING },
                        steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        expectedResult: { type: Type.STRING },
                        given: { type: Type.STRING },
                        when: { type: Type.STRING },
                        then: { type: Type.STRING },
                      },
                      required: ['id_number', 'title', 'type', 'priority', 'steps', 'expectedResult', 'given', 'when', 'then']
                    }
                  }
                },
                required: ['prefix', 'testCases']
              }
            },
          });
          break; // Success
        } catch (err: any) {
          lastError = err;
          const errMsg = err.message || "";
          if ((errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) && attempt < 1) {
            console.warn(`Quota hit, retrying in 5s... (Attempt ${attempt + 1})`);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          throw err;
        }
      }

      if (!result) throw lastError;

      const textOutput = result.text;
      if (textOutput) {
        let parsed;
        try {
          parsed = JSON.parse(textOutput);
        } catch (e) {
          console.warn("Initial JSON parse failed, attempting repair...", e);
          let repaired = textOutput.trim();
          if (!repaired.endsWith('}')) {
            if (repaired.includes('"testCases": [')) {
              const lastObjectEnd = repaired.lastIndexOf('}');
              if (lastObjectEnd !== -1) {
                repaired = repaired.substring(0, lastObjectEnd + 1) + ']}';
                parsed = JSON.parse(repaired);
              } else {
                throw new Error("Output was severely truncated.");
              }
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }

        const prefix = parsed.prefix || 'TC';
        const testCases: any[] = parsed.testCases || [];
        const convertedResults: TestCase[] = testCases.map((tc, idx) => ({
          ...tc,
          source: 'generated',
          id: `TC-${prefix}-${String(idx + 1).padStart(3, '0')}`
        }));
        setResults(convertedResults);
        setSuggestedMissingTestCases([]);
        setActiveResultsTemplate(template);
        setViewMode('results');
        setGeneratorCoverage(null);
        toast.success(`Berhasil generate ${convertedResults.length} test cases!`);

        // Save to History
        const newHistory: HistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          title: (inputMode === 'manual' ? prdText.substring(0, 30) : generatorFile?.name) || 'Unnamed Session',
          timestamp: Date.now(),
          template,
          language,
          testCases: convertedResults
        };
        const updatedHistory = [newHistory, ...historyList].slice(0, 20);
        setHistoryList(updatedHistory);
        localStorage.setItem(PREVIOUS_SESSIONS_KEY, JSON.stringify(updatedHistory));
      }
    } catch (error: any) {
      console.error("Generation failed:", error);
      let msg = error.message || "Gagal melakukan generate.";
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.toLowerCase().includes("quota")) {
        toast.error("Kuota API Gemini Habis. Harap tunggu beberapa menit.");
      } else {
        toast.error("Terjadi Kesalahan: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkCoverage = async () => {
    const isChecker = activeFeature === 'coverage';
    const sourcePrd = isChecker ? checkerPrdFile : generatorFile;
    const sourceResults = isChecker ? null : results;

    if (isChecker) {
      if (!checkerPrdFile || !checkerTestCaseFile) return;
    } else {
      if (results.length === 0 || !generatorFile) return;
    }
    
    setIsCheckingCoverage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let parts: any[] = [];
      
      // Add PRD
      if (sourcePrd?.mimeType === 'application/pdf') {
        parts.push({ inlineData: { data: sourcePrd.base64, mimeType: sourcePrd.mimeType } });
      } else if (sourcePrd?.rawText) {
        parts.push({ text: `PRD Source File (${sourcePrd.name}):\n${sourcePrd.rawText}` });
      }

      // Add Test Cases
      if (isChecker && checkerTestCaseFile) {
        if (checkerTestCaseFile.mimeType === 'application/pdf') {
          parts.push({ inlineData: { data: checkerTestCaseFile.base64, mimeType: checkerTestCaseFile.mimeType } });
          parts.push({ text: `Analyze the test cases in the uploaded file named ${checkerTestCaseFile.name} against the PRD.` });
        } else if (checkerTestCaseFile.rawText) {
          parts.push({ text: `Existing Test Cases from File (${checkerTestCaseFile.name}):\n${checkerTestCaseFile.rawText}` });
        } else {
          parts.push({ text: `Analyze the test cases in the uploaded file named ${checkerTestCaseFile.name} against the PRD.` });
        }
      } else if (sourceResults) {
        parts.push({ text: `Daftar Test Cases untuk Pencocokan Coverage:\n${sourceResults.map(tc => `[ID: ${tc.id}] Title: ${tc.title}, Expected: ${tc.expectedResult}`).join('\n')}` });
      }

      const prompt = `Analisis dokumen PRD dan daftar test case yang ada menggunakan SEMANTIC MATCHING.
Tugas Anda adalah memetakan requirement testable dari PRD ke test case yang tersedia.

DEFINISI REQUIREMENT (WAJIB TESTABLE):
- HANYA ekstrak requirement yang bisa diuji secara teknis.
- Termasuk: Fitur spesifik, business rules, validasi input, permissions, user actions, system behavior, error handling, dan acceptance criteria.
- Satu requirement besar bisa dicakup oleh beberapa test case kecil. Jika gabungan test case tersebut mencakup requirement besar, anggap FULLY COVERED.

APA YANG HARUS DIABAIKAN (DILARANG MASUK LIST):
- Heading/Section Title (contoh: "Purpose", "Goals", "Objectives", "Overview", "Background", "Scope", "Introduction", "Summary").

ANTI-HALLUCINATION & COVERAGE RULES:
- FULL COVERED: Requirement terpenuhi sepenuhnya oleh satu atau lebih test case.
- PARTIALLY COVERED: Baru sebagian aspek requirement yang teruji, atau butuh skenario Negative/Edge Case tambahan.
- MISSING: Benar-benar tidak ada test case relevan.

Return JSON dengan format:
{
  "fullCoverage": [
    { "requirement": "...", "matchedTestCaseIds": ["ID-1", "ID-2"], "reason": "..." }
  ],
  "partialCoverage": [
    { "requirement": "...", "matchedTestCaseIds": ["ID-3"], "missingAspects": ["..."], "reason": "..." }
  ],
  "missingCoverage": [
    { "requirement": "...", "reason": "..." }
  ],
  "recommendations": "..."
}
(Recommendations dalam ${language})`;

      const result = await ai.models.generateContent({
        model: MODAL_NAME,
        contents: [{ role: 'user', parts: [...parts, { text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullCoverage: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    requirement: { type: Type.STRING },
                    matchedTestCaseIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reason: { type: Type.STRING }
                  },
                  required: ['requirement', 'reason']
                } 
              },
              partialCoverage: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    requirement: { type: Type.STRING },
                    matchedTestCaseIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    missingAspects: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reason: { type: Type.STRING }
                  },
                  required: ['requirement', 'reason']
                } 
              },
              missingCoverage: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    requirement: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ['requirement', 'reason']
                } 
              },
              recommendations: { type: Type.STRING }
            },
            required: ['fullCoverage', 'partialCoverage', 'missingCoverage', 'recommendations']
          }
        }
      });

      const text = result.text;
      if (text) {
        const parsed = JSON.parse(text);
        
        const fullyCovered = parsed.fullCoverage || [];
        const partiallyCovered = parsed.partialCoverage || [];
        const missingRequirements = parsed.missingCoverage || [];
        
        const percent = calculateCoverageRatio(fullyCovered, partiallyCovered, missingRequirements);

        const res: CoverageResult = {
          percent,
          fullyCovered,
          partiallyCovered,
          missingRequirements,
          recommendations: parsed.recommendations || ""
        };
        
        if (isChecker) {
          setCheckerCoverage(res);
          setViewMode('coverage');
        } else {
          setGeneratorCoverage(res);
          toast.success("Coverage analysis selesai!");
        }
      }
    } catch (error) {
      console.error("Coverage check failed:", error);
      toast.error("Gagal melakukan pengecekan coverage.");
    } finally {
      setIsCheckingCoverage(false);
    }
  };

  const generateMissingTestCases = async () => {
    if (!generatorCoverage || (generatorCoverage.missingRequirements.length === 0 && generatorCoverage.partiallyCovered.length === 0)) return;
    
    // Deduplicate requirements internally before generating
    const trulyMissing = generatorCoverage.missingRequirements.filter(req => !isLikelyDuplicateRequirement(req.requirement, results));
    const trulyPartial = generatorCoverage.partiallyCovered.filter(req => !isLikelyDuplicateRequirement(req.requirement, results));

    if (trulyMissing.length === 0 && trulyPartial.length === 0) {
      alert("Semua requirement di coverage gap sepertinya sudah memiliki test case relevan (Semantic deduplication).");
      return;
    }

    setIsGeneratingMissingCases(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const currentSelectedTemplate = results.length > 0 ? activeResultsTemplate : template;

      const prompt = `Berdasarkan requirement yang belum tercover atau baru tercover sebagian berikut, generate test case TAMBAHAN untuk mencapai 100% coverage.

PENTING:
- Gunakan template ${currentSelectedTemplate}, bahasa ${language}, dan gaya penulisan yang SAMA dengan contoh test case yang sudah ada.
- Jangan generate test case duplikat. Jika requirement sudah ada di daftar referensi, abaikan.
- Gunakan field yang konsisten dengan template ${currentSelectedTemplate}.

REQUIREMENTS YANG PERLU DITINGKATKAN:
- BELUM TERCOVER (Missing):
${trulyMissing.map(item => `- ${item.requirement} (${item.reason})`).join('\n')}

- TERCOVER SEBAGIAN (Butuh Negative/Edge cases):
${trulyPartial.map(item => `- ${item.requirement} (Problem: ${item.reason})`).join('\n')}

TEST CASE REFERENSI FORMAT (PENTING! IKUTI STRUKTUR INI):
${results.slice(0, 3).map(tc => {
  let fieldsStr = `[ID: ${tc.id}] Title: ${tc.title}, Type: ${tc.type}, Expected: ${tc.expectedResult}`;
  if (currentSelectedTemplate === 'Gherkin') fieldsStr += `, Given: ${tc.given}, When: ${tc.when}, Then: ${tc.then}`;
  if (currentSelectedTemplate === 'Jira/Zephyr' || currentSelectedTemplate === 'TestRail') fieldsStr += `, Priority: ${tc.priority}, Precondition: ${tc.preconditions}`;
  return fieldsStr;
}).join('\n')}

ANTI-HALLUCINATION INSTRUCTIONS:
- Hanya generate test case berdasarkan requirement yang EKSPLISIT disebutkan.
- DO NOT generate a new test case if the requirement is already covered by any existing test case above.

INSTRUKSI:
1. Untuk yang BELUM TERCOVER: Generate 1 Positive + skenario Negative relevan.
2. Untuk yang TERCOVER SEBAGIAN: HANYA generate skenario yang belum ada.

Output format: JSON dengan field yang sesuai dengan template ${currentSelectedTemplate}.`;

      let parts: any[] = [{ text: prompt }];
      if (generatorFile) {
        if (generatorFile.mimeType === 'application/pdf') {
          parts.push({ inlineData: { data: generatorFile.base64, mimeType: generatorFile.mimeType } });
        } else {
          parts.push({ text: `PRD Content:\n${generatorFile.rawText}` });
        }
      }

      const result = await ai.models.generateContent({
        model: MODAL_NAME,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: `You are a senior QA engineer. Generate test cases for missing requirements. 
          STRICT RULES:
          - Hanya generate test case berdasarkan requirement yang EKSPLISIT disebutkan dalam input. Jangan tambahkan test case dari pengetahuan umum atau asumsi tentang fitur tersebut.
          - Generate positive (if missing) and ALL failure conditions as separate cases.
          - DO NOT skip negative cases.
          - Use varied action verbs.
          - For Gherkin, keep given, when, and then (lowercase) short, strictly descriptive. Output in ${language}.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prefix: { type: Type.STRING },
              testCases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id_number: { type: Type.STRING },
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['Positive', 'Negative', 'Edge Case'] },
                    priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                    preconditions: { type: Type.STRING },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    expectedResult: { type: Type.STRING },
                    given: { type: Type.STRING },
                    when: { type: Type.STRING },
                    then: { type: Type.STRING },
                  },
                  required: ['id_number', 'title', 'type', 'priority', 'steps', 'expectedResult', 'given', 'when', 'then']
                }
              }
            }
          }
        }
      });

      const textOutput = result.text;
      if (textOutput) {
        const parsed = JSON.parse(textOutput);
        const { prefix, nextNum } = getNextIdSequence(results);
        const newCases: TestCase[] = (parsed.testCases || []).map((tc: any, idx: number) => ({
          ...tc,
          source: 'coverage-gap',
          id: `${prefix}-${String(nextNum + idx).padStart(3, '0')}`
        }));
        setSuggestedMissingTestCases(newCases);
        toast.success(`Berhasil generate ${newCases.length} missing test cases!`);
      }
    } catch (error) {
      console.error("Missing cases generation failed:", error);
      toast.error("Gagal generate test case tambahan.");
    } finally {
      setIsGeneratingMissingCases(false);
    }
  };

  const addAllSuggestedToMain = () => {
    if (suggestedMissingTestCases.length === 0) return;
    
    setResults(prev => {
      const existingIds = new Set(prev.map(tc => tc.id));
      const nonDuplicates = suggestedMissingTestCases.filter(tc => !existingIds.has(tc.id));
      toast.success(`Berhasil menambahkan ${nonDuplicates.length} test cases ke Main Results!`);
      return [...prev, ...nonDuplicates];
    });
    setSuggestedMissingTestCases([]);
  };

  const deleteSuggestedCase = (id: string) => {
    setSuggestedMissingTestCases(prev => prev.filter(tc => tc.id !== id));
  };

  const TestCaseTableHeader = ({ template, theme = 'blue' }: { template: TemplateType, theme?: 'blue' | 'amber' }) => {
    const bgHeader = theme === 'blue' ? 'bg-blue-50/80' : 'bg-amber-50';
    const borderHeader = theme === 'blue' ? 'border-blue-100' : 'border-amber-100';
    const textHeader = theme === 'blue' ? 'text-blue-900' : 'text-amber-900';

    return (
      <tr className={cn(bgHeader, "backdrop-blur-md border-b text-[10px] font-bold uppercase tracking-widest", borderHeader, textHeader)}>
        <th className="px-6 py-4 min-w-[120px] whitespace-nowrap">ID</th>
        <th className="px-6 py-4 w-32 text-center border-x border-blue-50/50">Type</th>
        {template === 'Simple' && (
          <>
            <th className="px-6 py-4">Test Case</th>
            <th className="px-6 py-4">Steps</th>
            <th className="px-6 py-4">Expected Result</th>
          </>
        )}
        {template === 'Gherkin' && (
          <>
            <th className="px-6 py-4">Scenario</th>
            <th className="px-6 py-4">Given</th>
            <th className="px-6 py-4">When</th>
            <th className="px-6 py-4">Then</th>
          </>
        )}
        {template === 'Jira/Zephyr' && (
          <>
            <th className="px-6 py-4 text-center w-24">Priority</th>
            <th className="px-6 py-4">Precondition</th>
            <th className="px-6 py-4">Title / Scenario</th>
            <th className="px-6 py-4">Steps</th>
            <th className="px-6 py-4">Expected</th>
          </>
        )}
        {template === 'TestRail' && (
          <>
            <th className="px-6 py-4">Title</th>
            <th className="px-6 py-4">Steps</th>
            <th className="px-6 py-4">Expected Result</th>
            <th className="px-6 py-4 w-24">Priority</th>
          </>
        )}
        <th className="px-6 py-4 text-right w-32">Actions</th>
      </tr>
    );
  };

  const regenerateSingleCase = async (id: string, isSuggested = false) => {
    const listToSearch = isSuggested ? suggestedMissingTestCases : results;
    const originalCase = listToSearch.find(r => r.id === id);
    if (!originalCase) return;

    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Regenerate exactly ONE test case that is DIFFERENT from the one provided but tests the same feature area.
Feature PRD context is provided in the previous turn or below.

ANTI-HALLUCINATION RULES:
- Hanya generate test case berdasarkan requirement yang EKSPLISIT disebutkan dalam input. 
- Jangan tambahkan test case dari pengetahuan umum atau asumsi tentang fitur tersebut.

Old Test Case: ${JSON.stringify(originalCase)}
Template: ${activeResultsTemplate}
Language: ${language}
ATURAN Gherkin: given, when, then wajib lengkap (max 1-2 kalimat singkat). Dilarang "N/A".
Return exactly ONE JSON object matching the test case schema.`;

      let parts: any[] = [{ text: prompt }];
      if (inputMode === 'manual') {
        parts.push({ text: `PRD Context:\n${prdText}` });
      } else if (generatorFile) {
        if (generatorFile.mimeType === 'application/pdf') {
          parts.push({ inlineData: { data: generatorFile.base64, mimeType: generatorFile.mimeType } });
        } else {
          parts.push({ text: `PRD Context:\n${generatorFile.rawText}` });
        }
      }

      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          result = await ai.models.generateContent({
            model: MODAL_NAME,
            contents: [{ role: 'user', parts }],
              config: {
                systemInstruction: `For Gherkin template, strictly provide given, when, and then (lowercase) fields (max 1-2 short sentences) without "N/A" or placeholders. Output must be in ${language}.`,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['Positive', 'Negative', 'Edge Case'] },
                    priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                    preconditions: { type: Type.STRING },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    expectedResult: { type: Type.STRING },
                    given: { type: Type.STRING },
                    when: { type: Type.STRING },
                    then: { type: Type.STRING },
                  },
                  required: ['title', 'type', 'priority', 'steps', 'expectedResult', 'given', 'when', 'then']
                }
              }
          });
          break;
        } catch (err: any) {
          const errMsg = err.message || "";
          if ((errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) && attempt < 1) {
            console.warn(`Quota hit, retrying in 5s... (Regen attempt ${attempt + 1})`);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          throw err;
        }
      }

      const textOutput = result?.text;
      if (textOutput) {
        const newCase: TestCase = JSON.parse(textOutput);
        if (isSuggested) {
          setSuggestedMissingTestCases(prev => prev.map(item => item.id === id ? { ...newCase, id, source: 'coverage-gap' } : item));
        } else {
          setResults(prev => prev.map(item => item.id === id ? { ...newCase, id, source: originalCase.source } : item));
        }
        toast.success("Berhasil regenerasi test case!");
      }
    } catch (error: any) {
      console.error("Regeneration failed:", error);
      let msg = error.message || "Gagal melakukan regenerasi.";
      
      // Try to extract clean message if it's JSON
      try {
        if (msg.includes('{')) {
          const start = msg.indexOf('{');
          const jsonStr = msg.substring(start);
          const parsed = JSON.parse(jsonStr);
          if (parsed.error?.message) msg = parsed.error.message;
        }
      } catch (e) {}

      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.toLowerCase().includes("quota")) {
        toast.error("Gagal regenerasi: Kuota API Gemini habis.");
      } else {
        toast.error("Gagal regenerasi: " + msg);
      }
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const deleteCase = (id: string) => {
    setResults(prev => prev.filter(tc => tc.id !== id));
    toast.success("Test case berhasil dihapus!");
  };

  const startEditing = (tc: TestCase) => {
    setEditingId(tc.id);
    setEditBuffer({ ...tc });
  };

  const saveEdit = () => {
    if (!editBuffer) return;
    setResults(prev => prev.map(tc => tc.id === editingId ? editBuffer : tc));
    setEditingId(null);
    setEditBuffer(null);
    toast.success("Perubahan berhasil disimpan!");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBuffer(null);
  };

  const fullReset = () => {
    setConfirmation({
      show: true,
      title: 'Hapus Semua?',
      message: 'Yakin ingin menghapus semua hasil saat ini?',
      onConfirm: () => {
        setResults([]);
        setSuggestedMissingTestCases([]);
        setGeneratorCoverage(null);
        setCheckerCoverage(null);
        setPrdText('');
        setGeneratorFile(null);
        setCheckerPrdFile(null);
        setCheckerTestCaseFile(null);
        setInputError(null);
        setActiveFilter('All');
        setSearchQuery('');
        setViewMode('results');
        setConfirmation(prev => ({ ...prev, show: false }));
        toast.info("Data berhasil direset!");
      }
    });
  };

  const handleGenerateClick = () => {
    if (results.length > 0) {
      setConfirmation({
        show: true,
        title: 'Generate Ulang?',
        message: 'Generate ulang akan menghapus hasil saat ini. Lanjutkan?',
        onConfirm: () => {
          generateTestCases();
          setConfirmation(prev => ({ ...prev, show: false }));
        }
      });
    } else {
      generateTestCases();
    }
  };

  const currentCoverage = activeFeature === 'generator' ? generatorCoverage : checkerCoverage;

  const loadFromHistory = (item: HistoryItem) => {
    setResults(item.testCases);
    setTemplate(item.template);
    setActiveResultsTemplate(item.template);
    setLanguage(item.language);
    setShowHistory(false);
    setGeneratorCoverage(null);
    setCheckerCoverage(null);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = historyList.filter(h => h.id !== id);
    setHistoryList(updated);
    localStorage.setItem(PREVIOUS_SESSIONS_KEY, JSON.stringify(updated));
  };

  const generateTestCasesBatch = useCallback(() => {
    return results;
  }, [results]);

  const filteredResults = useMemo(() => {
    setCurrentPage(1); // Reset page on filter/search change
    return generateTestCasesBatch().filter(tc => {
      const matchesFilter = activeFilter === 'All' || tc.type === activeFilter;
      const matchesSearch = tc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            tc.expectedResult.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [generateTestCasesBatch, activeFilter, searchQuery]);

  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredResults.slice(startIndex, startIndex + pageSize);
  }, [filteredResults, currentPage]);

  const totalPages = Math.ceil(filteredResults.length / pageSize);

  const copyToClipboard = () => {
    const text = JSON.stringify(filteredResults, null, 2);
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const exportCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (activeResultsTemplate === 'Simple') {
      headers = ['ID', 'Title', 'Type', 'Priority', 'Steps', 'Expected Result'];
      rows = filteredResults.map(tc => [tc.id, tc.title, tc.type, tc.priority, tc.steps.join('; '), tc.expectedResult]);
    } else if (activeResultsTemplate === 'Gherkin') {
      headers = ['ID', 'Scenario', 'Type', 'Given', 'When', 'Then'];
      rows = filteredResults.map(tc => [tc.id, tc.title, tc.type, tc.given, tc.when, tc.then]);
    } else if (activeResultsTemplate === 'Jira/Zephyr') {
      headers = ['ID', 'Priority', 'Precondition', 'Title / Scenario', 'Steps', 'Expected'];
      rows = filteredResults.map(tc => [tc.id, tc.priority, tc.preconditions, tc.title, tc.steps.join('; '), tc.expectedResult]);
    } else if (activeResultsTemplate === 'TestRail') {
      headers = ['ID', 'Title', 'Steps', 'Expected Result', 'Priority', 'Type'];
      rows = filteredResults.map(tc => [tc.id, tc.title, tc.steps.join('; '), tc.expectedResult, tc.priority, tc.type]);
    }
    
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(item => `"${(item || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `test_cases_${new Date().getTime()}.csv`);
    toast.success("CSV berhasil di-export!");
  };

  const exportExcel = () => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (activeResultsTemplate === 'Simple') {
      headers = ['ID', 'Title', 'Type', 'Priority', 'Steps', 'Expected Result'];
      rows = filteredResults.map(tc => [tc.id, tc.title, tc.type, tc.priority, tc.steps.join('\n'), tc.expectedResult]);
    } else if (activeResultsTemplate === 'Gherkin') {
      headers = ['ID', 'Scenario', 'Type', 'Given', 'When', 'Then'];
      rows = filteredResults.map(tc => [tc.id, tc.title, tc.type, tc.given, tc.when, tc.then]);
    } else if (activeResultsTemplate === 'Jira/Zephyr') {
      headers = ['ID', 'Priority', 'Precondition', 'Title / Scenario', 'Steps', 'Expected'];
      rows = filteredResults.map(tc => [tc.id, tc.priority, tc.preconditions, tc.title, tc.steps.join('\n'), tc.expectedResult]);
    } else if (activeResultsTemplate === 'TestRail') {
      headers = ['ID', 'Title', 'Steps', 'Expected Result', 'Priority', 'Type'];
      rows = filteredResults.map(tc => [tc.id, tc.title, tc.steps.join('\n'), tc.expectedResult, tc.priority, tc.type]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `test_cases_${new Date().getTime()}.xlsx`);
    toast.success("Excel berhasil di-export!");
  };

  const getTypeColor = (type: TestCaseType) => {
    switch (type) {
      case 'Positive': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Negative': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Edge Case': return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 text-[#1E293B] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/30 backdrop-blur-md border-b border-white/40 flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-blue-900 leading-none">QA Copilot</h1>
            <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold mt-1">AI Test Case Platform</p>
          </div>
        </div>

        <nav className="flex items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60 shadow-sm ml-8">
          <button 
            onClick={() => setActiveFeature('generator')}
            className={cn(
              "px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
              activeFeature === 'generator' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Zap className={cn("w-3.5 h-3.5", activeFeature === 'generator' ? "fill-blue-600" : "fill-none")} />
            Generator
          </button>
          <button 
            onClick={() => setActiveFeature('coverage')}
            className={cn(
              "px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
              activeFeature === 'coverage' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <PieChart className="w-3.5 h-3.5" />
            Cek Coverage
          </button>
        </nav>

        <div className="flex items-center gap-4 ml-auto">
          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/50 border border-blue-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-blue-600 transition-all shadow-sm"
          >
            <History className="w-4 h-4" />
            History
          </button>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-700 uppercase tracking-wider">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Tsuzui
          </div>
        </div>
      </header>

      <main className="pt-16 min-h-screen flex">
        {/* Left Pane: Input */}
        <section className="w-[320px] border-r border-white/40 bg-white/20 backdrop-blur-sm p-6 flex flex-col gap-8 fixed h-[calc(100vh-64px)] overflow-y-auto">
          {activeFeature === 'generator' ? (
            <div className="space-y-6">
              {/* Mode Switcher for Generator */}
              <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button 
                  onClick={() => handleInputModeChange('manual')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                    inputMode === 'manual' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Tulis Manual
                </button>
                <button 
                  onClick={() => handleInputModeChange('upload')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                    inputMode === 'upload' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Upload PRD
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-900 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PRD Source
                </h2>
                <p className="text-[11px] text-blue-600/70 font-medium tracking-wide">
                  {inputMode === 'manual' ? "Tulis atau paste requirement fitur" : "Lampirkan dokumen PRD"}
                </p>
              </div>

              {inputMode === 'manual' ? (
                <textarea
                  value={prdText}
                  onChange={(e) => handlePrdTextChange(e.target.value)}
                  disabled={results.length > 0}
                  placeholder="Contoh: Fitur Login dengan Google, validasi email, dan limit login..."
                  className={cn(
                    "w-full h-[320px] p-5 text-sm bg-white/60 border border-blue-100 rounded-3xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner transition-all outline-none resize-none font-sans placeholder:text-slate-400 leading-relaxed",
                    results.length > 0 && "opacity-60 cursor-not-allowed"
                  )}
                />
              ) : (
                <div className="space-y-4">
                  <div 
                    {...generatorDropzone.getRootProps()} 
                    className={cn(
                      "h-[160px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all",
                      results.length > 0 ? "cursor-not-allowed opacity-40 border-slate-200" : generatorDropzone.isDragActive ? "border-blue-500 bg-blue-50 cursor-pointer" : "border-blue-100 bg-white/40 hover:bg-white/60 hover:border-blue-300 cursor-pointer"
                    )}
                  >
                    <input {...generatorDropzone.getInputProps()} disabled={results.length > 0} />
                    <Upload className="w-10 h-10 text-blue-400 mb-3" />
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-[0.15em] px-6 text-center leading-relaxed">
                      {generatorDropzone.isDragActive ? "Lepas file di sini" : "Klik atau seret PDF, DOCX, TXT"}
                    </p>
                  </div>

                  {generatorFile ? (
                    <div className="p-4 bg-white/80 border border-blue-100 rounded-3xl flex items-center gap-3 shadow-sm group animate-in zoom-in-95">
                      <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{generatorFile.name}</p>
                        <p className="text-[9px] text-blue-500 font-bold uppercase tracking-tighter mt-0.5">Generator PRD</p>
                      </div>
                      {results.length === 0 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setGeneratorFile(null); }}
                          className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-300 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-[90px] flex items-center justify-center border border-slate-100 rounded-3xl border-dashed opacity-40">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum ada file</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-blue-600" /> Coverage Analyzer
                </h2>
                <p className="text-[11px] text-blue-600/70 font-medium tracking-wide">
                  Bandingkan PRD dengan existing Test Case
                </p>
              </div>

              <div className="space-y-5">
                {/* PRD Upload for Checker */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest ml-1 opacity-60">1. Dokumen PRD</p>
                  <div 
                    {...checkerPrdDropzone.getRootProps()} 
                    className={cn(
                      "h-[100px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all",
                      checkerPrdDropzone.isDragActive ? "border-blue-500 bg-blue-50 cursor-pointer" : "border-blue-100 bg-white/40 hover:bg-white/60 hover:border-blue-300 cursor-pointer"
                    )}
                  >
                    <input {...checkerPrdDropzone.getInputProps()} />
                    <FileBox className="w-6 h-6 text-blue-400 mb-2" />
                    <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wider px-4 text-center leading-tight">
                      {checkerPrdFile ? checkerPrdFile.name : "Upload PRD"}
                    </p>
                  </div>
                </div>

                {/* Existing Test Case Upload for Checker */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest ml-1 opacity-60">2. Existing Test Case</p>
                  <div 
                    {...checkerTcDropzone.getRootProps()} 
                    className={cn(
                      "h-[100px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all outline-none",
                      checkerTcDropzone.isDragActive ? "border-emerald-500 bg-emerald-50 cursor-pointer" : "border-emerald-100 bg-white/40 hover:bg-white/60 hover:border-emerald-300 cursor-pointer"
                    )}
                  >
                    <input {...checkerTcDropzone.getInputProps()} />
                    <ClipboardCheck className="w-6 h-6 text-emerald-400 mb-2" />
                    <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider px-4 text-center leading-tight">
                      {checkerTestCaseFile ? checkerTestCaseFile.name : "Upload Test Case"}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={checkCoverage}
                    disabled={isCheckingCoverage || !checkerPrdFile || !checkerTestCaseFile}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y"
                  >
                    {isCheckingCoverage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Analyze Coverage
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {activeFeature === 'generator' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-widest ml-1 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Lang
                    </label>
                    <div className="relative group">
                      <select 
                        value={language}
                        disabled={results.length > 0}
                        onChange={(e) => setLanguage(e.target.value as LanguageType)}
                        className={cn(
                          "w-full bg-white/60 border border-blue-100 rounded-xl px-4 py-2 text-[11px] outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all appearance-none",
                          results.length > 0 && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-widest ml-1 flex items-center gap-1">
                      <FileBox className="w-3 h-3" /> Layout
                    </label>
                    <div className="relative group">
                      <select 
                        value={template}
                        onChange={(e) => handleTemplateChange(e.target.value as TemplateType)}
                        className="w-full bg-white/60 border border-blue-100 rounded-xl px-4 py-2 text-[11px] outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all appearance-none"
                      >
                        {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateClick}
                  disabled={loading || (inputMode === 'manual' ? !prdText.trim() : !generatorFile)}
                  className={cn(
                    "w-full text-white font-bold py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 group",
                    results.length > 0 
                      ? "bg-slate-700 hover:bg-slate-800 shadow-slate-500/20" 
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20",
                    (loading || (inputMode === 'manual' ? !prdText.trim() : !generatorFile)) && "opacity-50 cursor-not-allowed shadow-none"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <span>{results.length > 0 ? 'Generate Ulang' : 'Generate Test Cases'}</span>
                      <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </>
            )}

            {inputError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-[10px] text-red-700 font-medium leading-normal mb-3"
              >
                {inputError}
              </motion.div>
            )}

            <div className="p-4 bg-blue-900/5 rounded-2xl border border-blue-900/10 text-[10px] text-blue-800/70 leading-relaxed">
              <strong>Pro Tip:</strong> {activeFeature === 'generator' ? (inputMode === 'manual' ? "Gunakan kalimat perintah yang jelas." : "PDF berstruktur paling optimal.") : "Pastikan file Test Case memiliki kolom Title atau Skenario."}
            </div>

            {results.length > 0 && (
              <button
                onClick={fullReset}
                className="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-3.5 rounded-2xl transition-all text-xs flex items-center justify-center gap-2"
              >
                <X className="w-3.5 h-3.5" />
                Reset Semua Data
              </button>
            )}
          </div>
        </section>


        {/* Right Pane: Results */}
        <section className="flex-1 ml-[320px] bg-white/10 flex flex-col p-8 overflow-hidden min-h-[calc(100vh-64px)]">
          <div className="w-full space-y-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-black text-blue-950 uppercase tracking-tight">
                    {activeFeature === 'generator' ? "Test Case Generator" : "Existing Coverage Analysis"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium tracking-wide">
                    {activeFeature === 'generator' 
                      ? (viewMode === 'coverage' ? "Analysis coverage hasil generate vs PRD" : "Skenario uji otomatis dari requirement") 
                      : "Visualisasi pemenuhan requirement pada file test case Anda"}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                      {activeFeature === 'generator' && filteredResults.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 transition-all shadow-sm active:scale-95">
                            <Download className="w-4 h-4" />
                            CSV
                          </button>
                          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 transition-all shadow-sm active:scale-95">
                            <FileBox className="w-4 h-4" />
                            Excel
                          </button>
                        </div>
                      )}
                </div>
              </div>

              {activeFeature === 'generator' && viewMode !== 'coverage' && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex bg-white/40 backdrop-blur-md p-1.5 rounded-2xl border border-blue-50 shadow-sm overflow-x-auto no-scrollbar">
                    {FILTERS.map(f => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={cn(
                          "px-6 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                          activeFilter === f 
                            ? "bg-blue-600 text-white shadow-md" 
                            : "text-slate-500 hover:text-blue-600"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Cari skenario atau hasil yang diharapkan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-blue-50 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 shadow-sm transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1">
              {activeFeature === 'coverage' ? (
                /* Existing Coverage Analysis Flow (Checker) */
                checkerCoverage ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl border border-blue-100 shadow-xl overflow-hidden"
                  >
                    <div className="p-8 border-b border-blue-50 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h2 className="text-2xl font-black text-blue-950 uppercase tracking-tight">Requirement Analysis</h2>
                          <p className="text-slate-500 text-sm">Hasil perbandingan literatur PRD dengan Test Case yang diberikan.</p>
                        </div>
                        <div className="text-right">
                          <div className="text-6xl font-black text-blue-600 tracking-tighter leading-none">{checkerCoverage.percent}%</div>
                          <div className="text-xs font-bold text-blue-900 uppercase tracking-widest mt-2">Coverage Ratio</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Full Coverage</span>
                          </div>
                          <div className="text-xl font-black text-emerald-900">{checkerCoverage.fullyCovered.length} Req.</div>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="w-4 h-4 text-amber-600" />
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Partial Coverage</span>
                          </div>
                          <div className="text-xl font-black text-amber-900">{checkerCoverage.partiallyCovered.length} Req.</div>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest">Missing Coverage</span>
                          </div>
                          <div className="text-xl font-black text-rose-900">{checkerCoverage.missingRequirements.length} Req.</div>
                        </div>
                      </div>
                    </div>

                    {checkerCoverage.recommendations && (
                      <div className="mx-8 mb-4 bg-blue-900 border border-blue-800 p-5 rounded-[2rem] shadow-xl flex items-start gap-4">
                        <div className="p-2.5 bg-blue-800 rounded-2xl shrink-0">
                          <Zap className="w-5 h-5 text-blue-300 fill-blue-300" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Rekomendasi Strategis AI</h4>
                          <p className="text-sm font-medium text-white leading-relaxed">{checkerCoverage.recommendations}</p>
                        </div>
                      </div>
                    )}

                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Covered (Terpenuhi)</h3>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                          {checkerCoverage.fullyCovered.map((item, i) => (
                            <CoverageItemCard key={i} item={item} status="full" />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Partial (Sebagian)</h3>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                          {checkerCoverage.partiallyCovered.map((item, i) => (
                            <CoverageItemCard key={i} item={item} status="partial" />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Missing (Belum Ada)</h3>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                          {checkerCoverage.missingRequirements.map((item, i) => (
                            <CoverageItemCard key={i} item={item} status="missing" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* Empty state for Checker */
                  <div className="bg-white rounded-[40px] border border-blue-100 shadow-xl p-20 flex flex-col items-center text-center gap-8">
                    <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center relative">
                      <PieChart className="w-16 h-16 text-blue-300" strokeWidth={1} />
                      <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-lg border border-blue-100 flex items-center justify-center animate-bounce">
                        <Upload className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-blue-900 tracking-tight">Mulai Analisis Coverage</h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                        Unggah dokumen PRD dan file Test Case existing Anda. Kami akan menganalisis sejauh mana requirement terpenuhi.
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      <span>PRD (PDF/DOCX)</span>
                      <div className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span>TEST CASE (XLSX/TXT)</span>
                    </div>
                  </div>
                )
              ) : (
                /* Test Case Generator Flow */
                <div className="flex flex-col gap-10">
                  {/* Table Section */}
                  <div className="flex flex-col gap-4">
                    <div className="bg-white/60 backdrop-blur-md border border-blue-100 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse table-auto">
                          <thead>
                            <TestCaseTableHeader template={activeResultsTemplate} theme="blue" />
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            <AnimatePresence mode="popLayout">
                              {paginatedResults.length > 0 ? (
                                paginatedResults.map((tc, idx) => {
                                  const isEditing = editingId === tc.id;
                                  const data = isEditing ? editBuffer! : tc;

                                  return (
                                    <motion.tr 
                                      layout
                                      key={tc.id}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      transition={{ delay: idx * 0.03 }}
                                      className={cn(
                                        "hover:bg-blue-50/50 transition-colors group cursor-default text-[13px]",
                                        isEditing && "bg-blue-50/80"
                                      )}
                                    >
                                      <td className="px-6 py-4 align-middle whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                          <span className="font-mono text-[11px] font-bold text-blue-400 uppercase">{tc.id}</span>
                                        </div>
                                      </td>

                                      <td className="px-6 py-4 align-middle text-center border-x border-blue-50/50">
                                        {isEditing ? (
                                          <select 
                                            value={data.type}
                                            onChange={(e) => setEditBuffer({ ...data, type: e.target.value as TestCaseType })}
                                            className="text-[10px] p-1 border rounded bg-white w-full"
                                          >
                                            {FILTERS.filter(f => f !== 'All').map(f => <option key={f} value={f}>{f}</option>)}
                                          </select>
                                        ) : (
                                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap", getTypeColor(tc.type))}>
                                            {tc.type}
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* Simple Template Rows */}
                                      {activeResultsTemplate === 'Simple' && (
                                        <>
                                          <td className="px-6 py-4">
                                            {isEditing ? (
                                              <input className="w-full p-1 border rounded font-bold" value={data.title} onChange={e => setEditBuffer({...data, title: e.target.value})} />
                                            ) : <div className="font-bold text-slate-800">{tc.title}</div>}
                                          </td>
                                          <td className="px-6 py-4">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs min-h-[60px]" value={data.steps.join('\n')} onChange={e => setEditBuffer({...data, steps: e.target.value.split('\n')})} />
                                            ) : (
                                              <ol className="list-decimal list-inside space-y-1">
                                                {tc.steps.map((s, i) => <li key={i} className="text-slate-600 pl-1">{s}</li>)}
                                              </ol>
                                            )}
                                          </td>
                                          <td className="px-6 py-4">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs bg-white" value={data.expectedResult} onChange={e => setEditBuffer({...data, expectedResult: e.target.value})} />
                                            ) : <div className="text-slate-600 bg-blue-50/30 p-2 rounded font-medium">{tc.expectedResult}</div>}
                                          </td>
                                        </>
                                      )}

                                      {/* Gherkin Template Rows */}
                                      {activeResultsTemplate === 'Gherkin' && (
                                        <>
                                          <td className="px-6 py-4">
                                            {isEditing ? (
                                              <input className="w-full p-1 border rounded font-bold" value={data.title} onChange={e => setEditBuffer({...data, title: e.target.value})} />
                                            ) : <div className="font-bold text-slate-800">{tc.title}</div>}
                                          </td>
                                          <td className="px-6 py-4 italic text-slate-600">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs" value={data.given} onChange={e => setEditBuffer({...data, given: e.target.value})} />
                                            ) : <>Given {tc.given || 'N/A'}</>}
                                          </td>
                                          <td className="px-6 py-4 italic text-slate-600">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs" value={data.when} onChange={e => setEditBuffer({...data, when: e.target.value})} />
                                            ) : <>When {tc.when || 'N/A'}</>}
                                          </td>
                                          <td className="px-6 py-4 italic font-medium text-blue-700">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs bg-white" value={data.then || data.expectedResult} onChange={e => setEditBuffer({...data, then: e.target.value})} />
                                            ) : <>Then {tc.then || tc.expectedResult}</>}
                                          </td>
                                        </>
                                      )}

                                      {/* Jira/Zephyr Template Rows */}
                                      {activeResultsTemplate === 'Jira/Zephyr' && (
                                        <>
                                          <td className="px-6 py-4 text-center">
                                            {isEditing ? (
                                              <select className="text-[10px] p-1 border rounded" value={data.priority} onChange={e => setEditBuffer({...data, priority: e.target.value as any})}>
                                                <option value="High">High</option>
                                                <option value="Medium">Medium</option>
                                                <option value="Low">Low</option>
                                              </select>
                                            ) : (
                                              <span className={cn("font-bold uppercase text-[10px]", tc.priority === 'High' ? 'text-rose-600' : tc.priority === 'Medium' ? 'text-amber-600' : 'text-slate-400')}>
                                                {tc.priority}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-6 py-4 text-[11px] text-slate-500 italic">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-[11px]" value={data.preconditions} onChange={e => setEditBuffer({...data, preconditions: e.target.value})} />
                                            ) : (tc.preconditions || '-')}
                                          </td>
                                          <td className="px-6 py-4 font-bold text-slate-800">
                                            {isEditing ? (
                                              <input className="w-full p-1 border rounded" value={data.title} onChange={e => setEditBuffer({...data, title: e.target.value})} />
                                            ) : tc.title}
                                          </td>
                                          <td className="px-6 py-4">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs min-h-[60px]" value={data.steps.join('\n')} onChange={e => setEditBuffer({...data, steps: e.target.value.split('\n')})} />
                                            ) : (
                                              <div className="max-h-24 overflow-y-auto space-y-1">
                                                {tc.steps.map((s, i) => <p key={i} className="text-slate-600">• {s}</p>)}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-6 py-4 text-slate-600 font-medium">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs bg-white" value={data.expectedResult} onChange={e => setEditBuffer({...data, expectedResult: e.target.value})} />
                                            ) : tc.expectedResult}
                                          </td>
                                        </>
                                      )}

                                      {/* TestRail Template Rows */}
                                      {activeResultsTemplate === 'TestRail' && (
                                        <>
                                          <td className="px-6 py-4 font-bold text-slate-800">
                                            {isEditing ? (
                                              <input className="w-full p-1 border rounded" value={data.title} onChange={e => setEditBuffer({...data, title: e.target.value})} />
                                            ) : tc.title}
                                          </td>
                                          <td className="px-6 py-4">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs" value={data.steps.join('\n')} onChange={e => setEditBuffer({...data, steps: e.target.value.split('\n')})} />
                                            ) : (
                                              <div className="max-h-24 overflow-y-auto space-y-1">
                                                {tc.steps.map((s, i) => <p key={i} className="text-slate-600">• {s}</p>)}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-6 py-4 text-slate-600">
                                            {isEditing ? (
                                              <textarea className="w-full p-1 border rounded text-xs bg-white" value={data.expectedResult} onChange={e => setEditBuffer({...data, expectedResult: e.target.value})} />
                                            ) : tc.expectedResult}
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                            <span className={cn("font-bold uppercase text-[10px]", tc.priority === 'High' ? 'text-rose-600' : tc.priority === 'Medium' ? 'text-amber-600' : 'text-slate-400')}>
                                              {tc.priority}
                                            </span>
                                          </td>
                                        </>
                                      )}

                                      <td className="px-6 py-4 align-top text-right">
                                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                          {isEditing ? (
                                            <>
                                              <button onClick={saveEdit} className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm" title="Save">
                                                <Save className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300" title="Cancel">
                                                <Undo2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => regenerateSingleCase(tc.id)}
                                                disabled={regeneratingIds.has(tc.id)}
                                                className={cn(
                                                  "p-1.5 rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 shadow-sm bg-white transition-all",
                                                  regeneratingIds.has(tc.id) && "animate-spin cursor-not-allowed"
                                                )}
                                                title="Regenerate"
                                              >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => startEditing(tc)} className="p-1.5 rounded-lg border border-blue-100 text-slate-600 hover:bg-slate-50 shadow-sm bg-white" title="Edit">
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => deleteCase(tc.id)} className="p-1.5 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 shadow-sm bg-white" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </motion.tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={10} className="py-24 text-center text-slate-400">
                                    {loading ? (
                                      <div className="flex flex-col items-center gap-4">
                                        <div className="relative">
                                          <div className="w-12 h-12 bg-blue-100 rounded-full animate-ping absolute inset-0" />
                                          <Loader2 className="w-12 h-12 text-blue-600 animate-spin relative" />
                                        </div>
                                        <p className="text-sm text-blue-900 font-bold uppercase tracking-widest animate-pulse">Generating...</p>
                                      </div>
                                    ) : "Belum ada hasil generate."}
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination & Footer */}
                      <div className="bg-slate-50/50 p-4 flex items-center justify-between border-t border-blue-50 text-[11px] font-medium text-slate-500">
                        <div className="flex items-center gap-4">
                           {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                               <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg bg-white border border-blue-100 text-blue-600 disabled:opacity-30">
                                 <Undo2 className="w-3.5 h-3.5 rotate-90" />
                               </button>
                               <span className="px-3">Page {currentPage} of {totalPages}</span>
                               <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg bg-white border border-blue-100 text-blue-600 disabled:opacity-30">
                                 <Undo2 className="w-3.5 h-3.5 -rotate-90" />
                               </button>
                            </div>
                           )}
                           <span className="h-4 w-px bg-slate-200" />
                           <span>Total: <strong className="text-blue-900 font-bold">{results.length}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold uppercase">{activeResultsTemplate} Template</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button: Cek Coverage Hasil Generate */}
                    {inputMode === 'upload' && results.length > 0 && !generatorCoverage && (
                      <div className="flex justify-center">
                         <button 
                          onClick={() => checkCoverage()}
                          disabled={isCheckingCoverage}
                          className="px-8 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
                         >
                           {isCheckingCoverage ? <Loader2 className="w-4 h-4 animate-spin" /> : <PieChart className="w-4 h-4" />}
                           Cek Coverage Hasil Generate
                         </button>
                      </div>
                    )}
                  </div>

                  {/* Coverage Section for Generator (shows below table) */}
                  {generatorCoverage && (
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-10"
                    >
                      <div className="bg-white rounded-[2.5rem] border border-blue-100 shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-blue-50 bg-slate-50/50">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h2 className="text-2xl font-black text-blue-950 uppercase tracking-tight">Coverage findings</h2>
                              <p className="text-slate-500 text-sm">Sejauh mana requirement PRD ter-cover oleh hasil generate di atas.</p>
                            </div>
                            <div className="text-right">
                              <div className="text-6xl font-black text-blue-600 tracking-tighter leading-none">{generatorCoverage.percent}%</div>
                              <div className="text-xs font-bold text-blue-900 uppercase tracking-widest mt-2">Coverage Ratio</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-6">
                            <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Full Coverage</span>
                              </div>
                              <div className="text-2xl font-black text-emerald-900">{generatorCoverage.fullyCovered.length} Requirements</div>
                            </div>
                            <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-amber-600" />
                                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Partial Coverage</span>
                              </div>
                              <div className="text-2xl font-black text-amber-900">{generatorCoverage.partiallyCovered.length} Requirements</div>
                            </div>
                            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest">Missing Coverage</span>
                              </div>
                              <div className="text-2xl font-black text-rose-900">{generatorCoverage.missingRequirements.length} Requirements</div>
                            </div>
                          </div>
                        </div>

                        {generatorCoverage.recommendations && (
                          <div className="mx-8 mt-8 bg-blue-900 border border-blue-800 p-6 rounded-[2.5rem] shadow-2xl flex items-start gap-5">
                            <div className="p-3 bg-blue-800 rounded-2xl shrink-0">
                              <Zap className="w-6 h-6 text-blue-300 fill-blue-300" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-[11px] font-bold uppercase tracking-widest text-blue-400">Rekomendasi Strategis AI</h4>
                              <p className="text-base font-medium text-white leading-relaxed">{generatorCoverage.recommendations}</p>
                            </div>
                          </div>
                        )}

                        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-10">
                          <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Covered (Terpenuhi)</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                              {generatorCoverage.fullyCovered.map((item, i) => (
                                <CoverageItemCard key={i} item={item} status="full" />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Partial (Sebagian)</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                              {generatorCoverage.partiallyCovered.map((item, i) => (
                                <CoverageItemCard key={i} item={item} status="partial" />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Missing (Belum Ada)</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                              {generatorCoverage.missingRequirements.map((item, i) => (
                                <CoverageItemCard key={i} item={item} status="missing" />
                              ))}
                            </div>
                          </div>
                        </div>

                        {(generatorCoverage.missingRequirements.length > 0 || generatorCoverage.partiallyCovered.length > 0) && suggestedMissingTestCases.length === 0 && (
                          <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-center">
                            <button
                              onClick={generateMissingTestCases}
                              disabled={isGeneratingMissingCases}
                              className="bg-blue-950 text-white px-12 py-5 rounded-3xl font-black uppercase tracking-widest text-sm hover:bg-black transition-all shadow-2xl shadow-blue-600/30 flex items-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                              {isGeneratingMissingCases ? <Loader2 className="w-5 h-5 animate-spin" /> : <CopyPlus className="w-5 h-5" />}
                              Generate Test Case untuk yang Belum Tercover
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Suggested Missing Test Cases Section */}
                      {suggestedMissingTestCases.length > 0 && (
                        <div className="bg-amber-50/30 rounded-[3rem] border border-amber-200/50 shadow-2xl overflow-hidden p-1">
                          <div className="bg-amber-100/40 border-b border-amber-200/50 p-10 flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-200 rounded-2xl text-amber-700">
                                  <Zap className="w-6 h-6 fill-amber-700" />
                                </div>
                                <h3 className="text-3xl font-black text-amber-900 tracking-tight">Suggested Missing Test Cases</h3>
                              </div>
                              <p className="text-sm text-amber-700/70 font-medium max-w-2xl leading-relaxed">
                                Skenario uji tambahan berbasis gap requirement. Review detail sebelum menggabungkannya ke hasil utama.
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                               <button 
                                onClick={addAllSuggestedToMain}
                                className="bg-amber-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-700 transition-all shadow-xl shadow-amber-600/20 flex items-center gap-2 active:scale-95"
                               >
                                 <PlusCircle className="w-5 h-5" />
                                 Add All to Main Results
                               </button>
                               <button 
                                onClick={() => setSuggestedMissingTestCases([])}
                                className="bg-white border-2 border-amber-200 text-amber-700 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-100 transition-all flex items-center gap-2 active:scale-95"
                               >
                                 <X className="w-5 h-5" />
                                 Discard
                               </button>
                            </div>
                          </div>

                          <div className="p-4">
                             <div className="bg-white rounded-[2.5rem] overflow-hidden border border-amber-100 shadow-lg overflow-x-auto">
                              <table className="w-full text-left border-collapse table-auto">
                                <thead>
                                  <TestCaseTableHeader template={activeResultsTemplate} theme="amber" />
                                </thead>
                                <tbody className="divide-y divide-amber-50">
                                  {suggestedMissingTestCases.map((tc) => (
                                    <tr key={tc.id} className="hover:bg-amber-50/30 transition-colors text-[13px] border-amber-50">
                                      <td className="px-6 py-4 align-middle whitespace-nowrap font-mono font-bold text-amber-600">{tc.id}</td>
                                      <td className="px-6 py-4 align-middle text-center border-x border-amber-50/50">
                                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap", getTypeColor(tc.type))}>
                                          {tc.type}
                                        </span>
                                      </td>
                                      
                                      {activeResultsTemplate === 'Simple' && (
                                        <>
                                          <td className="px-6 py-4 font-bold text-slate-800">{tc.title}</td>
                                          <td className="px-6 py-4">
                                            <ol className="list-decimal list-inside space-y-1">
                                              {tc.steps.map((s, i) => <li key={i} className="text-slate-600 pl-1">{s}</li>)}
                                            </ol>
                                          </td>
                                          <td className="px-6 py-4 text-slate-600 bg-amber-50/20 p-2 rounded font-medium">{tc.expectedResult}</td>
                                        </>
                                      )}

                                      {activeResultsTemplate === 'Gherkin' && (
                                        <>
                                          <td className="px-6 py-4 font-bold text-slate-800">{tc.title}</td>
                                          <td className="px-6 py-4 italic text-slate-600">Given {tc.given || 'N/A'}</td>
                                          <td className="px-6 py-4 italic text-slate-600">When {tc.when || 'N/A'}</td>
                                          <td className="px-6 py-4 italic font-medium text-amber-700">Then {tc.then || tc.expectedResult}</td>
                                        </>
                                      )}

                                      {activeResultsTemplate === 'Jira/Zephyr' && (
                                        <>
                                          <td className="px-6 py-4 text-center">
                                            <span className={cn("font-bold uppercase text-[10px]", tc.priority === 'High' ? 'text-rose-600' : tc.priority === 'Medium' ? 'text-amber-600' : 'text-slate-400')}>
                                              {tc.priority}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 text-[11px] text-slate-500 italic">{tc.preconditions || '-'}</td>
                                          <td className="px-6 py-4 font-bold text-slate-800">{tc.title}</td>
                                          <td className="px-6 py-4">
                                            <ol className="list-decimal list-inside space-y-1">
                                              {tc.steps.map((s, i) => <li key={i} className="text-slate-600 pl-1">{s}</li>)}
                                            </ol>
                                          </td>
                                          <td className="px-6 py-4 text-slate-600 bg-amber-50/20 p-2 rounded font-medium">{tc.expectedResult}</td>
                                        </>
                                      )}

                                      {activeResultsTemplate === 'TestRail' && (
                                        <>
                                          <td className="px-6 py-4 font-bold text-slate-800">{tc.title}</td>
                                          <td className="px-6 py-4">
                                            <ul className="list-disc list-inside space-y-1">
                                              {tc.steps.map((s, i) => <li key={i} className="text-slate-600 pl-1">{s}</li>)}
                                            </ul>
                                          </td>
                                          <td className="px-6 py-4 text-slate-600 p-2 rounded font-medium">{tc.expectedResult}</td>
                                          <td className="px-6 py-4 text-center">
                                            <span className={cn("font-bold text-[10px]", tc.priority === 'High' ? 'text-rose-600' : tc.priority === 'Medium' ? 'text-amber-600' : 'text-slate-400')}>
                                              {tc.priority}
                                            </span>
                                          </td>
                                        </>
                                      )}

                                      <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button 
                                            onClick={() => regenerateSingleCase(tc.id, true)} 
                                            className="p-2 hover:bg-amber-100 rounded-xl text-amber-600 transition-all active:scale-90"
                                            title="Regenerate"
                                          >
                                            {regeneratingIds.has(tc.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                          </button>
                                          <button 
                                            onClick={() => deleteSuggestedCase(tc.id)}
                                            className="p-2 hover:bg-rose-50 rounded-xl text-rose-400 hover:text-rose-600 transition-all active:scale-90"
                                            title="Delete"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                             </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
  </div>
</section>
</main>

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            <motion.div 
               initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Generation History</h3>
                    <p className="text-xs text-slate-400">Last 20 sessions on this device</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {historyList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                    <Clock className="w-12 h-12 mb-2" />
                    <p className="text-sm font-bold uppercase tracking-widest">No history yet</p>
                  </div>
                ) : (
                  historyList.map(item => (
                    <div 
                      key={item.id}
                      className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all cursor-pointer relative"
                      onClick={() => loadFromHistory(item)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-tighter">
                            {item.template}
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                          className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 truncate mb-1 pr-8">{item.title}</h4>
                      <p className="text-[11px] text-slate-500">{item.testCases.length} Test Cases • {item.language}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmation.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmation(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmation.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{confirmation.message}</p>
              </div>
              <div className="flex p-4 gap-3 bg-slate-50">
                <button 
                  onClick={() => setConfirmation(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmation.onConfirm}
                  className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
                >
                  Lanjutkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Toaster */}
      <Toaster position="top-center" richColors />
    </div>
  );
}
