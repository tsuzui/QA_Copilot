import React, { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
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
  PlusCircle,
  Home,
  Bug,
  Shield,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, MeshWobbleMaterial, OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
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

// 3D Components for Landing Page - QA Theme
const DataParticle = ({ position, color }: any) => {
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh position={position}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
    </Float>
  );
};

const AppLogo = ({ size = "md", className = "", theme = "dark" }: { size?: "sm" | "md" | "lg", className?: string, theme?: "light" | "dark" }) => {
  const dimensions = {
    sm: { box: "w-8 h-8", icon: "w-5 h-5", text: "text-lg" },
    md: { box: "w-10 h-10", icon: "w-6 h-6", text: "text-xl" },
    lg: { box: "w-32 h-32", icon: "w-20 h-20", text: "text-4xl" }
  };

  const d = dimensions[size];
  const isDark = theme === "dark";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${d.box} relative flex-shrink-0`}>
        {/* The Blue Container */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg transform rotate-[-2deg]" />
        
        {/* The Document / Nodes Section */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className={`${d.icon} text-white fill-none stroke-current stroke-2`}>
             {/* Document Body */}
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="fill-white/10" />
             <polyline points="14 2 14 8 20 8" />
             {/* Scanning Nodes on the left */}
             <circle cx="2" cy="8" r="1.5" className="fill-blue-400 stroke-none" />
             <circle cx="2" cy="12" r="1.5" className="fill-blue-400 stroke-none" />
             <circle cx="2" cy="16" r="1.5" className="fill-blue-400 stroke-none" />
             <line x1="2" y1="8" x2="6" y2="8" className="stroke-blue-400" />
             <line x1="2" y1="12" x2="6" y2="12" className="stroke-blue-400" />
             <line x1="2" y1="16" x2="6" y2="16" className="stroke-blue-400" />
             {/* Checkmark */}
             <path d="M9 15l2 2 4-4" className="stroke-cyan-400 stroke-[3px] drop-shadow-sm" />
          </svg>
        </div>
      </div>

      {size !== "lg" && (
        <div className="flex flex-col">
          <h1 className={`${d.text} font-black tracking-tighter leading-none flex items-center`}>
            <span className="text-blue-600">QA</span>
            <span className={cn("ml-1.5 relative", isDark ? "text-blue-50" : "text-slate-900")}>
              Copilot
              <span className="absolute -top-1 -right-2 transform scale-75">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-cyan-400 fill-cyan-400 animate-pulse">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
                </svg>
              </span>
            </span>
          </h1>
          {size === "md" && <p className={cn("text-[9px] uppercase tracking-widest font-black mt-1", isDark ? "text-slate-400" : "text-slate-500")}>Platform v2.2</p>}
        </div>
      )}
    </div>
  );
};

const QAScanner = () => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.2;
    }
    if (ringRef.current) {
      ringRef.current.position.y = Math.sin(t * 1.5) * 5;
      ringRef.current.rotation.x = Math.PI / 2;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {[...Array(30)].map((_, i) => (
          <mesh key={i} position={[(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10]}>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
            <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={2} />
          </mesh>
        ))}
      </group>

      {/* Matrix-like Scanning Lines */}
      {[...Array(5)].map((_, i) => (
        <ScanningLines key={i} delay={i * 0.5} />
      ))}

      {[...Array(50)].map((_, i) => (
        <DataParticle 
          key={i} 
          position={[(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30]} 
          color={i % 3 === 0 ? "#60A5FA" : i % 3 === 1 ? "#34D399" : "#F87171"}
        />
      ))}
    </group>
  );
};

const ScanningLines = ({ delay = 0 }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = (state.clock.elapsedTime + delay) % 4;
    if (ref.current) {
      ref.current.position.y = 8 - (t * 4);
      if (ref.current.material && (ref.current.material as THREE.Material).opacity !== undefined) {
        (ref.current.material as THREE.Material).opacity = Math.sin(t * Math.PI / 4) * 0.5;
      }
    }
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[30, 0.05]} />
      <meshBasicMaterial color="#3B82F6" transparent opacity={0.5} />
    </mesh>
  );
};

const Hero3DScene = () => {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none bg-[#020617]">
      <Canvas camera={{ position: [0, 0, 20], fov: 45 }}>
        <Suspense fallback={null}>
          <color attach="background" args={["#020617"]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={5} color="#3B82F6" />
          <pointLight position={[-10, -10, -10]} intensity={3} color="#10B981" />
          <QAScanner />
          <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 bg-[#020617]/50 backdrop-blur-[1px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020617_100%)] opacity-80" />
    </div>
  );
};


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
  
  // Navigation state
  const [appPage, setAppPage] = useState<'home' | 'generator' | 'coverage' | 'bug_report'>('home');
  
  useEffect(() => {
    if (appPage === 'home') {
      document.body.style.backgroundColor = '#020617';
    } else {
      document.body.style.backgroundColor = '#f8fafc';
    }
  }, [appPage]);
  
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
  
  const [generatorImages, setGeneratorImages] = useState<{
    name: string,
    base64: string,
    mimeType: string
  }[]>([]);
  
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
  const [resultsPage, setResultsPage] = useState(1);
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
  const [exportModal, setExportModal] = useState<{
    show: boolean;
    format: 'csv' | 'excel';
    filename: string;
  }>({
    show: false,
    format: 'csv',
    filename: ''
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

  const processImage = async (file: File) => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); 
      };
      reader.readAsDataURL(file);
    });

    const base64 = await base64Promise;
    return {
      name: file.name,
      base64,
      mimeType: file.type
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

  const onDropGeneratorImages = useCallback(async (acceptedFiles: File[]) => {
    setLoading(true);
    try {
      const processedArray = await Promise.all(acceptedFiles.map(file => processImage(file)));
      setGeneratorImages(prev => [...prev, ...processedArray]);
      toast.success(`${acceptedFiles.length} screenshot berhasil diunggah.`);
    } catch (error) {
      toast.error("Gagal memproses gambar.");
    } finally {
      setLoading(false);
    }
  }, []);

  const removeGeneratorImage = (index: number) => {
    setGeneratorImages(prev => prev.filter((_, i) => i !== index));
  };

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
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: results.length > 0 || loading
  });

  const imageDropzone = useDropzone({
    onDrop: onDropGeneratorImages,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: true,
    disabled: results.length > 0 || loading
  });

  const checkerPrdDropzone = useDropzone({
    onDrop: onDropCheckerPrd,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: loading
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
    multiple: false,
    disabled: loading
  });

  // Gemini Setup (Server Side Proxy)
  const callGemini = async (payload: any) => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json();
        let errorMsg = err.error || 'Gagal memanggil AI';
        if (errorMsg.includes("503") || errorMsg.includes("500") || errorMsg.includes("high demand") || errorMsg.includes("busy")) {
          errorMsg = "AI sedang mengalami gangguan sementara atau beban tinggi (Internal Server Error/High Demand). Kami sudah mencoba otomatis di background, silakan tunggu sejenak dan coba lagi.";
        }
        throw new Error(errorMsg);
      }
      return response.json();
    } catch (error: any) {
      if (error.message.includes("Failed to fetch")) {
        throw new Error("Koneksi ke server terputus. Pastikan internet Anda stabil.");
      }
      throw error;
    }
  };

  const generateTestCases = async () => {
    const hasInput = inputMode === 'manual' ? prdText.trim() : generatorFile;
    if (!hasInput) return;
    
    setInputError(null);
    // Word count check
    const inputText = inputMode === 'manual' ? prdText : (generatorFile?.rawText || "");
    if (inputText) {
      const wordCount = inputText.trim().split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < 15) {
        setInputError("Deskrip terlalu singkat. Tambahkan detail requirement (min. 15 kata) untuk hasil yang akurat.");
        return;
      }
    }

    const requiredFields = ['id_number', 'title', 'type', 'priority', 'preconditions', 'steps', 'expectedResult'];
    if (template === 'Gherkin') {
       // specific fields for gherkin in the schema
    }

    setLoading(true);
    setGeneratorCoverage(null);
    setResults([]);
    try {
      let contents: any[] = [];
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
        }
      }

      if (generatorImages.length > 0) {
        generatorImages.forEach(img => {
          parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
        });
        parts.push({ text: "Gunakan screenshot UI untuk test case yang lebih detail." });
      }

      const genPrompt = `Sebagai Senior Lead QA Engineer, Anda WAJIB menjamin TEST COVERAGE MINIMAL 85% terhadap PRD ini pada percobaan pertama. Jangan membuat hanya sedikit test case. Anda harus secara komprehensif menguji seluruh elemen yang ada dalam PRD.

PROSES WAJIB:
1. IDENTIFIKASI SEMUA ELEMEN PERSYARATAN: Ekstrak secara kritis setiap fitur utama, user flow, aturan bisnis (business rules), validation rules, kontrol akses/permission, error handling, edge cases, acceptance criteria, dan perilaku sistem yang dapat diuji dari PRD. Abaikan saja bagian heading non-testable seperti Purpose, Goals, Objectives, Overview, Background, Scope, Introduction, Summary.
2. DUKUNG COVERAGE MAKSIMAL (MINIMAL 85% COVERAGE): Buat minimal 1 test case untuk setiap requirement utama yang valid. Jika suatu requirement bersifat kompleks, buatlah beberapa skenario terpisah.
3. KOSONGKAN BATASAN JUMLAH: Buat jumlah test case yang memadai (misal 20 hingga 45 test case jika dokumen panjang) untuk menutupi seluruh aspek PRD, termasuk skenario positif, skenario negatif, dan edge case.
4. TEST DESIGN STRATEGY: Gunakan Boundary Value Analysis dan Equivalence Partitioning untuk input validation. Masukkan Negative flow untuk setiap Error Handling yang disebutkan di PRD.
5. SPESIFIK & REALISTIK: Gunakan data yang realistis dan relevan dengan konteks PRD.

KONFIGURASI:
- Template: ${template}
- Bahasa: ${language}
- Field 'coveredRequirement' WAJIB diisi dengan nama/kutipan requirement spesifik singkat dari PRD yang dicakup (misal: "AC 1: Login Valid" atau "Validation Rule: Email Format").

FORMAT OUTPUT: JSON sesuai schema dengan daftar test case yang komprehensif agar coverage mencapai 85%+ langsung di percobaan pertama.`;

      parts.push({ text: genPrompt });
      contents.push({ role: 'user', parts });

      const resultData = await callGemini({
        contents,
        modelConfig: {
          responseSchema: {
            type: "OBJECT",
            properties: {
              prefix: { type: "STRING" },
              testCases: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id_number: { type: "STRING" },
                    title: { type: "STRING" },
                    type: { type: "STRING", enum: ['Positive', 'Negative', 'Edge Case'] },
                    priority: { type: "STRING", enum: ['High', 'Medium', 'Low'] },
                    preconditions: { type: "STRING" },
                    steps: { type: "ARRAY", items: { type: "STRING" } },
                    expectedResult: { type: "STRING" },
                    coveredRequirement: { type: "STRING" },
                    given: { type: "STRING" },
                    when: { type: "STRING" },
                    then: { type: "STRING" },
                  }
                }
              }
            }
          }
        },
        systemInstruction: "You are a senior Lead QA Engineer specializing in exhaustive test design and requirement traceability."
      });

      const parsed = JSON.parse(resultData.text);
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
    } catch (error: any) {
      toast.error("Generation failed: " + error.message);
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
      let contents: any[] = [];
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
        } else if (checkerTestCaseFile.rawText) {
          parts.push({ text: `Existing Test Cases from File (${checkerTestCaseFile.name}):\n${checkerTestCaseFile.rawText}` });
        }
      } else if (sourceResults) {
        parts.push({ text: `Daftar Test Cases untuk Pencocokan Coverage:\n${sourceResults.map(tc => `[ID: ${tc.id}] Title: ${tc.title}, Requirement: ${tc.coveredRequirement || 'N/A'}, Expected: ${tc.expectedResult}`).join('\n')}` });
      }

      const prompt = `Analyze PRD coverage gaps. 
Lakukan evaluasi dengan SEMANTIC MATCHING yang adil, cerdas, dan realistis antara konten PRD dan daftar test case yang disediakan.
Gunakan field 'coveredRequirement' dan deskripsi/title/expectedResult di dalam test case untuk melakukan pemetaan.

Aturan Klasifikasi:
1. Full Coverage: Berikan klasifikasi ini jika requirement utama atau aturan bisnis dari PRD sudah dicakup oleh setidaknya satu test case (atau kombinasi positive-flow & validation flow). Jika test case dari requirement tersebut sudah menguji fungsionalitas intinya, maka requirement tersebut sudah dianggap LULUS coverage sepenuhnya.
2. Partial Coverage: Gunakan klasifikasi ini HANYA JIKA fungsionalitas kunci diuji tetapi ada edge case kritis atau skenario negatif vital yang terlewatkan.
3. Missing: Gunakan klasifikasi ini HANYA JIKA requirement dari PRD sama sekali tidak memiliki test case yang mengujinya baik secara langsung maupun tidak langsung.

PENTING: Jangan terlalu kaku atau pedantis. Jika fungsionalitas inti dari suatu requirement PRD sudah diuji, tandai sebagai Full Coverage agar nilai analisis coverage mencerminkan kondisi lapangan yang realistis (menargetkan 80-95% coverage bila test cases memang komprehensif). Abaikan semua bagian non-testable PRD seperti Purpose, Goals, Overview, Background, Scope, Introduction, Summary.

Return JSON format.`;
      parts.push({ text: prompt });
      contents.push({ role: 'user', parts });

      const resultData = await callGemini({
        contents,
        modelConfig: {
          responseSchema: {
            type: "OBJECT",
            properties: {
              fullCoverage: { 
                type: "ARRAY", 
                items: { 
                  type: "OBJECT",
                  properties: { requirement: { type: "STRING" }, matchedTestCaseIds: { type: "ARRAY", items: { type: "STRING" } }, reason: { type: "STRING" } }
                } 
              },
              partialCoverage: { 
                type: "ARRAY", 
                items: { 
                  type: "OBJECT",
                  properties: { requirement: { type: "STRING" }, matchedTestCaseIds: { type: "ARRAY", items: { type: "STRING" } }, missingAspects: { type: "ARRAY", items: { type: "STRING" } }, reason: { type: "STRING" } }
                } 
              },
              missingCoverage: { 
                type: "ARRAY", 
                items: { 
                  type: "OBJECT",
                  properties: { requirement: { type: "STRING" }, reason: { type: "STRING" } }
                } 
              },
              recommendations: { type: "STRING" }
            }
          }
        },
        systemInstruction: `Analisis dokumen PRD dan daftar test case. Manfaatkan field 'coveredRequirement' pada test case (jika ada) untuk pemetaan yang akurat. Language: ${language}`
      });

      const parsed = JSON.parse(resultData.text);
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
    } catch (error: any) {
      toast.error("Coverage check failed: " + error.message);
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
      const currentSelectedTemplate = results.length > 0 ? activeResultsTemplate : template;
      const trulyMissing = generatorCoverage.missingRequirements.filter(req => !isLikelyDuplicateRequirement(req.requirement, results));
      const trulyPartial = generatorCoverage.partiallyCovered.filter(req => !isLikelyDuplicateRequirement(req.requirement, results));

      let contents: any[] = [];
      let parts: any[] = [];
      const prompt = `Generate missing cases for coverage gaps. Requirements: ${JSON.stringify(trulyMissing.concat(trulyPartial))}`;
      parts.push({ text: prompt });
      contents.push({ role: 'user', parts });

      const resultData = await callGemini({
        contents,
        modelConfig: {
          responseSchema: {
            type: "OBJECT",
            properties: {
              testCases: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id_number: { type: "STRING" },
                    title: { type: "STRING" },
                    type: { type: "STRING", enum: ['Positive', 'Negative', 'Edge Case'] },
                    priority: { type: "STRING", enum: ['High', 'Medium', 'Low'] },
                    preconditions: { type: "STRING" },
                    steps: { type: "ARRAY", items: { type: "STRING" } },
                    expectedResult: { type: "STRING" },
                    coveredRequirement: { type: "STRING" }
                  }
                }
              }
            }
          }
        },
        systemInstruction: `QA Lead Expert. Fokus pada mengisi celah coverage (missing aspects). Language: ${language}`
      });

      const parsed = JSON.parse(resultData.text);
      const newCases: TestCase[] = (parsed.testCases || []).map((tc: any, i: number) => ({
        ...tc,
        id: `GAP-${String(results.length + i + 1).padStart(3, '0')}`,
        type: tc.type || 'Negative',
        priority: tc.priority || 'Medium',
        source: 'coverage-gap'
      }));
      setSuggestedMissingTestCases(newCases);
      toast.success("Gap scenarios generated!");
    } catch (error: any) {
      toast.error("GAP generation failed: " + error.message);
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
        <th className="px-6 py-4 min-w-[120px] whitespace-nowrap text-left flex items-center gap-2">
          <span>ID</span>
        </th>
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
      let contents: any[] = [];
      let parts: any[] = [];
      const prompt = `Regenerate exactly ONE test case that is DIFFERENT but tests the same feature area. Old Test Case: ${JSON.stringify(originalCase)}`;
      
      parts.push({ text: prompt });
      if (inputMode === 'manual') {
        parts.push({ text: `PRD Context:\n${prdText}` });
      } else if (generatorFile) {
        if (generatorFile.mimeType === 'application/pdf') {
          parts.push({ inlineData: { data: generatorFile.base64, mimeType: generatorFile.mimeType } });
        } else {
          parts.push({ text: `PRD Context:\n${generatorFile.rawText}` });
        }
      }

      contents.push({ role: 'user', parts });

      const resultData = await callGemini({
        contents,
        modelConfig: {
          responseSchema: {
            type: "OBJECT",
            properties: {
              id_number: { type: "STRING" },
              title: { type: "STRING" },
              type: { type: "STRING", enum: ['Positive', 'Negative', 'Edge Case'] },
              priority: { type: "STRING", enum: ['High', 'Medium', 'Low'] },
              preconditions: { type: "STRING" },
              steps: { type: "ARRAY", items: { type: "STRING" } },
              expectedResult: { type: "STRING" },
              coveredRequirement: { type: "STRING" },
              given: { type: "STRING" },
              when: { type: "STRING" },
              then: { type: "STRING" },
            }
          }
        },
        systemInstruction: `Senior Lead QA Engineer. Language: ${language}`
      });

      const tc = JSON.parse(resultData.text);
      const updatedCase: TestCase = { ...tc, id, source: originalCase.source };

      if (isSuggested) {
        setSuggestedMissingTestCases(prev => prev.map(r => r.id === id ? updatedCase : r));
      } else {
        setResults(prev => prev.map(r => r.id === id ? updatedCase : r));
      }
      toast.success("Test case diperbarui!");
    } catch (error: any) {
      toast.error("Regeneration failed: " + error.message);
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

  const openExportModal = (format: 'csv' | 'excel') => {
    setExportModal({
      show: true,
      format,
      filename: ''
    });
  };

  const handleExportConfirm = () => {
    handleExport(exportModal.format, exportModal.filename);
    setExportModal(prev => ({ ...prev, show: false }));
  };

  const handleExport = (format: 'csv' | 'excel', filename: string) => {
    if (format === 'csv') {
      exportCSV(filename);
    } else {
      exportExcel(filename);
    }
  };

  const fullReset = () => {
    setConfirmation({
      show: true,
      title: 'Hapus Semua?',
      message: 'Yakin ingin menghapus semua hasil saat ini?',
      onConfirm: () => {
        setResults([]);
        setGeneratorImages([]);
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
    setResultsPage(1); // Reset page on filter/search change
    return generateTestCasesBatch().filter(tc => {
      const matchesFilter = activeFilter === 'All' || tc.type === activeFilter;
      const matchesSearch = tc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            tc.expectedResult.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [generateTestCasesBatch, activeFilter, searchQuery]);

  const paginatedResults = useMemo(() => {
    const startIndex = (resultsPage - 1) * pageSize;
    return filteredResults.slice(startIndex, startIndex + pageSize);
  }, [filteredResults, resultsPage]);

  const totalPages = Math.ceil(filteredResults.length / pageSize);

  const copyToClipboard = () => {
    const text = JSON.stringify(filteredResults, null, 2);
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const exportCSV = (filename?: string) => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (activeResultsTemplate === 'Simple') {
      headers = ['ID', 'Type', 'Test Case', 'Steps', 'Expected Result'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.title, tc.steps.join('\n'), tc.expectedResult]);
    } else if (activeResultsTemplate === 'Gherkin') {
      headers = ['ID', 'Type', 'Scenario', 'Given', 'When', 'Then'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.title, tc.given || 'N/A', tc.when || 'N/A', tc.then || tc.expectedResult]);
    } else if (activeResultsTemplate === 'Jira/Zephyr') {
      headers = ['ID', 'Type', 'Priority', 'Precondition', 'Title / Scenario', 'Steps', 'Expected'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.priority, tc.preconditions || '-', tc.title, tc.steps.join('\n'), tc.expectedResult]);
    } else if (activeResultsTemplate === 'TestRail') {
      headers = ['ID', 'Type', 'Title', 'Steps', 'Expected Result', 'Priority'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.title, tc.steps.join('\n'), tc.expectedResult, tc.priority]);
    }
    
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(item => `"${(item || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const finalFilename = filename || `test_cases_${new Date().getTime()}`;
    saveAs(blob, `${finalFilename}.csv`);
    toast.success("CSV berhasil di-export!");
  };

  const exportExcel = (filename?: string) => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (activeResultsTemplate === 'Simple') {
      headers = ['ID', 'Type', 'Test Case', 'Steps', 'Expected Result'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.title, tc.steps.join('\n'), tc.expectedResult]);
    } else if (activeResultsTemplate === 'Gherkin') {
      headers = ['ID', 'Type', 'Scenario', 'Given', 'When', 'Then'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.title, tc.given || 'N/A', tc.when || 'N/A', tc.then || tc.expectedResult]);
    } else if (activeResultsTemplate === 'Jira/Zephyr') {
      headers = ['ID', 'Type', 'Priority', 'Precondition', 'Title / Scenario', 'Steps', 'Expected'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.priority, tc.preconditions || '-', tc.title, tc.steps.join('\n'), tc.expectedResult]);
    } else if (activeResultsTemplate === 'TestRail') {
      headers = ['ID', 'Type', 'Title', 'Steps', 'Expected Result', 'Priority'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.title, tc.steps.join('\n'), tc.expectedResult, tc.priority]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const finalFilename = filename || `test_cases_${new Date().getTime()}`;
    saveAs(blob, `${finalFilename}.xlsx`);
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
    <div className={cn(
      "min-h-screen text-[#1E293B] font-sans selection:bg-blue-100 overflow-x-hidden transition-colors duration-500",
      appPage === 'home' ? "bg-transparent" : "bg-gradient-to-br from-blue-50 via-white to-blue-100"
    )}>
      {appPage === 'home' ? (
        <div className="min-h-screen">
          <Hero3DScene />
          
          {/* Landing Header */}
          <header className="fixed top-0 left-0 right-0 h-20 bg-transparent flex items-center justify-between px-10 z-50">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <AppLogo />
            </div>

            <nav className="hidden lg:flex items-center gap-8 bg-white/5 backdrop-blur-xl px-8 py-3 rounded-2xl border border-white/10 shadow-2xl">
              <button 
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
              >
                How it Works
              </button>
              <button 
                onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
              >
                Tools
              </button>
              <button 
                onClick={() => document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
              >
                About
              </button>
            </nav>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                className="px-6 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30 active:scale-95"
              >
                Launch App
              </button>
            </div>
          </header>

          <div className="pt-32 pb-20 px-8 max-w-6xl mx-auto relative z-10">
            <div id="hero" className="text-center mb-20 relative z-10">
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-7xl font-black text-white mb-6 tracking-tight"
              >
                QA Copilot
              </motion.h2>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-xl text-blue-400 font-bold mb-6 uppercase tracking-[0.25em]"
              >
                AI Test Toolkit Platform
              </motion.p>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-slate-300 max-w-3xl mx-auto text-xl leading-relaxed font-medium mb-12"
              >
                Generate structured test cases, check coverage gaps across documentation, and prepare high-quality QA reports with the power of Gemini AI.
              </motion.p>

              <motion.div 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.25 }}
                 className="flex flex-wrap justify-center gap-12 mb-20"
              >
                <div className="text-center">
                  <div className="text-4xl font-black text-white mb-1">98%</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Efficiency gain</div>
                </div>
                <div className="w-px h-12 bg-white/10 hidden sm:block" />
                <div className="text-center">
                  <div className="text-4xl font-black text-white mb-1">2.0v</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Gemini Intelligence</div>
                </div>
                <div className="w-px h-12 bg-white/10 hidden sm:block" />
                <div className="text-center">
                  <div className="text-4xl font-black text-white mb-1">Zero</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Setup required</div>
                </div>
              </motion.div>
            </div>

            <div id="tools" className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <motion.div 
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white/10 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/10 shadow-2xl hover:bg-white/15 transition-all group"
              >
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(37,99,235,0.3)] group-hover:scale-110 transition-transform">
                  <Zap className="text-white w-8 h-8 fill-white" />
                </div>
                <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Test Case Generator</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-10 font-medium">
                  Generate structured test cases from requirements, PRD files, and UI screenshots automatically.
                </p>
                <button 
                  onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                  className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/30"
                >
                  Start Generator
                </button>
              </motion.div>

              <motion.div 
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-white/10 backdrop-blur-2xl p-10 rounded-[3rem] border border-emerald-500/20 shadow-2xl hover:bg-white/15 transition-all group"
              >
                <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform">
                  <PieChart className="text-white w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Coverage Checker</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-10 font-medium">
                  Compare your existing test cases with PRD documentation to identify missing coverage gaps.
                </p>
                <button 
                  onClick={() => { setAppPage('coverage'); setActiveFeature('coverage'); }}
                  className="w-full py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-emerald-500 transition-all active:scale-95 shadow-lg shadow-emerald-600/30"
                >
                  Check Coverage
                </button>
              </motion.div>

              <motion.div 
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-white/10 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/10 border-dashed shadow-2xl hover:bg-white/15 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-6 right-6 px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase text-slate-400 tracking-widest">Beta</div>
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 shadow-lg group-hover:scale-110 transition-transform">
                  <Bug className="text-white w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Bug Report Gen</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-10 font-medium">
                  Transform bug findings and visual evidence into professional, developer-ready issue reports.
                </p>
                <button 
                  onClick={() => setAppPage('bug_report')}
                  className="w-full py-4 bg-white/20 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-white/30 transition-all active:scale-95"
                >
                  Open Bug Report
                </button>
              </motion.div>
            </div>

            {/* How It Works Section */}
            <div id="how-it-works" className="mt-40 mb-40">
              <div className="text-center mb-20">
                <h3 className="text-4xl font-black text-white mb-4 tracking-tight">How It Works</h3>
                <p className="text-slate-400 font-medium">Three simple steps to professional QA documentation</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                {/* Connecting Lines (Desktop) */}
                <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 z-0" />
                
                {[
                  { icon: <Upload className="w-6 h-6" />, title: "1. Input Context", desc: "Upload PRD, technical docs, or simply paste your feature requirements." },
                  { icon: <Zap className="w-6 h-6" />, title: "2. AI Processing", desc: "Gemini 2.0 analyzes requirements and screenshots to build exhaustive scenarios." },
                  { icon: <Download className="w-6 h-6" />, title: "3. Export & Sync", desc: "Download in XLSX/CSV format or copy Gherkin scripts for your automation." }
                ].map((step, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.2 }}
                    className="flex flex-col items-center text-center relative z-10"
                  >
                    <div className="w-16 h-16 bg-blue-600/30 rounded-2xl flex items-center justify-center border border-blue-500/40 text-blue-400 mb-6 shadow-xl shadow-blue-900/60 backdrop-blur-md">
                      {step.icon}
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">{step.title}</h4>
                    <p className="text-slate-300 text-sm leading-relaxed px-4">{step.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Benefit Grid */}
            <div id="features" className="mb-40">
              <div className="text-center mb-20">
                <h3 className="text-4xl font-black text-white mb-4 tracking-tight">Built for Modern Teams</h3>
                <p className="text-slate-400 font-medium">Powerful features to accelerate your testing lifecycle</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: <Globe className="w-5 h-5" />, title: "Multi-Language", desc: "Support for English and Indonesian localization." },
                  { icon: <Shield className="w-5 h-5" />, title: "Privacy First", desc: "Your internal docs are processed securely and never stored permanently." },
                  { icon: <LayoutDashboard className="w-5 h-5" />, title: "Multiple Formats", desc: "XLSX, CSV, and Gherkin / BDD compatible output." },
                  { icon: <History className="w-5 h-5" />, title: "Session History", desc: "Automatically saves your recent sessions locally." }
                ].map((item, idx) => (
                  <div key={idx} className="p-8 rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/10 hover:bg-white/15 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6">
                      {item.icon}
                    </div>
                    <h5 className="text-lg font-bold text-white mb-2">{item.title}</h5>
                    <p className="text-slate-300 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <footer id="footer" className="border-t border-white/5 pt-12 pb-12 mt-20">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-3 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <AppLogo size="sm" theme="dark" />
                </div>
                <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-blue-400 transition-colors">Features</button>
                  <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-blue-400 transition-colors">How it Works</button>
                  <button onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-blue-400 transition-colors">Tools</button>
                  <a href="#" className="hover:text-blue-400 transition-colors">Documentation</a>
                </div>
                <div className="text-[10px] font-medium text-slate-400 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-[#020617] bg-slate-800" />
                    ))}
                  </div>
                  <span>Trusted by 50+ QA Teams</span>
                </div>
              </div>
              <div className="mt-12 text-center text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
                &copy; 2024 QA Copilot AI. All rights reserved.
              </div>
            </footer>
          </div>
        </div>
      ) : (
        <div className="min-h-screen">
          {/* Tools Header */}
          <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-50">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setAppPage('home')}>
              <AppLogo theme="light" />
            </div>

            <nav className="flex absolute left-1/2 -translate-x-1/2 items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60 shadow-sm">
              <button 
                onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                  appPage === 'generator' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Zap className={cn("w-3.5 h-3.5", appPage === 'generator' ? "fill-blue-600" : "fill-none")} />
                Generator
              </button>
              <button 
                onClick={() => { setAppPage('coverage'); setActiveFeature('coverage'); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                  appPage === 'coverage' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <PieChart className="w-3.5 h-3.5" />
                Coverage
              </button>
              <button 
                onClick={() => setAppPage('bug_report')}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                  appPage === 'bug_report' ? "bg-slate-800 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Bug className="w-3.5 h-3.5" />
                Bug Report
              </button>
            </nav>

            <div className="flex items-center gap-4 ml-auto">
              {appPage !== 'bug_report' && (
                <button 
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/50 border border-blue-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-blue-600 transition-all shadow-sm"
                >
                  <History className="w-4 h-4" />
                  History
                </button>
              )}
              <div className="flex items-center gap-2 px-3 py-1 bg-white/50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Tsuzui
              </div>
            </div>
          </header>

          {appPage === 'bug_report' ? (
            <div className="pt-16 min-h-screen flex items-center justify-center p-8 bg-white">
              <div className="text-center max-w-lg">
                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-pulse">
                  <Bug className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">Bug Report Generator</h2>
                <p className="text-blue-600 font-bold uppercase tracking-[0.2em] mb-6 text-sm">Coming Soon / Open Beta</p>
                <p className="text-slate-500 mb-10 font-medium text-lg leading-relaxed">
                  This tool will help QA engineers turn manual discovery into structured bug reports with reproduction steps, technical data, and screenshots.
                </p>
                <button 
                  onClick={() => setAppPage('home')}
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center gap-2 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </button>
              </div>
            </div>
          ) : (
            <main className="pt-16 min-h-screen flex">
          {/* Side Pane */}
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
                <div className="relative group">
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
                  <div className="absolute bottom-4 right-5 flex items-center gap-1.5 px-2.5 py-1 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full shadow-sm">
                    <Hash className={cn("w-3 h-3", prdText.trim().split(/\s+/).filter(w => w.length > 0).length >= 15 ? "text-emerald-500" : "text-slate-400")} />
                    <span className={cn(
                      "text-[10px] font-bold",
                      prdText.trim().split(/\s+/).filter(w => w.length > 0).length >= 15 ? "text-emerald-600" : "text-slate-500"
                    )}>
                      {prdText.trim().split(/\s+/).filter(w => w.length > 0).length} / 15 kata
                    </span>
                  </div>
                </div>
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

              {/* UI Screenshots (Optional) Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest opacity-60">UI Screenshots / Wireframe (Optional)</p>
                  {generatorImages.length > 0 && (
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{generatorImages.length} images</span>
                  )}
                </div>
                
                <div 
                  {...imageDropzone.getRootProps()} 
                  className={cn(
                    "flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all py-6",
                    results.length > 0 ? "cursor-not-allowed opacity-40 border-slate-200" : imageDropzone.isDragActive ? "border-blue-500 bg-blue-50 cursor-pointer" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-200 cursor-pointer"
                  )}
                >
                  <input {...imageDropzone.getInputProps()} disabled={results.length > 0} />
                  <PlusCircle className="w-6 h-6 text-slate-400 mb-2" />
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-6 text-center leading-relaxed">
                    Unggah Screenshot atau UI Design
                  </p>
                </div>

                {generatorImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {generatorImages.map((img, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white">
                        <img 
                          src={`data:${img.mimeType};base64,${img.base64}`} 
                          alt={img.name} 
                          className="w-full h-full object-cover"
                        />
                        {results.length === 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeGeneratorImage(idx); }}
                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                        disabled={results.length > 0}
                        onChange={(e) => handleTemplateChange(e.target.value as TemplateType)}
                        className={cn(
                          "w-full bg-white/60 border border-blue-100 rounded-xl px-4 py-2 text-[11px] outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all appearance-none",
                          results.length > 0 && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-blue-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                </div>

                {results.length > 0 && (
                  <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                    <Info className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[9px] text-amber-700 leading-tight">
                      Template & Layout dikunci untuk menjaga konsistensi data. Reset session untuk mengubah.
                    </p>
                  </div>
                )}

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
                      <button onClick={() => openExportModal('csv')} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 transition-all shadow-sm active:scale-95">
                        <Download className="w-4 h-4" />
                        CSV
                      </button>
                      <button onClick={() => openExportModal('excel')} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 transition-all shadow-sm active:scale-95">
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
                               <button onClick={() => setResultsPage(prev => Math.max(1, prev - 1))} disabled={resultsPage === 1} className="p-1.5 rounded-lg bg-white border border-blue-100 text-blue-600 disabled:opacity-30">
                                 <Undo2 className="w-3.5 h-3.5 rotate-90" />
                               </button>
                               <span className="px-3">Page {resultsPage} of {totalPages}</span>
                               <button onClick={() => setResultsPage(prev => Math.min(totalPages, prev + 1))} disabled={resultsPage === totalPages} className="p-1.5 rounded-lg bg-white border border-blue-100 text-blue-600 disabled:opacity-30">
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
      )}

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

        {/* Export Modal */}
        {exportModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExportModal(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                  {exportModal.format === 'csv' ? <Download className="w-8 h-8 text-blue-600" /> : <FileBox className="w-8 h-8 text-emerald-600" />}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Export Data (.{exportModal.format})</h3>
                <p className="text-sm text-slate-500 mb-6">Masukkan nama file jika ingin custom, atau kosongkan untuk nama otomatis.</p>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nama File (Optional)</label>
                    <input 
                      type="text" 
                      value={exportModal.filename}
                      onChange={(e) => setExportModal(prev => ({ ...prev, filename: e.target.value }))}
                      placeholder="Contoh: checkout_flows_v1"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 font-medium"
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
                    <Info className="w-4 h-4 text-slate-400 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-tight">
                      File akan disimpan sebagai <span className="font-bold text-slate-700">{exportModal.filename || 'test_cases_TIMESTAMP'}.{exportModal.format}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex p-4 gap-3 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setExportModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleExportConfirm}
                  className={cn(
                    "flex-1 py-3.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg",
                    exportModal.format === 'csv' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  )}
                >
                  Download {exportModal.format.toUpperCase()}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Toaster */}
      <Toaster position="top-center" richColors />
          </div>
        )}
    </div>
  );
}
