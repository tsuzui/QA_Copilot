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
  ArrowRight,
  FileBox,
  PieChart,
  CopyPlus,
  PlusCircle,
  Home,
  Bug,
  Shield,
  Sun,
  Moon,
  LayoutDashboard,
  Lightbulb,
  AlertTriangle
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
import { TestCase, TestCaseType, TemplateType, LanguageType, HistoryItem, CoverageItem, CoverageResult, CoverageHistoryItem, BugReportHistoryItem, ReqQualityHistoryItem } from './types.ts';

// Model config
const MODAL_NAME = "gemini-2.0-flash";

const TEMPLATES: TemplateType[] = ['Simple', 'Gherkin', 'Jira/Zephyr', 'TestRail'];
const FILTERS: (TestCaseType | 'All')[] = ['All', 'Positive', 'Negative', 'Edge Case'];
const LANGUAGES: LanguageType[] = ['Indonesia', 'English'];

const PREVIOUS_SESSIONS_KEY = 'qa_copilot_history';
const PREVIOUS_COVERAGE_KEY = 'qa_copilot_coverage_history';
const PREVIOUS_BUG_REPORT_KEY = 'qa_copilot_bug_report_history';
const PREVIOUS_REQ_QUALITY_KEY = 'qa_copilot_req_quality_history';

const getFileHash = (file: { name: string; base64: string; rawText?: string } | null): string => {
  if (!file) return '';
  const contentToHash = file.rawText || file.base64 || file.name || '';
  let hash = 0;
  for (let i = 0; i < contentToHash.length; i++) {
    const char = contentToHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${file.name}_${hash}`;
};

const getResultsHash = (tcList: TestCase[]): string => {
  if (!tcList || tcList.length === 0) return '';
  const contentToHash = JSON.stringify(tcList.map(tc => ({ id: tc.id, title: tc.title, type: tc.type, expected: tc.expectedResult })));
  let hash = 0;
  for (let i = 0; i < contentToHash.length; i++) {
    const char = contentToHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `results_${hash}`;
};

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
    <div className={cn("p-4 rounded-2xl text-xs text-slate-700 flex flex-col gap-2 shadow-sm", bgMap[status])}>
      <div className="flex gap-3">
        {iconMap[status]}
        <div className="flex flex-col gap-1 flex-1">
          {item.requirementId && (
            <span className="text-[9px] font-mono font-bold text-slate-400 tracking-wider">
              {item.requirementId}
            </span>
          )}
          <span className={cn("font-semibold leading-relaxed", status === 'missing' ? "text-rose-950 font-bold" : "text-slate-800")}>
            {item.requirement}
          </span>
        </div>
      </div>
      
      {item.matchedTestCases && item.matchedTestCases.length > 0 && (
        <div className="ml-7 flex flex-col gap-1.5 pt-1 border-t border-slate-100/30">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Matched Scenarios:</span>
          <div className="flex flex-col gap-1.5">
            {item.matchedTestCases.slice(0, 3).map((tc) => (
              <div key={tc.id} className="flex items-start gap-2 text-[11px] leading-snug text-slate-700 bg-white border border-slate-100/60 p-2 rounded-lg shadow-xs hover:border-slate-200 transition-colors">
                <span className="font-mono font-bold text-emerald-600 shrink-0">{tc.id}</span>
                <span className="text-slate-300 shrink-0 font-light">—</span>
                <span className="font-medium text-slate-600">{tc.title}</span>
              </div>
            ))}
            {item.matchedTestCases.length > 3 && (
              <div className="text-[10px] font-bold text-emerald-600 pl-1">
                +{item.matchedTestCases.length - 3} more matched test cases
              </div>
            )}
          </div>
        </div>
      )}

      {item.missingAspects && item.missingAspects.length > 0 && (
        <div className="ml-7 space-y-1 pt-1 border-t border-slate-100/30">
          <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider">Missing Aspects:</p>
          <div className="space-y-1">
            {item.missingAspects.map((aspect, idx) => (
              <p key={idx} className="text-[11px] text-amber-800 leading-snug">• {aspect}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const renderRecommendationText = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  return (
    <ul className="space-y-2.5 list-none">
      {lines.map((line, idx) => {
        let cleanedLine = line.replace(/^([-*•\d+.]\s*)+/, '');
        if (!cleanedLine) return null;
        // Strip out any ** markers
        cleanedLine = cleanedLine.replace(/\*\*/g, '');
        return (
          <li key={idx} className="flex items-start gap-2.5 text-[11px] sm:text-xs leading-relaxed font-normal text-slate-600 bg-white/50 hover:bg-white/80 p-2 rounded-xl border border-slate-100/50 shadow-2xs transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shrink-0 mt-1.5 shadow-sm" />
            <span className="flex-1 min-w-0">{cleanedLine}</span>
          </li>
        );
      })}
    </ul>
  );
};

export const getToolTheme = (page: string) => {
  switch (page) {
    case 'generator':
      return {
        slug: 'generator',
        primary: 'pink-600',
        hover: 'hover:bg-pink-700',
        text: 'text-pink-600',
        textDark: 'text-pink-905',
        bg: 'bg-pink-600',
        bgLight: 'bg-pink-50',
        bgLight15: 'bg-pink-50/15',
        border: 'border-pink-100',
        borderMedium: 'border-pink-200',
        borderFocus: 'focus:border-pink-500',
        ring: 'focus:ring-pink-500/10',
        glow: 'shadow-pink-600/20 shadow-lg',
        glowSm: 'shadow-pink-600/15',
        badge: 'bg-pink-50 text-pink-750 border-pink-100',
        bullet: 'bg-pink-500',
        fill: 'fill-pink-600'
      };
    case 'coverage':
      return {
        slug: 'coverage',
        primary: 'emerald-600',
        hover: 'hover:bg-emerald-700',
        text: 'text-emerald-600',
        textDark: 'text-emerald-950',
        bg: 'bg-emerald-600',
        bgLight: 'bg-emerald-50',
        bgLight15: 'bg-emerald-50/15',
        border: 'border-emerald-100',
        borderMedium: 'border-emerald-200',
        borderFocus: 'focus:border-emerald-500',
        ring: 'focus:ring-emerald-500/10',
        glow: 'shadow-emerald-600/20 shadow-lg',
        glowSm: 'shadow-emerald-600/15',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        bullet: 'bg-emerald-500',
        fill: 'fill-emerald-600'
      };
    case 'bug_report':
      return {
        slug: 'bug_report',
        primary: 'orange-600',
        hover: 'hover:bg-orange-700',
        text: 'text-orange-600',
        textDark: 'text-orange-950',
        bg: 'bg-orange-600',
        bgLight: 'bg-orange-50',
        bgLight15: 'bg-orange-50/15',
        border: 'border-orange-100',
        borderMedium: 'border-orange-200',
        borderFocus: 'focus:border-orange-500',
        ring: 'focus:ring-orange-500/10',
        glow: 'shadow-orange-600/20 shadow-lg',
        glowSm: 'shadow-orange-600/15',
        badge: 'bg-orange-50 text-orange-700 border-orange-100',
        bullet: 'bg-orange-500',
        fill: 'fill-orange-600'
      };
    case 'requirement_checker':
      return {
        slug: 'requirement_checker',
        primary: 'violet-600',
        hover: 'hover:bg-violet-700',
        text: 'text-violet-600',
        textDark: 'text-violet-900',
        bg: 'bg-violet-600',
        bgLight: 'bg-violet-50',
        bgLight15: 'bg-violet-50/15',
        border: 'border-violet-100',
        borderMedium: 'border-violet-200',
        borderFocus: 'focus:border-violet-500',
        ring: 'focus:ring-violet-500/10',
        glow: 'shadow-violet-600/20 shadow-lg',
        glowSm: 'shadow-violet-600/15',
        badge: 'bg-violet-50 text-violet-700 border-violet-100',
        bullet: 'bg-violet-500',
        fill: 'fill-violet-600'
      };
    default:
      return {
        slug: 'default',
        primary: 'blue-600',
        hover: 'hover:bg-blue-700',
        text: 'text-blue-600',
        textDark: 'text-blue-900',
        bg: 'bg-blue-600',
        bgLight: 'bg-blue-50',
        bgLight15: 'bg-blue-50/15',
        border: 'border-blue-100',
        borderMedium: 'border-blue-200',
        borderFocus: 'focus:border-blue-500',
        ring: 'focus:ring-blue-500/10',
        glow: 'shadow-blue-600/20 shadow-lg',
        glowSm: 'shadow-blue-600/15',
        badge: 'bg-blue-50 text-blue-700 border-blue-100',
        bullet: 'bg-blue-500',
        fill: 'fill-blue-600'
      };
  }
};

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const isAppDark = theme === 'dark';

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Feature Selection
  const [activeFeature, setActiveFeature] = useState<'generator' | 'coverage'>('generator');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  // Navigation state
  const [appPage, setAppPage] = useState<'home' | 'generator' | 'coverage' | 'bug_report' | 'requirement_checker'>('home');
  
  // Interactive Walkthrough for "How It Works"
  const [activeJourneyStep, setActiveJourneyStep] = useState(0);
  const [isWalkthroughTimerPaused, setIsWalkthroughTimerPaused] = useState(false);

  useEffect(() => {
    if (appPage !== 'home' || isWalkthroughTimerPaused) return;
    const interval = setInterval(() => {
      setActiveJourneyStep((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(interval);
  }, [appPage, isWalkthroughTimerPaused]);
  
  useEffect(() => {
    if (appPage === 'home') {
      document.body.style.backgroundColor = '#020617';
    } else {
      document.body.style.backgroundColor = theme === 'dark' ? '#070b19' : '#f8fafc';
    }
  }, [appPage, theme]);
  
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

  // Bug Report Generator State
  const [bugReportMode, setBugReportMode] = useState<'manual' | 'screenshot'>('manual');
  const [bugDescription, setBugDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [bugEnvironment, setBugEnvironment] = useState('');
  const [bugSeverity, setBugSeverity] = useState('Medium');
  const [bugPriority, setBugPriority] = useState('Medium');
  const [bugScreenshot, setBugScreenshot] = useState<{
    name: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [generatedBugReport, setGeneratedBugReport] = useState<{
    title: string;
    summary: string;
    steps: string[];
    expected: string;
    actual: string;
    severity: string;
    priority: string;
    environment?: string;
    uiElements?: string[];
    rootCause?: string;
    devNote: string;
  } | null>(null);
  const [isGeneratingBugReport, setIsGeneratingBugReport] = useState(false);
  const [bugReportError, setBugReportError] = useState<string | null>(null);

  // Requirement Quality Checker State
  const [reqInputMode, setReqInputMode] = useState<'manual' | 'upload'>('manual');
  const [reqText, setReqText] = useState('');
  const [reqFile, setReqFile] = useState<{
    name: string,
    base64: string,
    mimeType: string,
    rawText?: string
  } | null>(null);
  const [analyzingReq, setAnalyzingReq] = useState(false);
  const [reqAnalysisError, setReqAnalysisError] = useState<string | null>(null);
  const [reqAnalysisResult, setReqAnalysisResult] = useState<{
    qualityScore: number;
    qualityLabel: 'Good' | 'Needs Improvement' | 'Poor';
    summary: string;
    issuesFound: {
      id: string;
      requirementText: string;
      issueType: string;
      explanation: string;
      suggestedRewrite: string;
    }[];
    improvedRequirementDraft: string;
    qaNotes: string;
  } | null>(null);
  const [reqResultTab, setReqResultTab] = useState<'issues' | 'draft' | 'notes'>('issues');

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
  const [isFromHistory, setIsFromHistory] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => {
    const stored = localStorage.getItem(PREVIOUS_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [coverageHistoryList, setCoverageHistoryList] = useState<CoverageHistoryItem[]>(() => {
    const stored = localStorage.getItem(PREVIOUS_COVERAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [bugReportHistoryList, setBugReportHistoryList] = useState<BugReportHistoryItem[]>(() => {
    const stored = localStorage.getItem(PREVIOUS_BUG_REPORT_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [reqQualityHistoryList, setReqQualityHistoryList] = useState<ReqQualityHistoryItem[]>(() => {
    const stored = localStorage.getItem(PREVIOUS_REQ_QUALITY_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [activePrdHash, setActivePrdHash] = useState<string>('');
  const [extractedRequirements, setExtractedRequirements] = useState<{ id: string; requirement: string }[]>([]);
  const [prdRequirementsCache, setPrdRequirementsCache] = useState<Record<string, { id: string; requirement: string }[]>>({});
  const [coverageResultsCache, setCoverageResultsCache] = useState<Record<string, CoverageResult>>({});
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
      alert("Failed to process PRD.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDropGeneratorImages = useCallback(async (acceptedFiles: File[]) => {
    setLoading(true);
    try {
      const processedArray = await Promise.all(acceptedFiles.map(file => processImage(file)));
      setGeneratorImages(prev => [...prev, ...processedArray]);
      toast.success(`${acceptedFiles.length} screenshots uploaded successfully.`);
    } catch (error) {
      toast.error("Failed to process image.");
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
      alert("Failed to process PRD.");
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
      alert("Failed to process Test Case file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDropReqFile = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setLoading(true);
    setReqAnalysisError(null);
    try {
      const processed = await processFile(file);
      setReqFile(processed);
      toast.success(`PRD file "${file.name}" uploaded successfully.`);
    } catch (error) {
      toast.error("Failed to process PRD file.");
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

  const reqFileDropzone = useDropzone({
    onDrop: onDropReqFile,
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
        let errorMsg = err.error || 'Failed to connect to AI';
        if (response.status === 429 || errorMsg.includes("Quota") || errorMsg.includes("quota") || errorMsg.includes("limit") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
          errorMsg = "Your free daily Gemini API quota has been exceeded. Please go to Settings > Secrets to configure your own Gemini API Key, or select our paid model flow to continue testing without limits.";
        } else if (errorMsg.includes("503") || errorMsg.includes("500") || errorMsg.includes("high demand") || errorMsg.includes("busy")) {
          errorMsg = "The AI service is temporarily overloaded or experiencing high demand (Internal Server Error). We've attempted auto-retries in the background, please wait a moment and try again.";
        }
        throw new Error(errorMsg);
      }
      return response.json();
    } catch (error: any) {
      if (error.message.includes("Failed to fetch")) {
        throw new Error("Connection to server was lost. Please check your internet connection.");
      }
      throw error;
    }
  };

  const robustJSONParse = (jsonString: string): any => {
    if (!jsonString) {
      throw new Error("Pernyataan kosong diterima dari AI");
    }
    let clean = jsonString.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-zA-Z]*\n?/, "");
      clean = clean.replace(/\n?```$/, "");
    }
    clean = clean.trim();
    
    try {
      return JSON.parse(clean);
    } catch (e) {
      // Clean trailing commas that commonly break JSON.parse
      let normalized = clean
        .replace(/,\s*\]/g, ']')
        .replace(/,\s*\}/g, '}');
      try {
        return JSON.parse(normalized);
      } catch (nestedErr) {
        console.error("Failed to parse JSON even after normalization:", clean);
        throw new Error("Format respons yang diterima dari AI tidak valid. Silakan coba generate ulang.");
      }
    }
  };

  const getGherkinParts = (tc: TestCase, lang: LanguageType) => {
    const isIndo = lang === 'Indonesia';
    
    const cleanValue = (val?: string) => {
      if (!val) return null;
      const stripped = val.trim();
      if (/^(n\/a|na|none|-|tidak ada)$/i.test(stripped)) return null;
      return stripped;
    };

    const rawGiven = cleanValue(tc.given);
    const rawWhen = cleanValue(tc.when);
    const rawThen = cleanValue(tc.then);

    let givenResult = rawGiven;
    if (!givenResult) {
      const precon = cleanValue(tc.preconditions);
      if (precon) {
        givenResult = precon;
      } else {
        givenResult = isIndo 
          ? "Pengguna berada pada halaman utama sistem" 
          : "User is on the main system page";
      }
    }

    let whenResult = rawWhen;
    if (!whenResult) {
      if (tc.steps && tc.steps.length > 0) {
        const firstStepClean = tc.steps[0].replace(/^(\d+\.\s*|dan\s+|and\s+|user\s+|pengguna\s+)/i, '');
        whenResult = isIndo
          ? `Pengguna melakukan aksi: ${firstStepClean}`
          : `User performs action: ${firstStepClean}`;
      } else {
        whenResult = isIndo
          ? `Pengguna melakukan: ${tc.title}`
          : `User performs: ${tc.title}`;
      }
    }

    let thenResult = rawThen;
    if (!thenResult) {
      const expected = cleanValue(tc.expectedResult);
      if (expected) {
        thenResult = expected;
      } else {
        thenResult = isIndo
          ? "Sistem menampilkan hasil yang diharapkan"
          : "System displays the expected results";
      }
    }

    return {
      given: givenResult,
      when: whenResult,
      then: thenResult
    };
  };

  const renderOnboardingLanding = () => {
    return (
      <div className="max-w-4xl mx-auto px-6 py-4 text-left w-full">
        {loading ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-pink-100 dark:border-pink-900/35 rounded-3xl shadow-xl w-full animate-pulse">
            <div className="relative">
              <div className="w-12 h-12 bg-pink-100/50 dark:bg-pink-950/40 rounded-full animate-ping absolute inset-0" />
              <Loader2 className="w-12 h-12 text-pink-600 dark:text-pink-400 animate-spin relative" />
            </div>
            <p className="text-sm text-pink-900 dark:text-pink-100 font-bold uppercase tracking-widest">Generating...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-md transition-all duration-300">
            {/* Left visual representation: Simulating Coverage Gauge */}
            <div className="md:col-span-12 lg:col-span-5 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800/80 pb-6 lg:pb-0 lg:pr-8">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Circular Progress track */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100/80 dark:text-slate-800"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#db2777"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset="251.2"
                    className="opacity-20 text-pink-500"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-slate-700 dark:text-slate-200 tracking-tight">0%</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Coverage</span>
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-1.5 text-center">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/50 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Waiting for Input</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold max-w-xs leading-relaxed">
                  No active PRD analyzed yet
                </p>
              </div>
            </div>

            {/* Right explanatory steps & visual guide */}
            <div className="md:col-span-12 lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                  Analysis Flow & Test Case Mapping
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-normal">
                  Enter PRD documents (.txt, .docx, .xlsx, or manual text) in the left panel. QA Copilot will automatically parse requirements and map them to ideal test scenarios.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-pink-100/60 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 rounded-lg">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Automatic Extraction</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Break draft PRD down into atomic functionalities.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-indigo-100/60 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Negative Cases</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Drafting negative cases & boundary testing.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-amber-100/60 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 rounded-lg">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">3. Gap Detection</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Find requirement aspects that lack test cases.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-xl flex items-start gap-2.5">
                  <div className="p-1.5 bg-emerald-100/60 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">4. Fast Export</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Get results in XLSX, CSV, or Jira formats.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
    setIsFromHistory(false);
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
        systemInstruction: "You are a senior Lead QA Engineer specializing in exhaustive test design and requirement traceability. CRITICAL: Be extremely concise, direct, and professional. Strictly avoid repeating words, phrases, sentences, or clauses. Focus on clear, brief statements. Every description or text field in each test case must be limited to 30 words maximum. Do not let any field loop or run on."
      });

      const parsed = robustJSONParse(resultData.text);
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

    const prdHash = getFileHash(sourcePrd);
    const tcHash = isChecker ? getFileHash(checkerTestCaseFile) : getResultsHash(results);

    if (!prdHash || !tcHash) return;

    // Check Coverage Cache first!
    const cacheKey = `${prdHash}_${tcHash}`;
    if (coverageResultsCache[cacheKey]) {
      const cachedRes = coverageResultsCache[cacheKey];
      if (isChecker) {
        setCheckerCoverage(cachedRes);
        setViewMode('coverage');
        
        // Save to Checker Coverage History
        const newCoverageHistory: CoverageHistoryItem = {
          id: 'COV-' + Math.floor(Math.random() * 1000000),
          title: `Coverage: ${checkerPrdFile?.name || 'PRD'} vs ${checkerTestCaseFile?.name || 'Test Case'}`,
          timestamp: Date.now(),
          prdFileName: checkerPrdFile?.name || 'PRD Source',
          tcFileName: checkerTestCaseFile?.name || 'Test Case Source',
          percent: cachedRes.percent,
          coverage: cachedRes
        };
        setCoverageHistoryList(prev => {
          const updated = [newCoverageHistory, ...prev].slice(0, 20);
          localStorage.setItem(PREVIOUS_COVERAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      } else {
        setGeneratorCoverage(cachedRes);
      }
      toast.success("Coverage analysis loaded from cache!");
      return;
    }

    setIsCheckingCoverage(true);
    try {
      // Stage 1: Check if requirements cache exists for this PRD
      let reqs = prdRequirementsCache[prdHash] || (prdHash === activePrdHash ? extractedRequirements : []);
      
      if (reqs.length === 0) {
        toast.info("Extracting requirements from PRD...");
        
        let extractionContents: any[] = [];
        let extractionParts: any[] = [];
        
        if (sourcePrd?.mimeType === 'application/pdf') {
          extractionParts.push({ inlineData: { data: sourcePrd.base64, mimeType: sourcePrd.mimeType } });
        } else if (sourcePrd?.rawText) {
          extractionParts.push({ text: `PRD Source File (${sourcePrd.name}):\n${sourcePrd.rawText}` });
        }
        
        const extractionPrompt = `Extract atomic, testable business requirements from the PRD according to these rules:
1. ONLY extract testable functional requirements.
2. Segment requirements into cohesive atomic functional units, but DO NOT make them micro or overly granular (they shouldn't be too small).
3. DO NOT capture heading names, section titles, or empty placeholders.
4. DO NOT duplicate requirements.
5. Use a stable and sequential ID format: REQ-001, REQ-002, REQ-003, and so on.
6. Order requirements exactly in the sequence they appear in the PRD.
7. Ignore non-testable PRD sections like Purpose, Project Goals, Introduction, Scope Outline, Team, or Appendices.

Return the response in the JSON schema format specified. Language: ${language}`;

        extractionParts.push({ text: extractionPrompt });
        extractionContents.push({ role: 'user', parts: extractionParts });
        
        const extractionResult = await callGemini({
          contents: extractionContents,
          modelConfig: {
            model: "gemini-3.5-flash",
            temperature: 0,
            responseSchema: {
              type: "OBJECT",
              properties: {
                requirements: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      requirement: { type: "STRING" }
                    },
                    required: ["id", "requirement"]
                  }
                }
              },
              required: ["requirements"]
            }
          },
          systemInstruction: `Anda adalah QA Director Expert. Tugas Anda adalah mengekstrak requirement fungsional yang dapat diuji (testable) secara deterministik dan terstruktur dari PRD. Language: ${language}. CRITICAL: Be extremely concise. Avoid repeating words, phrases, or sentences. Limit requirement text to under 150 characters.`
        });
        
        const parsedExtraction = robustJSONParse(extractionResult.text);
        reqs = parsedExtraction.requirements || [];
        
        // Cache the extracted requirements
        setPrdRequirementsCache(prev => ({ ...prev, [prdHash]: reqs }));
        setActivePrdHash(prdHash);
        setExtractedRequirements(reqs);
      }
      
      if (reqs.length === 0) {
        throw new Error("Sistem tidak dapat mendeteksi requirement fungsional di dalam PRD.");
      }

      toast.info("Matching requirements with test cases...");

      // Stage 2: Match extracted requirements against test cases
      let matchingContents: any[] = [];
      let matchingParts: any[] = [];

      // Add the Extracted Requirements JSON
      matchingParts.push({ text: `Extracted Requirements to Match:\n${JSON.stringify(reqs, null, 2)}` });

      // Add Test Cases
      if (isChecker && checkerTestCaseFile) {
        if (checkerTestCaseFile.mimeType === 'application/pdf') {
          matchingParts.push({ inlineData: { data: checkerTestCaseFile.base64, mimeType: checkerTestCaseFile.mimeType } });
        } else if (checkerTestCaseFile.rawText) {
          matchingParts.push({ text: `Existing Test Cases to Match Against (${checkerTestCaseFile.name}):\n${checkerTestCaseFile.rawText}` });
        }
      } else if (sourceResults) {
        matchingParts.push({ text: `Existing Test Cases to Match Against:\n${JSON.stringify(sourceResults.map(tc => ({ id: tc.id, title: tc.title, type: tc.type, steps: tc.steps, expectedResult: tc.expectedResult })), null, 2)}` });
      }

      const matchingPrompt = `Determine coverage mapping between the provided 'Extracted Requirements to Match' and 'Existing Test Cases to Match Against' according to these rules:

1. DO NOT invent or add any new requirements. ONLY use the requirement IDs provided in the Extracted Requirements list.
2. For each requirement, classify it into exactly one of three categories:
   - fullCoverageIds: Requirement is fully covered by at least one test case.
   - partialCoverageItems: Requirement is partially covered (give missingAspects, reason).
   - missingCoverageIds: Requirement has no coverage.
3. Map which test cases cover which requirements in \`reasonsAndTestCases\` list.
4. Keep the mapping strict and semantic.

Return response in the specified JSON schema format. Language: ${language}`;

      matchingParts.push({ text: matchingPrompt });
      matchingContents.push({ role: 'user', parts: matchingParts });

      const matchingResult = await callGemini({
        contents: matchingContents,
        modelConfig: {
          model: "gemini-3.5-flash",
          temperature: 0,
          responseSchema: {
            type: "OBJECT",
            properties: {
              fullCoverageIds: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              partialCoverageItems: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    requirementId: { type: "STRING" },
                    missingAspects: { type: "ARRAY", items: { type: "STRING" } },
                    reason: { type: "STRING" }
                  },
                  required: ["requirementId", "missingAspects", "reason"]
                }
              },
              missingCoverageIds: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              reasonsAndTestCases: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    requirementId: { type: "STRING" },
                    matchedTestCaseIdsAndTitles: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          id: { type: "STRING" },
                          title: { type: "STRING" }
                        },
                        required: ["id", "title"]
                      }
                    },
                    reason: { type: "STRING" }
                  },
                  required: ["requirementId", "matchedTestCaseIdsAndTitles", "reason"]
                }
              },
              recommendations: { type: "STRING" }
            },
            required: ["fullCoverageIds", "partialCoverageItems", "missingCoverageIds", "reasonsAndTestCases", "recommendations"]
          }
        },
        systemInstruction: `Anda adalah QA Director Expert. Tugas Anda adalah memetakan ketaatan test cases terhadap daftar atomic requirements yang diberikan secara akurat dan ketat tanpa mengubah atau menambahkan requirement baru. Language: ${language}. CRITICAL: Be extremely concise. Avoid repeating words, phrases, or sentences. Limit any reason/recommendation string values to under 150 characters.`
      });

      const parsedMatching = robustJSONParse(matchingResult.text);

      const fullCoverageIdsSet = new Set((parsedMatching.fullCoverageIds || []).map((id: string) => id.trim().toUpperCase()));
      const partialMap = new Map();
      (parsedMatching.partialCoverageItems || []).forEach((item: any) => {
        if (item && item.requirementId) {
          partialMap.set(item.requirementId.trim().toUpperCase(), item);
        }
      });
      const missingCoverageIdsSet = new Set((parsedMatching.missingCoverageIds || []).map((id: string) => id.trim().toUpperCase()));

      const reasonsMap = new Map();
      (parsedMatching.reasonsAndTestCases || []).forEach((item: any) => {
        if (item && item.requirementId) {
          reasonsMap.set(item.requirementId.trim().toUpperCase(), item);
        }
      });

      const fullyCovered: any[] = [];
      const partiallyCovered: any[] = [];
      const missingRequirements: any[] = [];

      // Exactly once per extracted requirement
      reqs.forEach((req: any) => {
        const idUpper = req.id.toUpperCase();
        const matchedCases = reasonsMap.get(idUpper)?.matchedTestCaseIdsAndTitles || [];
        const reasonFromCases = reasonsMap.get(idUpper)?.reason;

        if (partialMap.has(idUpper)) {
          const pItem = partialMap.get(idUpper);
          partiallyCovered.push({
            requirementId: req.id,
            requirement: req.requirement,
            matchedTestCases: matchedCases,
            reason: pItem.reason || reasonFromCases || "Partially covered by existing test scenarios.",
            missingAspects: pItem.missingAspects || []
          });
        } else if (fullCoverageIdsSet.has(idUpper)) {
          fullyCovered.push({
            requirementId: req.id,
            requirement: req.requirement,
            matchedTestCases: matchedCases,
            reason: reasonFromCases || "Fully covered by existing test cases."
          });
        } else {
          missingRequirements.push({
            requirementId: req.id,
            requirement: req.requirement,
            reason: reasonFromCases || "No matching test cases found."
          });
        }
      });

      // Recalculate percent securely
      const percent = calculateCoverageRatio(fullyCovered, partiallyCovered, missingRequirements);

      const res: CoverageResult = {
        percent,
        fullyCovered,
        partiallyCovered,
        missingRequirements,
        recommendations: parsedMatching.recommendations || ""
      };

      // Cache the coverage result
      setCoverageResultsCache(prev => ({ ...prev, [cacheKey]: res }));

      if (isChecker) {
        setCheckerCoverage(res);
        setViewMode('coverage');
        
        // Save to Checker Coverage History
        const newCoverageHistory: CoverageHistoryItem = {
          id: 'COV-' + Math.floor(Math.random() * 1000000),
          title: `Coverage: ${checkerPrdFile?.name || 'PRD'} vs ${checkerTestCaseFile?.name || 'Test Case'}`,
          timestamp: Date.now(),
          prdFileName: checkerPrdFile?.name || 'PRD Source',
          tcFileName: checkerTestCaseFile?.name || 'Test Case Source',
          percent: percent,
          coverage: res
        };
        setCoverageHistoryList(prev => {
          const updated = [newCoverageHistory, ...prev].slice(0, 20);
          localStorage.setItem(PREVIOUS_COVERAGE_KEY, JSON.stringify(updated));
          return updated;
        });
        toast.success("Coverage analysis selesai!");
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
                    coveredRequirement: { type: "STRING" },
                    given: { type: "STRING" },
                    when: { type: "STRING" },
                    then: { type: "STRING" }
                  }
                }
              }
            }
          }
        },
        systemInstruction: `QA Lead Expert. Fokus pada mengisi celah coverage (missing aspects). Language: ${language}. CRITICAL: Be extremely concise, direct, and professional. Strictly avoid repeating words, phrases, sentences, or clauses. Limit each field value to at most 30 words. Selalu isi field 'given', 'when', dan 'then' untuk digunakan jika dalam format Gherkin.`
      });

      const parsed = robustJSONParse(resultData.text);
      
      // Determine the ID prefix and starting sequence number based on existing results to match their format
      let idPrefix = "TC-GAP-";
      let startNumber = 1;
      let paddingAmount = 3;

      if (results.length > 0) {
        const lastTestCase = results[results.length - 1];
        const lastId = lastTestCase.id;
        const match = lastId.match(/^(.*?)(\d+)$/);
        if (match) {
          idPrefix = match[1];
          const digits = match[2];
          startNumber = parseInt(digits, 10) + 1;
          paddingAmount = digits.length;
        } else {
          idPrefix = `${lastId}-GAP-`;
          startNumber = 1;
          paddingAmount = 3;
        }
      }

      const newCases: TestCase[] = (parsed.testCases || []).map((tc: any, i: number) => ({
        ...tc,
        id: `${idPrefix}${String(startNumber + i).padStart(paddingAmount, '0')}`,
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

  const handleGenerateBugReport = async () => {
    // Validation
    if (bugReportMode === 'manual') {
      if (!bugDescription.trim()) {
        setBugReportError("Deskripsi bug (Bug Description) tidak boleh kosong.");
        return;
      }
    } else {
      if (!bugScreenshot && !bugDescription.trim()) {
        setBugReportError("Silakan upload screenshot UI atau masukkan deskripsi bug.");
        return;
      }
    }

    setIsGeneratingBugReport(true);
    setBugReportError(null);
    setGeneratedBugReport(null);

    try {
      const contents: any[] = [];
      const parts: any[] = [];

      // Add screenshot if available
      if (bugReportMode === 'screenshot' && bugScreenshot) {
        parts.push({
          inlineData: {
            data: bugScreenshot.base64,
            mimeType: bugScreenshot.mimeType
          }
        });
      }

      // Prepare raw details text
      const rawDetails = bugReportMode === 'manual' 
        ? `MODE: Manual Bug Entry
- Bug Description: ${bugDescription}
- Steps to Reproduce: ${stepsToReproduce || "Not provided"}
- Expected Result: ${expectedResult || "Not provided"}
- Actual Result: ${actualResult || "Not provided"}
- Environment: ${bugEnvironment || "Not provided"}
- Priority: ${bugPriority}
- Severity: ${bugSeverity}`
        : `MODE: Screenshot Analysis & Description
- Bug Description: ${bugDescription || "Not provided"}
- Expected Result: ${expectedResult || "Not provided"}
- Actual Result: ${actualResult || "Not provided"}
- Environment: ${bugEnvironment || "Not provided"}`;

      parts.push({ text: rawDetails });

      const bugPrompt = bugReportMode === 'manual' 
        ? `Analyze the raw user bug details and generate a highly professional, developer-ready, structured bug report.

Instructions:
1. Generate an explicit, actionable, concise Bug Title (e.g., "[Login] Error 401 on entering incorrect password").
2. Write a clear Bug Summary.
3. Clean up the Steps to Reproduce into a beautiful block of clear, atomic instructions.
4. Define clean, realistic Expected and Actual Results. If they were missing/unclear in user input, deduce them logically and append "(Need confirmation)" to remind the QA team.
5. Provide a Suggestion for Severity (Blocker, Critical, Major, Medium, Minor) and Priority (High, Medium, Low) based on standard QA principles.
6. Record or describe the environment (Environment / Browser / Device).
7. Based on the description, analyze potential root causes and fill the 'rootCause' field with your expert analysis (or how to debug it).
8. Add a 'devNote' summarizing any critical developer advice, workarounds, or confirmation alerts.

Language Instruction: Detect the dominant language of the user input (bug description, steps to reproduce, expected result, actual result, environment) and respond using the same language. Do not translate to Indonesian unless the input is mainly Indonesian. Generate the bug report in the same dominant language as the bug details provided by the user.`
        : `Analyze the uploaded screenshot/UI Image along with the provided user details to generate a highly professional, developer-ready, structured bug report.

Instructions:
1. Identify the UI design/app context from the screenshot and analyze the visible bug/warning/discrepancy (e.g. alignment issues, form validation failures, error screens, crash logs in image, broken elements, state mismatches).
2. Generate an explicit, actionable, concise Bug Title based on the screenshot and details.
3. Write a clear Bug Summary that combines the visual analysis of the screenshot with the user's description.
4. Define a detailed, logical sequence of steps (Steps to Reproduce) to get to this state.
5. Specify the Expected Result and Actual Result. If any user input was missing/unclear, deduce them from the screenshot and append "(Need confirmation)".
6. Identify the specific UI element(s) indicated as problematic inside the 'uiElements' array (e.g., "Login Button", "Email input field margin", "Search Bar dropdown").
7. Suggest Severity (Blocker, Critical, Major, Medium, Minor) and Priority (High, Medium, Low) levels based on standard QA principles.
8. Write a constructive 'devNote' with possible frontend/backend fixes or QA guidance.

Language Instruction: Detect the dominant language of the user input (bug description, steps to reproduce, expected result, actual result, environment) and respond using the same language. Do not translate to Indonesian unless the input is mainly Indonesian. Generate the bug report in the same dominant language as the bug details provided by the user.`;

      parts.push({ text: bugPrompt });
      contents.push({ role: 'user', parts });

      const resultData = await callGemini({
        contents,
        modelConfig: {
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              summary: { type: "STRING" },
              steps: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              expected: { type: "STRING" },
              actual: { type: "STRING" },
              severity: { type: "STRING" },
              priority: { type: "STRING" },
              environment: { type: "STRING" },
              uiElements: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              rootCause: { type: "STRING" },
              devNote: { type: "STRING" }
            },
            required: ["title", "summary", "steps", "expected", "actual", "severity", "priority", "devNote"]
          }
        },
        systemInstruction: `You are a QA Lead & Bug Analysis Specialist. Your task is to analyze raw bug inputs or user screenshots carefully and generate a structured bug report with appropriate Severity and Priority levels for developers. CRITICAL: Be extremely concise, direct, and professional. Strictly avoid repeating words, phrases, sentences, or clauses. Limit each field's value to at most 30 words.
Detect the dominant language of the user input and respond using the same language. Do not translate to Indonesian unless the input is mainly Indonesian. Generate the bug report in the same dominant language as the bug details provided by the user.`
      });

      const parsed = robustJSONParse(resultData.text);
      setGeneratedBugReport(parsed);

      // Save to Bug Report History
      const newHistoryItem: BugReportHistoryItem = {
        id: `BUGR-${Math.floor(100000 + Math.random() * 900000)}`,
        title: parsed.title || bugDescription || "Untitled Bug Report",
        timestamp: Date.now(),
        bugReportMode,
        bugDescription,
        stepsToReproduce,
        expectedResult,
        actualResult,
        bugEnvironment,
        bugSeverity,
        bugPriority,
        bugScreenshot: bugScreenshot ? {
          name: bugScreenshot.name,
          base64: bugScreenshot.base64,
          mimeType: bugScreenshot.mimeType
        } : null,
        generatedBugReport: parsed
      };

      setBugReportHistoryList(prev => {
        const updated = [newHistoryItem, ...prev].slice(0, 20);
        localStorage.setItem(PREVIOUS_BUG_REPORT_KEY, JSON.stringify(updated));
        return updated;
      });

      toast.success("Bug Report generated successfully!");
    } catch (err: any) {
      console.error(err);
      setBugReportError(err.message || "Failed to generate bug report. Please try again.");
      toast.error("Failed to generate Bug Report.");
    } finally {
      setIsGeneratingBugReport(false);
    }
  };

  const handleResetBugReport = () => {
    setBugDescription('');
    setStepsToReproduce('');
    setExpectedResult('');
    setActualResult('');
    setBugEnvironment('');
    setBugSeverity('Medium');
    setBugPriority('Medium');
    setBugScreenshot(null);
    setGeneratedBugReport(null);
    setBugReportError(null);
    toast.info("Form reset successfully!");
  };

  const getBugReportMarkdown = (report: any) => {
    if (!report) return "";
    let md = `# [BUG] ${report.title}\n\n`;
    md += `## Summary\n${report.summary}\n\n`;
    
    md += `## Steps to Reproduce\n`;
    if (Array.isArray(report.steps)) {
      report.steps.forEach((step: string, i: number) => {
        md += `${i + 1}. ${step}\n`;
      });
    } else {
      md += `${report.steps}\n`;
    }
    md += `\n`;

    md += `## Expected Result\n${report.expected}\n\n`;
    md += `## Actual Result\n${report.actual}\n\n`;
    
    if (report.environment) {
      md += `## Environment\n${report.environment}\n\n`;
    }
    
    if (report.uiElements && report.uiElements.length > 0) {
      md += `## Potentially Broken UI Elements\n`;
      report.uiElements.forEach((el: string) => {
        md += `- ${el}\n`;
      });
      md += `\n`;
    }

    if (report.rootCause) {
      md += `## Possible Root Cause\n${report.rootCause}\n\n`;
    }

    md += `## Metadata\n`;
    md += `- **Severity Suggestion:** ${report.severity}\n`;
    md += `- **Priority Suggestion:** ${report.priority}\n\n`;
    md += `## Developer Notes\n${report.devNote}\n`;
    
    return md;
  };

  const handleCopyBugReportMarkdown = () => {
    if (!generatedBugReport) return;
    const md = getBugReportMarkdown(generatedBugReport);
    navigator.clipboard.writeText(md);
    toast.success("Copied Bug Report as Markdown!");
  };

  const handleExportBugReportTxt = () => {
    if (!generatedBugReport) return;
    const md = getBugReportMarkdown(generatedBugReport);
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bug-report-${generatedBugReport.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'untitled'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported Bug Report as TXT!");
  };

  const handleBugScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processImage(file);
      setBugScreenshot(processed);
      setBugReportError(null);
      toast.success("Screenshot uploaded successfully!");
    } catch (err) {
      toast.error("Failed to upload screenshot.");
    }
  };

  const handleBugScreenshotDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("Only image files are allowed!");
      return;
    }
    try {
      const processed = await processImage(file);
      setBugScreenshot(processed);
      setBugReportError(null);
      toast.success("Screenshot dropped successfully!");
    } catch (err) {
      toast.error("Failed to upload screenshot.");
    }
  };

  const getBadgeColor = (val: string) => {
    const norm = val?.toLowerCase() || '';
    if (norm.includes('block') || norm.includes('crit') || norm.includes('high')) {
      return 'bg-rose-55 text-rose-700 border-rose-200';
    }
    if (norm.includes('major') || norm.includes('med') || norm.includes('warn')) {
      return 'bg-amber-55 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const TestCaseTableHeader = ({ template, theme = 'blue' }: { template: TemplateType, theme?: 'blue' | 'amber' | 'teal' | 'pink' }) => {
    const bgHeader = theme === 'blue' ? 'bg-blue-50/80' : theme === 'teal' ? 'bg-teal-50/80' : theme === 'pink' ? 'bg-pink-50/80' : 'bg-amber-50';
    const borderHeader = theme === 'blue' ? 'border-blue-100' : theme === 'teal' ? 'border-teal-100' : theme === 'pink' ? 'border-pink-100' : 'border-amber-100';
    const textHeader = theme === 'blue' ? 'text-blue-900' : theme === 'teal' ? 'text-teal-900' : theme === 'pink' ? 'text-pink-900' : 'text-amber-900';

    return (
      <tr className={cn(bgHeader, "backdrop-blur-md border-b text-[10px] font-bold uppercase tracking-widest", borderHeader, textHeader)}>
        <th className="px-6 py-4 min-w-[120px] whitespace-nowrap text-left flex items-center gap-2">
          <span>ID</span>
        </th>
        <th className={cn(
          "px-6 py-4 w-32 text-center border-x",
          theme === 'blue' ? 'border-blue-50/50' : theme === 'teal' ? 'border-teal-50/50' : theme === 'pink' ? 'border-pink-50/50' : 'border-amber-50/50'
        )}>Type</th>
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
        systemInstruction: `Senior Lead QA Engineer. Language: ${language}. CRITICAL: Be extremely concise, direct, and professional. Strictly avoid repeating words, phrases, sentences, or clauses. Limit each field's value to at most 30 words.`
      });

      const tc = robustJSONParse(resultData.text);
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
    toast.success("Test case deleted successfully!");
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
    toast.success("Changes saved successfully!");
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
        setIsFromHistory(false);
        setConfirmation(prev => ({ ...prev, show: false }));
        toast.info("Data reset successfully!");
      }
    });
  };

  const handleGenerateClick = () => {
    if (results.length > 0) {
      setConfirmation({
        show: true,
        title: 'Regenerate?',
        message: 'Regenerating will overwrite the current results. Do you want to continue?',
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
    setIsFromHistory(true);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = historyList.filter(h => h.id !== id);
    setHistoryList(updated);
    localStorage.setItem(PREVIOUS_SESSIONS_KEY, JSON.stringify(updated));
  };

  const deleteCoverageHistoryItem = (id: string) => {
    setCoverageHistoryList(prev => {
      const updated = prev.filter(h => h.id !== id);
      localStorage.setItem(PREVIOUS_COVERAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const loadFromCoverageHistory = (item: CoverageHistoryItem) => {
    setCheckerCoverage(item.coverage);
    setCheckerPrdFile({
      name: item.prdFileName,
      mimeType: item.prdFileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
      base64: '',
      rawText: 'Loaded from history'
    });
    setCheckerTestCaseFile({
      name: item.tcFileName,
      mimeType: item.tcFileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
      base64: '',
      rawText: 'Loaded from history'
    });

    // Reconstruct the requirements list from coverage history item
    const reconstructedReqs: { id: string; requirement: string }[] = [];
    const seen = new Set<string>();
    const processItem = (cItem: any) => {
      if (cItem && cItem.requirementId && !seen.has(cItem.requirementId)) {
        seen.add(cItem.requirementId);
        reconstructedReqs.push({ id: cItem.requirementId, requirement: cItem.requirement });
      }
    };
    (item.coverage.fullyCovered || []).forEach(processItem);
    (item.coverage.partiallyCovered || []).forEach(processItem);
    (item.coverage.missingRequirements || []).forEach(processItem);

    // Sort requirements by order
    reconstructedReqs.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

    setExtractedRequirements(reconstructedReqs);
    
    const mockPrdFile = { name: item.prdFileName, base64: '', rawText: 'Loaded from history' };
    const mockTcFile = { name: item.tcFileName, base64: '', rawText: 'Loaded from history' };
    const prdHash = getFileHash(mockPrdFile);
    const tcHash = getFileHash(mockTcFile);
    
    setActivePrdHash(prdHash);
    setPrdRequirementsCache(prev => ({ ...prev, [prdHash]: reconstructedReqs }));
    setCoverageResultsCache(prev => ({ ...prev, [`${prdHash}_${tcHash}`]: item.coverage }));

    setActiveFeature('coverage');
    setViewMode('coverage');
    setShowHistory(false);
  };

  const loadFromBugReportHistory = (item: BugReportHistoryItem) => {
    setBugReportMode(item.bugReportMode);
    setBugDescription(item.bugDescription);
    setStepsToReproduce(item.stepsToReproduce);
    setExpectedResult(item.expectedResult);
    setActualResult(item.actualResult);
    setBugEnvironment(item.bugEnvironment);
    setBugSeverity(item.bugSeverity || 'Medium');
    setBugPriority(item.bugPriority || 'Medium');
    setBugScreenshot(item.bugScreenshot);
    setGeneratedBugReport(item.generatedBugReport);
    setBugReportError(null);
    setShowHistory(false);
    toast.success("Berhasil mematikan/memuat Bug Report dari History!");
  };

  const analyzeRequirement = async () => {
    const hasInput = reqInputMode === 'manual' ? reqText.trim() : reqFile;
    if (!hasInput) {
      setReqAnalysisError("Silakan masukkan teks requirement fungsional atau unggah file PRD terlebih dahulu.");
      return;
    }

    setReqAnalysisError(null);
    setAnalyzingReq(true);
    setReqAnalysisResult(null);

    try {
      let contents: any[] = [];
      let parts: any[] = [];

      if (reqInputMode === 'manual') {
        parts.push({ text: `Requirement/PRD:\n${reqText}` });
      } else if (reqFile) {
        if (reqFile.mimeType === 'application/pdf') {
          parts.push({
            inlineData: {
              data: reqFile.base64,
              mimeType: reqFile.mimeType
            }
          });
        } else if (reqFile.rawText) {
          parts.push({ text: `Requirement Content from File (${reqFile.name}):\n${reqFile.rawText}` });
        }
      }

      const reqPrompt = `Berperanlah sebagai QA Director & Requirement Quality Analyst. Tugas Anda adalah melakukan audit atas kualitas spesifikasi/persyaratan (requirements) fungsional yang diberikan agar terbebas dari ambiguitas dan siap dikembangkan menjadi test cases.

Ikuti aturan ketat ini:
1. Hitung skor kualitas (Quality Score) antara 0-100 berdasarkan tingkat keterujian, kelengkapan aspek (seperti validasi, penanganan error, permission, dll), kejelasan alur, dan tidak adanya kalimat ambigu.
2. Klasifikasikan label kualitas:
   - "Good" (Score >= 80) jika sudah jelas, memuat kriteria penerimaan yang memadai, dan testable.
   - "Needs Improvement" (Score 50-79) jika ada alur yang bolong, penanganan error tidak dijelaskan, atau ada kata ambigu.
   - "Poor" (Score < 50) jika deskripsi terlalu luas, alur tidak berujung pangkal, atau tidak bisa diuji secara objektif.
3. Temukan isu-isu kualitas spesifik (issuesFound). Untuk setiap issue, tentukan jenis kecacatan (issueType) yang sesuai dari daftar di bawah ini secara tepat dan akurat:
   - "Ambiguous" (e.g. kata-kata seperti "cepat", "mudah", "aman", tanpa tolok ukur kuantitatif)
   - "Not Testable" (e.g. "Sistem harus berjalan dengan baik")
   - "Missing Acceptance Criteria" (e.g. fitur baru tanpa kriteria sukses yang eksplisit)
   - "Too Broad" (e.g. "User dapat mengelola semua data transaksi")
   - "Incomplete Flow" (e.g. alur pendaftaran tanpa menjelaskan kelanjutan alur setelah disubmit)
   - "Missing Validation" (e.g. form input tanpa aturan pengisian wajib/tambahan)
   - "Missing Error Handling" (e.g. bagaimana jika server gagal menyimpan atau internet mati)
   - "Missing Permission Rule" (e.g. peran/role apa saja yang boleh melakukan aksi)
4. Buat rancangan versi requirement yang telah Anda poles menjadi sangat terperinci dan testable (improvedRequirementDraft). JANGAN mengubah alur atau konteks asli, hanya perjelas hal-hal yang ambigu atau luas agar bernilai guna optimal untuk developer dan QA. JANGAN mengarang fungsionalitas di luar konteks utama.
5. Sediakan catatan penting bagi QA (qaNotes) terkait skenario uji wajib, penekanan edge case, rincian coverage prioritas, penanganan role permission, dsb.

Language Instruction: Detect the dominant language of the user input (the requirement or PRD input) and respond using the same language. Do not translate to Indonesian unless the input is mainly Indonesian. Analyze and rewrite the requirement in the same dominant language as the requirement/PRD input. The communication should be formal, objective, and professional. Regardless of the language of these instructions, all output field values (summary, explanation, suggestedRewrite, improvedRequirementDraft, qaNotes) must be returned in the detected dominant language.`;

      parts.push({ text: reqPrompt });
      contents.push({ role: 'user', parts });

      const resultData = await callGemini({
        contents,
        modelConfig: {
          responseSchema: {
            type: "OBJECT",
            properties: {
              qualityScore: { type: "INTEGER" },
              qualityLabel: { type: "STRING" },
              summary: { type: "STRING" },
              issuesFound: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    requirementText: { type: "STRING" },
                    issueType: { type: "STRING" },
                    explanation: { type: "STRING" },
                    suggestedRewrite: { type: "STRING" }
                  },
                  required: ["id", "requirementText", "issueType", "explanation", "suggestedRewrite"]
                }
              },
              improvedRequirementDraft: { type: "STRING" },
              qaNotes: { type: "STRING" }
            },
            required: ["qualityScore", "qualityLabel", "summary", "issuesFound", "improvedRequirementDraft", "qaNotes"]
          }
        },
        systemInstruction: "You are an experienced QA Director & Requirement Quality Analyst. Your task is to analyze functional requirement documents to ensure they are clear, complete, unambiguous, and fully ready for testing. CRITICAL: Be extremely concise, direct, and professional. Strictly avoid repeating words, phrases, sentences, or clauses. Limit each field's value to at most 30 words. Detect the dominant language of the user input and respond using the same language. Do not translate to Indonesian unless the input is mainly Indonesian. Analyze and rewrite the requirement in the same dominant language as the requirement/PRD input."
      });

      const parsed = robustJSONParse(resultData.text);
      if (parsed && !Array.isArray(parsed.issuesFound)) {
        parsed.issuesFound = [];
      }
      setReqAnalysisResult(parsed);

      const titleText = reqInputMode === 'manual' 
        ? (reqText.slice(0, 45) + (reqText.length > 45 ? "..." : ""))
        : (reqFile?.name || "File PRD");

      const newHistoryItem: ReqQualityHistoryItem = {
        id: `REQC-${Math.floor(100000 + Math.random() * 900000)}`,
        title: titleText || "Untitled Requirement Check",
        timestamp: Date.now(),
        reqText: reqInputMode === 'manual' ? reqText : `[File: ${reqFile?.name || "PRD"}]`,
        fileName: reqFile ? reqFile.name : null,
        language,
        results: parsed
      };

      setReqQualityHistoryList(prev => {
        const updated = [newHistoryItem, ...prev].slice(0, 20);
        localStorage.setItem(PREVIOUS_REQ_QUALITY_KEY, JSON.stringify(updated));
        return updated;
      });

      toast.success("Requirement quality analysis completed!");
    } catch (err: any) {
      console.error(err);
      setReqAnalysisError(err.message || "An error occurred while contacting AI. Connection failed.");
      toast.error("Failed to perform requirement analysis.");
    } finally {
      setAnalyzingReq(false);
    }
  };

  const loadFromReqQualityHistory = (item: ReqQualityHistoryItem) => {
    if (item.fileName) {
      setReqInputMode('upload');
      setReqFile({
        name: item.fileName,
        base64: '',
        mimeType: ''
      });
      setReqText('');
    } else {
      setReqInputMode('manual');
      setReqText(item.reqText);
      setReqFile(null);
    }
    setReqAnalysisResult({
      ...item.results,
      issuesFound: Array.isArray(item.results?.issuesFound) ? item.results.issuesFound : []
    });
    setReqAnalysisError(null);
    setLanguage(item.language);
    setShowHistory(false);
    toast.success("Berhasil memuat Requirement Checker dari History!");
  };

  const deleteReqQualityHistoryItem = (id: string) => {
    setReqQualityHistoryList(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(PREVIOUS_REQ_QUALITY_KEY, JSON.stringify(updated));
      return updated;
    });
    toast.info("Successfully deleted from history!");
  };

  const resetReqChecker = () => {
    setReqText('');
    setReqFile(null);
    setReqAnalysisResult(null);
    setReqAnalysisError(null);
    toast.info("Inputs and auditing results reset successfully.");
  };

  const deleteBugReportHistoryItem = (id: string) => {
    setBugReportHistoryList(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(PREVIOUS_BUG_REPORT_KEY, JSON.stringify(updated));
      return updated;
    });
    toast.info("Successfully deleted from history!");
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
      rows = filteredResults.map(tc => {
        const gp = getGherkinParts(tc, language);
        return [tc.id, tc.type, tc.title, gp.given, gp.when, gp.then];
      });
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
    toast.success("CSV exported successfully!");
  };

  const exportExcel = (filename?: string) => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (activeResultsTemplate === 'Simple') {
      headers = ['ID', 'Type', 'Test Case', 'Steps', 'Expected Result'];
      rows = filteredResults.map(tc => [tc.id, tc.type, tc.title, tc.steps.join('\n'), tc.expectedResult]);
    } else if (activeResultsTemplate === 'Gherkin') {
      headers = ['ID', 'Type', 'Scenario', 'Given', 'When', 'Then'];
      rows = filteredResults.map(tc => {
        const gp = getGherkinParts(tc, language);
        return [tc.id, tc.type, tc.title, gp.given, gp.when, gp.then];
      });
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
    toast.success("Excel exported successfully!");
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
      "min-h-screen text-[#1E293B] dark:text-slate-100 font-sans selection:bg-blue-100 overflow-x-hidden transition-colors duration-500",
      appPage === 'home' ? "bg-transparent" : "bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-[#090d1f] dark:via-slate-950 dark:to-[#070b19]"
    )}>
      {appPage === 'home' ? (
        <div className="min-h-screen text-white">
          <Hero3DScene /> {/* 3D Canvas - strictly covers background of Hero segment as other sections overlap it */}
          
          {/* Landing Header */}
          <header className="fixed top-0 left-0 right-0 h-20 bg-[#020617]/75 backdrop-blur-xl flex items-center justify-between px-10 z-50 border-b border-white/5">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <AppLogo />
            </div>

            <nav className="hidden lg:flex items-center gap-4 bg-white/5 backdrop-blur-xl px-6 py-2 rounded-2xl border border-white/10 shadow-2xl">
              <button 
                onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Tools
              </button>
              <button 
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                How it Works
              </button>
              <button 
                onClick={() => document.getElementById('why-qa')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Why QA Copilot
              </button>
              <button 
                onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                FAQ
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

          {/* Section 1: Hero Section */}
          <div id="hero" className="relative min-h-[92vh] lg:h-[calc(100vh-80px)] lg:min-h-[580px] lg:max-h-[800px] flex flex-col justify-center px-6 sm:px-10 max-w-[1440px] mx-auto z-10 pt-20 pb-8 lg:py-0 overflow-visible">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center w-full relative">
              {/* Left Column: Hero Copywriting */}
              <div className="lg:col-span-6 flex flex-col items-start text-left lg:pr-6">
                <motion.h2 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-4 tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-400 bg-clip-text text-transparent leading-[1.05]"
                >
                  QA Copilot
                </motion.h2>
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="text-xs sm:text-sm text-blue-400 font-bold mb-3.5 uppercase tracking-[0.25em]"
                >
                  Intelligent QA Testing & Documentation
                </motion.p>
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-slate-300 text-xs sm:text-sm lg:text-base leading-relaxed font-semibold mb-8 max-w-xl"
                >
                  Design structured test scenarios, detect coverage gaps in functional documents, audit specification drafts, and compile developer-ready bug reports instantly.
                </motion.p>

                {/* TWO CTA BUTTONS */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  className="flex flex-wrap items-center gap-4 mb-10"
                >
                  <button 
                    onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                    className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-600/40 flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white animate-pulse" />
                    Start Testing
                  </button>
                  <button 
                    onClick={() => { setAppPage('coverage'); setActiveFeature('coverage'); }}
                    className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all backdrop-blur-md hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                  >
                    <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                    Check Coverage
                  </button>
                </motion.div>

                {/* Stats row */}
                <motion.div 
                   initial={{ y: 20, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   transition={{ delay: 0.3, duration: 0.5 }}
                   className="flex items-center gap-6 sm:gap-10 pt-4 border-t border-white/5 w-full max-w-xl"
                >
                  <div className="flex-1">
                    <div className="text-xl sm:text-2xl font-black text-white mb-0.5">98%</div>
                    <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Efficiency Gain</div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="flex-1">
                    <div className="text-xl sm:text-2xl font-black text-white mb-0.5">100%</div>
                    <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Automated Analysis</div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="flex-1">
                    <div className="text-xl sm:text-2xl font-black text-white mb-0.5">Instant</div>
                    <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">No Setup Required</div>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Stunning SaaS Product Preview Mockup */}
              <div className="lg:col-span-6 relative w-full h-[400px] sm:h-[450px] lg:h-[420px] xl:h-[450px] flex items-center justify-center select-none overflow-visible">
                {/* Ambient Soft Glow Background behind the mockup */}
                <div className="absolute w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[100px] -z-10 pointer-events-none animate-pulse duration-5000" />
                <div className="absolute w-[200px] h-[200px] bg-pink-500/10 rounded-full blur-[80px] -z-10 pointer-events-none translate-x-[120px] -translate-y-[80px]" />

                {/* Outer Perspective Wrapper */}
                <div className="relative w-full max-w-[460px] h-full flex items-center justify-center">
                  
                  {/* Layer 1: Main App Window (Base Dashboard Panel) */}
                  <motion.div
                    initial={{ opacity: 0, y: 40, rotateX: 6, rotateY: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, rotateX: 4, rotateY: -6, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative w-[92%] h-[300px] bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col overflow-hidden group hover:border-blue-500/30 transition-all duration-500"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* Browser UI Bar */}
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500/70" />
                        <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                        <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                        <span className="text-[9px] text-slate-500 font-mono font-medium ml-2">qa_copilot_workspace.json</span>
                      </div>
                      <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[7.5px] text-slate-400 font-mono uppercase tracking-widest font-black">Online</span>
                      </div>
                    </div>

                    {/* Window Content Layout */}
                    <div className="flex-1 grid grid-cols-12 gap-3">
                      {/* Left side: Mini-Navigation */}
                      <div className="col-span-3 border-r border-white/5 pr-2 flex flex-col gap-1">
                        <div className="h-5 w-full bg-blue-500/10 rounded-md flex items-center gap-1.5 px-2 border border-blue-500/20">
                          <LayoutDashboard className="w-2.5 h-2.5 text-blue-400" />
                          <span className="text-[7.5px] text-blue-300 font-bold uppercase tracking-wider">Metrics</span>
                        </div>
                        <div className="h-5 w-full bg-white/[0.02] rounded-md flex items-center gap-1.5 px-2 transition-all hover:bg-white/5">
                          <Zap className="w-2.5 h-2.5 text-slate-400" />
                          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">Generator</span>
                        </div>
                        <div className="h-5 w-full bg-white/[0.02] rounded-md flex items-center gap-1.5 px-2 transition-all hover:bg-white/5">
                          <PieChart className="w-2.5 h-2.5 text-slate-400" />
                          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">Coverage</span>
                        </div>
                        <div className="h-5 w-full bg-white/[0.02] rounded-md flex items-center gap-1.5 px-2 transition-all hover:bg-white/5">
                          <Bug className="w-2.5 h-2.5 text-slate-400" />
                          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">Bugs</span>
                        </div>
                        <div className="mt-auto p-1 bg-slate-900/60 rounded-md border border-white/5">
                          <div className="text-[6.5px] text-slate-500 font-bold tracking-wider uppercase mb-0.5">Quota</div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[72%] rounded-full" />
                          </div>
                        </div>
                      </div>

                      {/* Workspace Active View Mock */}
                      <div className="col-span-9 pl-1 flex flex-col gap-3">
                        {/* Header stats bar */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-1.5 bg-white/[0.02] border border-white/5 rounded-lg flex items-center gap-1.5">
                            <div className="p-1 bg-emerald-500/10 rounded-md text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                            <div>
                              <div className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider">Scenarios</div>
                              <div className="text-[10px] font-black text-white">42 Active</div>
                            </div>
                          </div>
                          <div className="p-1.5 bg-white/[0.02] border border-white/5 rounded-lg flex items-center gap-1.5">
                            <div className="p-1 bg-blue-500/10 rounded-md text-blue-400">
                              <ClipboardCheck className="w-3 h-3" />
                            </div>
                            <div>
                              <div className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider">Analyzed</div>
                              <div className="text-[10px] font-black text-white">100% OK</div>
                            </div>
                          </div>
                        </div>

                        {/* Mini Test Case Table inside Mock */}
                        <div className="flex-1 bg-slate-950/40 rounded-lg border border-white/5 p-2 flex flex-col overflow-hidden">
                          <div className="flex items-center justify-between pb-1 border-b border-white/5">
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5 text-slate-400" /> Recent Test Scenarios
                            </span>
                            <span className="text-[7px] font-bold text-blue-400">Verifying...</span>
                          </div>
                          <div className="flex-1 flex flex-col divide-y divide-white/5 text-[8.5px] justify-center">
                            <div className="py-0.5 px-1 flex items-center justify-between gap-2">
                              <span className="font-mono text-blue-400 font-bold text-[7.5px]">TC-01</span>
                              <span className="text-slate-200 truncate flex-1 font-semibold">User Authentication Flow</span>
                              <span className="px-1 py-0.2 bg-emerald-500/10 text-emerald-400 text-[5.5px] font-bold uppercase tracking-wider rounded border border-emerald-500/20">Positive</span>
                            </div>
                            <div className="py-0.5 px-1 flex items-center justify-between gap-2 bg-white/[0.02]">
                              <span className="font-mono text-blue-400 font-bold text-[7.5px]">TC-02</span>
                              <span className="text-slate-200 truncate flex-1 font-semibold">Max Rate Limit Validation</span>
                              <span className="px-1 py-0.2 bg-rose-500/10 text-rose-400 text-[5.5px] font-bold uppercase tracking-wider rounded border border-rose-500/20">Negative</span>
                            </div>
                            <div className="py-0.5 px-1 flex items-center justify-between gap-2">
                              <span className="font-mono text-blue-400 font-bold text-[7.5px]">TC-03</span>
                              <span className="text-slate-200 truncate flex-1 font-semibold">Google OAuth Pop-up Blocked</span>
                              <span className="px-1 py-0.2 bg-amber-500/10 text-amber-400 text-[5.5px] font-bold uppercase tracking-wider rounded border border-amber-500/20">Edge Case</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* App Glowing Accent corners */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
                  </motion.div>

                  {/* Layer 2: Floating Card - Quality score (Overlaps main panel top right) */}
                  <motion.div
                    animate={{
                      y: [0, -6, 0],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute top-8 sm:top-12 -right-2 sm:-right-4 w-[190px] bg-[#0f172a]/95 border border-white/15 rounded-xl p-2.5 shadow-xl flex flex-col gap-2 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Quality Score</span>
                      <span className="px-1 py-0.2 bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[7px] font-black uppercase tracking-wider rounded-full whitespace-nowrap">Score 88</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <svg className="absolute w-full h-full transform -rotate-90">
                          <circle cx="16" cy="16" r="13" className="text-white/5" strokeWidth="2.5" fill="transparent" />
                          <circle cx="16" cy="16" r="13" className="text-pink-500" strokeWidth="2.5" fill="transparent" strokeDasharray={81} strokeDashoffset={10} strokeLinecap="round" />
                        </svg>
                        <span className="text-[10px] font-black text-white">88%</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-bold text-white truncate">Functional PRD</div>
                        <span className="text-[7.5px] font-medium text-slate-400">Passed: 2 warnings</span>
                      </div>
                    </div>
                    {/* Badge alert */}
                    <div className="py-0.5 px-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center gap-1 text-[7.5px] text-amber-400 font-bold">
                      <AlertCircle className="w-2 h-2" /> ambiguous item #4
                    </div>
                  </motion.div>

                  {/* Layer 3: Floating Card - Coverage Checker Summary (Overlaps bottom left/center) */}
                  <motion.div
                    animate={{
                      y: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 7,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1,
                    }}
                    className="absolute -bottom-5 -left-2 sm:-left-4 w-[190px] bg-slate-900/95 border border-emerald-500/30 rounded-xl p-3 shadow-2xl flex flex-col gap-1.5 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Full Coverage</span>
                      </div>
                      <span className="text-[7.5px] text-slate-500 font-mono">SEC-3</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[8.5px] font-bold text-white">
                        <span>PRD Coverage</span>
                        <span className="text-emerald-400">94%</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[94%] rounded-full" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-0.5 text-center pt-0.5 text-[7px] font-black text-slate-400">
                      <div className="p-0.5 bg-white/5 rounded">
                        <div className="text-white font-black text-[9px]">16</div>
                        <div>Covered</div>
                      </div>
                      <div className="p-0.5 bg-white/5 rounded">
                        <div className="text-blue-400 font-black text-[9px]">2</div>
                        <div>Partial</div>
                      </div>
                      <div className="p-0.5 bg-white/5 rounded border border-rose-500/20 bg-rose-500/5">
                        <div className="text-rose-400 font-black text-[9px]">3</div>
                        <div className="text-rose-400 font-bold">Missing 3</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Layer 4: Floating Badge - Bug Report Ready (Overlaps bottom right) */}
                  <motion.div
                    animate={{
                      y: [0, -6, 6, 0],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 2,
                    }}
                    className="absolute bottom-10 -right-2 sm:-right-4 bg-[#020617]/95 border border-white/10 rounded-xl py-2 px-3 shadow-xl flex items-center gap-2.5 backdrop-blur-md"
                  >
                    <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner flex-shrink-0">
                      <Bug className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[8px] font-black text-white uppercase tracking-wider">Bug Report Ready</div>
                      <div className="text-[7.5px] font-bold text-slate-400">Sent to Jira / Slack</div>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  </motion.div>

                  {/* Tiny Interactive Glowing Indicator */}
                  <div className="absolute top-[48%] left-[45%] w-6 h-6 bg-blue-500/30 rounded-full animate-ping pointer-events-none" />
                  <div className="absolute top-[49%] left-[46%] w-3 h-3 bg-blue-400 rounded-full shadow-lg shadow-blue-500/50 pointer-events-none" />

                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Tools Section - Solid clean background with soft gradients */}
          <div id="tools" className="relative z-20 bg-[#070b1a] border-t border-slate-900/60 py-32 px-6 sm:px-10 overflow-hidden">
            {/* Deep Ambient atmospheric blur spots */}
            <div className="absolute top-1/4 left-1/10 w-[400px] h-[400px] bg-pink-500/5 rounded-full blur-3xl pointer-events-none select-none" />
            <div className="absolute bottom-1/4 right-1/10 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none select-none" />
            
            <div className="max-w-7xl mx-auto relative z-10">
              <div className="text-center mb-20 space-y-4">
                <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.34em] block">INTEGRATED POWER-SUITE</span>
                <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  Choose Your Verification Tool
                </h3>
                <p className="text-slate-400 font-medium text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
                  Four high-precision AI verification engines contextually tuned to build perfect test designs, map integration gaps, audit specifications, and log issues flawlessly.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Test Case Generator */}
                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: 0 }}
                  className="bg-white/[0.02] backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 hover:border-pink-500/30 hover:bg-white/[0.04] transition-all duration-300 group flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pink-600/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 bg-pink-600/10 border border-pink-500/20 text-pink-500 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-pink-600 group-hover:text-white transition-all duration-300">
                        <Zap className="w-5 h-5 fill-none group-hover:fill-white" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2.5 py-1 rounded-md">
                        AI Draft Engine
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-white mb-3 tracking-tight group-hover:text-pink-400 transition-colors">
                      Test Case Generator
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6">
                      Convert specification files, visual mockups, or pasted technical descriptions instantly into thorough Gherkin or spreadsheet-ready scenarios.
                    </p>

                    {/* Compact Specs list */}
                    <ul className="space-y-2 mb-8 text-[11px] font-semibold text-slate-500">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-pink-500/80 shrink-0" />
                        <span>Positive, Negatives & Edges</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-pink-500/80 shrink-0" />
                        <span>Export Gherkin / CSV / Sheets</span>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                    className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all duration-300 shadow-md shadow-pink-600/10 hover:shadow-pink-600/20 active:scale-95 cursor-pointer"
                  >
                    Open Generator
                  </button>
                </motion.div>

                {/* Card 2: Coverage Checker */}
                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-white/[0.02] backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all duration-300 group flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                        <PieChart className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                        Coverage Sensor
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-white mb-3 tracking-tight group-hover:text-emerald-400 transition-colors">
                      Coverage Analyzer
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6">
                      Upload your legacy spreadsheets of test procedures side-by-side with product specifications to isolate omitted paths instantly.
                    </p>

                    {/* Compact Specs list */}
                    <ul className="space-y-2 mb-8 text-[11px] font-semibold text-slate-500">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
                        <span>Traceability matrix generator</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
                        <span>Highlight forgotten edge lanes</span>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => { setAppPage('coverage'); setActiveFeature('coverage'); }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all duration-300 shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-95 cursor-pointer"
                  >
                    Assess Coverage
                  </button>
                </motion.div>

                {/* Card 3: Req Quality */}
                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="bg-white/[0.02] backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 hover:border-violet-500/30 hover:bg-white/[0.04] transition-all duration-300 group flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300">
                        <ClipboardCheck className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-md">
                        Quality Checker
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-white mb-3 tracking-tight group-hover:text-violet-400 transition-colors">
                      Requirement Quality Checker
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6">
                      Scan product descriptions and specifications for ambiguous wording, logical gaps, contradictory requirements, and missing fallback routes.
                    </p>

                    {/* Compact Specs list */}
                    <ul className="space-y-2 mb-8 text-[11px] font-semibold text-slate-500">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-500/80 shrink-0" />
                        <span>Quality score & logical index</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-500/80 shrink-0" />
                        <span>Drafting suggestions block</span>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => setAppPage('requirement_checker')}
                    className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all duration-300 shadow-md shadow-violet-600/10 hover:shadow-violet-600/20 active:scale-95 cursor-pointer"
                  >
                    Check Quality
                  </button>
                </motion.div>

                {/* Card 4: Bug Report Gen */}
                <motion.div 
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="bg-white/[0.02] backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 hover:border-orange-500/30 hover:bg-white/[0.04] transition-all duration-300 group flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 bg-orange-600/10 border border-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                        <Bug className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-md">
                        Bug Reporter
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-white mb-3 tracking-tight group-hover:text-orange-400 transition-colors">
                      Bug Report Generator
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6">
                      Structure screenshots, unorganized bullet-points, or audio transcripts instantly into high-grade developer-ready Jira and Linear bug tickets.
                    </p>

                    {/* Compact Specs list */}
                    <ul className="space-y-2 mb-8 text-[11px] font-semibold text-slate-500">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-orange-500/80 shrink-0" />
                        <span>Preconditions & clear steps</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-orange-500/80 shrink-0" />
                        <span>Screenshot analysis module</span>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => setAppPage('bug_report')}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all duration-300 shadow-md shadow-orange-600/10 hover:shadow-orange-600/20 active:scale-95 cursor-pointer"
                  >
                    Generate Bug Report
                  </button>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Section 3: How It Works Section - Styled with a contrasting white / light gray background */}
          <div id="how-it-works" className="relative z-20 bg-slate-50 border-y border-slate-200 py-32 px-6 sm:px-10 text-slate-800 overflow-hidden">
            {/* Animated Light Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              {/* Subtle radial dots grid pattern */}
              <div 
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
                  backgroundSize: '24px 24px',
                }}
              />
              
              {/* Dynamic slow-floating soft light blobs to create premium shifting gradients */}
              <motion.div 
                animate={{
                  x: [0, 80, -40, 0],
                  y: [0, -60, 40, 0],
                }}
                transition={{
                  duration: 25,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute top-1/4 left-10 w-[350px] h-[350px] bg-white rounded-full blur-3xl opacity-80"
              />
              <motion.div 
                animate={{
                  x: [0, -100, 50, 0],
                  y: [0, 80, -60, 0],
                }}
                transition={{
                  duration: 30,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute bottom-1/4 right-10 w-[450px] h-[450px] bg-white rounded-full blur-3xl opacity-90"
              />
              
              {/* Floating outlines / geometric elements - Premium Low Contrast Tool Icons but highly visible */}
              <motion.div 
                animate={{ 
                  y: [0, -25, 25, 0],
                  x: [0, 20, -20, 0],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 22, 
                  repeat: Infinity, 
                  ease: 'easeInOut' 
                }}
                className="absolute top-12 left-[8%] text-pink-500/10 hover:text-pink-500/20 transition-colors pointer-events-none"
              >
                <Zap className="w-16 h-16" strokeWidth={1.2} />
              </motion.div>

              <motion.div 
                animate={{ 
                  y: [0, 30, -30, 0],
                  x: [0, -15, 15, 0],
                  rotate: [360, 180, 0]
                }}
                transition={{ 
                  duration: 26, 
                  repeat: Infinity, 
                  ease: 'easeInOut',
                  delay: 2
                }}
                className="absolute top-1/4 right-[12%] text-orange-500/10 hover:text-orange-500/20 transition-colors pointer-events-none"
              >
                <Bug className="w-16 h-16" strokeWidth={1.2} />
              </motion.div>

              <motion.div 
                animate={{ 
                  y: [0, -35, 35, 0],
                  x: [0, 15, -15, 0],
                  rotate: [0, -180, -360]
                }}
                transition={{ 
                  duration: 30, 
                  repeat: Infinity, 
                  ease: 'easeInOut',
                  delay: 1
                }}
                className="absolute bottom-16 left-[6%] text-blue-500/10 hover:text-blue-500/20 transition-colors pointer-events-none"
              >
                <FileText className="w-20 h-20" strokeWidth={1.2} />
              </motion.div>

              <motion.div 
                animate={{ 
                  y: [0, 20, -20, 0],
                  x: [0, 25, -25, 0],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 20, 
                  repeat: Infinity, 
                  ease: 'easeInOut',
                  delay: 4
                }}
                className="absolute bottom-1/3 right-[3%] text-emerald-500/10 hover:text-emerald-500/20 transition-colors pointer-events-none"
              >
                <PieChart className="w-16 h-16" strokeWidth={1.2} />
              </motion.div>

              <motion.div 
                animate={{ 
                  y: [0, -20, 20, 0],
                  x: [0, -20, 20, 0],
                  rotate: [-180, 0, 180]
                }}
                transition={{ 
                  duration: 24, 
                  repeat: Infinity, 
                  ease: 'easeInOut',
                  delay: 3
                }}
                className="absolute top-2/3 left-[25%] text-pink-500/8 pointer-events-none"
              >
                <Globe className="w-14 h-14" strokeWidth={1} />
              </motion.div>

              <motion.div 
                animate={{ 
                  y: [0, 25, -25, 0],
                  x: [0, 15, -15, 0],
                  rotate: [0, 360]
                }}
                transition={{ 
                  duration: 35, 
                  repeat: Infinity, 
                  ease: 'linear',
                  delay: 5
                }}
                className="absolute top-8 right-[28%] text-violet-500/8 pointer-events-none"
              >
                <FileBox className="w-16 h-16" strokeWidth={1} />
              </motion.div>

              <motion.div 
                animate={{ 
                  y: [0, -22, 22, 0],
                  x: [0, -22, 22, 0],
                  rotate: [360, 0]
                }}
                transition={{ 
                  duration: 28, 
                  repeat: Infinity, 
                  ease: 'linear',
                  delay: 1.5
                }}
                className="absolute bottom-12 right-[18%] text-slate-500/10 pointer-events-none"
              >
                <Search className="w-14 h-14" strokeWidth={1} />
              </motion.div>

              <motion.div 
                animate={{ 
                  y: [0, 25, -25, 0],
                  x: [0, 20, -20, 0],
                  rotate: [0, -180, -360]
                }}
                transition={{ 
                  duration: 28, 
                  repeat: Infinity, 
                  ease: 'easeInOut',
                  delay: 0.5
                }}
                className="absolute top-1/3 left-[15%] text-orange-500/8 pointer-events-none"
              >
                <ClipboardCheck className="w-14 h-14" strokeWidth={1} />
              </motion.div>

              {/* Add dynamic, soft floating dotted connections */}
              <div className="absolute inset-0 opacity-[0.07] bg-grid-slate-200 pointer-events-none"
                   style={{
                     backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
                     backgroundSize: '32px 32px'
                   }} 
              />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
              <div className="text-center mb-16">
                <span className="text-indigo-600 text-[10px] font-black uppercase tracking-[0.3em] mb-4 block">Interactive Guide</span>
                <h3 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4 tracking-tight">
                  How It Works
                </h3>
                <p className="text-slate-500 font-semibold text-sm sm:text-base max-w-2xl mx-auto">
                  Take an interactive tour of the automated pipeline that transforms loose specifications into high-coverage QA documentation.
                </p>
              </div>

              {/* Interactive Widget Platform Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                {/* Left Side: Step Selectors (Vertical Stack) */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:flex xl:flex-col xl:gap-4 xl:space-y-0">
                  {[
                    {
                      stepNum: "01",
                      title: "Upload or Write Specs",
                      shortDesc: "Input raw requirements, technical memos, or design uploads.",
                      colorClass: "border-blue-500 text-blue-600 bg-blue-50",
                      glowClass: "shadow-blue-200/55",
                      badge: "bg-blue-100 text-blue-700"
                    },
                    {
                      stepNum: "02",
                      title: "AI Context Analysis",
                      shortDesc: "Advanced AI engine reads and builds path mappings.",
                      colorClass: "border-indigo-500 text-indigo-600 bg-indigo-50",
                      glowClass: "shadow-indigo-200/55",
                      badge: "bg-indigo-100 text-indigo-700"
                    },
                    {
                      stepNum: "03",
                      title: "Structured QA Drafting",
                      shortDesc: "Convert isolated logical trees into real formatted test cases.",
                      colorClass: "border-violet-500 text-violet-600 bg-violet-50",
                      glowClass: "shadow-violet-200/55",
                      badge: "bg-violet-100 text-violet-700"
                    },
                    {
                      stepNum: "04",
                      title: "Export or Continue",
                      shortDesc: "Synchronize directly with spreadsheet editors or Jira sheets.",
                      colorClass: "border-pink-500 text-pink-600 bg-pink-50",
                      glowClass: "shadow-pink-200/55",
                      badge: "bg-pink-100 text-pink-700"
                    }
                  ].map((step, idx) => {
                    const isActive = activeJourneyStep === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveJourneyStep(idx);
                          setIsWalkthroughTimerPaused(true);
                        }}
                        className={cn(
                          "w-full text-left p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group focus:outline-none cursor-pointer flex gap-5 items-start",
                          isActive 
                            ? "bg-white border-slate-200 shadow-xl " + step.glowClass
                            : "bg-transparent border-transparent hover:bg-slate-100/60"
                        )}
                      >
                        {/* Dynamic Step Active Line Tracker */}
                        {isActive && (
                          <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", 
                            idx === 0 ? "bg-blue-600" : 
                            idx === 1 ? "bg-indigo-600" : 
                            idx === 2 ? "bg-violet-600" : "bg-pink-600"
                          )} />
                        )}

                        {/* Step Circle */}
                        <div className={cn(
                          "w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-black text-sm border tracking-tighter transition-all duration-300",
                          isActive 
                            ? step.colorClass
                            : "bg-slate-100 border-slate-200/60 text-slate-400 group-hover:bg-slate-200/50"
                        )}>
                          {step.stepNum}
                        </div>

                        {/* Texts */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-black text-sm tracking-tight transition-colors",
                              isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"
                            )}>
                              {step.title}
                            </span>
                            {isActive && (
                              <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full", step.badge)}>
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className={cn(
                            "text-xs transition-colors leading-relaxed",
                            isActive ? "text-slate-600 font-medium" : "text-slate-400 font-normal"
                          )}>
                            {step.shortDesc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right Side: High Fidelity Dark Terminal Interactive Window */}
                <div className="lg:col-span-12 xl:col-span-7">
                  <div className="bg-[#091024] border border-white/10 shadow-2xl rounded-3xl overflow-hidden relative group">
                    
                    {/* Window Top Bar (Chrome / macOS) */}
                    <div className="bg-slate-950/40 border-b border-white/5 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <div className="text-[10px] font-mono font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        copilot_sandbox_v1.0.tsx
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 font-mono tracking-widest uppercase">
                        SESSION OK
                      </div>
                    </div>

                    {/* Window Content Layout */}
                    <div className="p-6 md:p-8 min-h-[360px] flex flex-col justify-center relative z-10 text-xs text-slate-300 font-mono">
                      
                      {/* Step 01 Preview Frame */}
                      {activeJourneyStep === 0 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-6"
                        >
                          <div className="space-y-1.5">
                            <div className="text-indigo-400 font-bold">&gt; upload_requirements --file=prd_payment_gateway_v3.pdf</div>
                            <div className="text-slate-500 text-[11px]">Initiating secure workspace file transfer block...</div>
                          </div>

                          {/* Simulated Drag & Drop Zone */}
                          <div className="border border-dashed border-sky-500/30 bg-sky-950/20 rounded-2xl p-6 text-center space-y-4">
                            <div className="w-12 h-12 bg-sky-500/10 text-sky-400 border border-sky-400/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner shadow-sky-500/20">
                              <Upload className="w-6 h-6 animate-bounce" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-bold text-slate-200">prd_checkout_flow_v3.docx</p>
                              <p className="text-[9px] text-slate-500 uppercase tracking-widest">Size: 964 KB • DOCX Document File</p>
                            </div>
                            
                            {/* Loading Progress Bar */}
                            <div className="space-y-1 max-w-xs mx-auto">
                              <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
                                <span>STATUS: READY</span>
                                <span className="text-emerald-400">100% SUCCESS</span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: "100%" }}
                                  transition={{ duration: 1.2, ease: "easeOut" }}
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" 
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Metadata indexed. 14 main requirement modules identified in 0.8s!</span>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 02 Preview Frame */}
                      {activeJourneyStep === 1 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4"
                        >
                          <div className="space-y-1.5">
                            <div className="text-indigo-400 font-bold">&gt; parse_specifications --engine=ai-pro-v3</div>
                            <div className="text-slate-500 text-[11px]">Engaging syntactic mapping and boundary identification...</div>
                          </div>

                          {/* Analysis list of parsed nodes */}
                          <div className="space-y-2 border border-white/5 bg-slate-950/50 p-4 rounded-2xl relative">
                            {/* Glowing focus tag */}
                            <div className="absolute top-3 right-3 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[8px] font-bold px-2 py-0.5 rounded-full">
                              AI AGENT INDEX
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-slate-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                <span className="font-bold">🔑 Section 1.4: Checkout Controller</span>
                                <span className="text-[10px] text-slate-500 font-bold">(Isolating logic bounds)</span>
                              </div>
                              
                              <div className="pl-4 space-y-1.5 text-[11px] text-slate-400">
                                <div className="flex justify-between border-b border-white/[0.03] pb-1">
                                  <span>↳ Flow 01: Anonymous checkouts</span>
                                  <span className="text-indigo-300 font-bold">Passed to Schema</span>
                                </div>
                                <div className="flex justify-between border-b border-white/[0.03] pb-1">
                                  <span>↳ Flow 02: Stripe payment webhook fails</span>
                                  <span className="text-amber-400 font-bold">Edge-case flagged</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>↳ Flow 03: Coupon apply logic check</span>
                                  <span className="text-indigo-300 font-bold">Passed to Schema</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-[11px]">
                            <Search className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400 animate-pulse" />
                            <div>
                              <strong>Mapped logic:</strong> Built a complete test scenarios outline matrix mapping 3 functional logic gates, ready for full draft generation.
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 03 Preview Frame */}
                      {activeJourneyStep === 2 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-5"
                        >
                          <div className="space-y-1.5">
                            <div className="text-indigo-400 font-bold">&gt; generate_test_cases --format=formal</div>
                            <div className="text-slate-500 text-[11px]">Creating professional test case documents...</div>
                          </div>

                          {/* Created test results mockup */}
                          <div className="space-y-2.5">
                            {[
                              { id: "TC-001", type: "Positive", title: "Checkout success with saved credit card" },
                              { id: "TC-002", type: "Negative", title: "Checkout failure triggers matching warning reason" },
                              { id: "TC-003", type: "Edge Case", title: "Checkout with expired stored token API response drop" },
                            ].map((tc, index) => (
                              <div 
                                key={index}
                                className="border border-white/5 bg-slate-950/40 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-[11px]"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="font-bold text-slate-500 shrink-0">{tc.id}</span>
                                  <span className="truncate text-slate-200 font-semibold">{tc.title}</span>
                                </div>
                                <span className={cn(
                                  "text-[8px] font-black uppercase shrink-0 px-2 py-0.5 rounded-full border",
                                  tc.type === "Positive" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                                  tc.type === "Negative" ? "bg-red-500/15 text-red-400 border-red-500/25" :
                                  "bg-indigo-500/15 text-indigo-400 border-indigo-500/25"
                                )}>
                                  {tc.type}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="text-[10px] text-slate-500 text-right font-bold italic leading-none">
                            Draft completed: 38 scenarios compiled successfully.
                          </div>
                        </motion.div>
                      )}

                      {/* Step 04 Preview Frame */}
                      {activeJourneyStep === 3 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-6"
                        >
                          <div className="space-y-1.5">
                            <div className="text-indigo-400 font-bold">&gt; export_plans --to=sheets</div>
                            <div className="text-slate-500 text-[11px]">Compiling structured worksheets...</div>
                          </div>

                          {/* Beautiful Export Interface */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center text-center justify-center space-y-2 group">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <Download className="w-4 h-4" />
                              </div>
                              <div className="font-bold text-slate-200 text-[11px]">Download Excel</div>
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Spreadsheet (XLSX)</span>
                            </div>
                            
                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center text-center justify-center space-y-2">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="font-bold text-slate-200 text-[11px]">Download CSV</div>
                              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Plain Text (CSV)</span>
                            </div>
                          </div>

                          {/* Statistics Block */}
                          <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex justify-between items-center text-center">
                            <div className="space-y-0.5">
                              <div className="text-lg font-black text-white leading-none">38</div>
                              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">Scenarios</div>
                            </div>
                            <div className="w-px h-8 bg-white/5" />
                            <div className="space-y-0.5">
                              <div className="text-lg font-black text-indigo-400 leading-none">100%</div>
                              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">Traceability</div>
                            </div>
                            <div className="w-px h-8 bg-white/5" />
                            <div className="space-y-0.5">
                              <div className="text-lg font-black text-emerald-400 leading-none">4.8 Hrs</div>
                              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">Time Saved</div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                    </div>

                    {/* Left & Right floating decorations to make the container feel exceptionally premium */}
                    <div className="absolute top-1/2 left-4 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 select-none pointer-events-none" />
                    <div className="absolute top-1/2 right-4 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 select-none pointer-events-none" />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Section 4: Why QA Copilot Section - Styled with a beautiful split-layout benefit list / checklist */}
          <div id="why-qa" className="relative z-20 bg-[#0a1128] py-32 px-6 sm:px-10 overflow-hidden border-b border-white/5">
            <div className="absolute -top-[300px] left-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-[300px] right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                
                {/* Left Column: Headline and custom metrics to stand out */}
                <div className="lg:col-span-5 space-y-8">
                  <div className="space-y-4">
                    <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] block">Proven Benefits</span>
                    <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                      Why QA Copilot?
                    </h3>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-md">
                      An intelligent QA companion built to scale testing bandwidth, find critical edge cases, and eliminate manual specification reviews.
                    </p>
                  </div>

                  {/* High-Impact compact stats and metrics */}
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
                    <div className="space-y-1">
                      <div className="text-2xl sm:text-3xl font-black text-indigo-400 tracking-tight">10x</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Faster Drafts</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">100%</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Requirement Trace</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl sm:text-3xl font-black text-pink-400 tracking-tight">95%</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Precision Level</div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Premium Interactive benefit list */}
                <div className="lg:col-span-7 space-y-4">
                  {[
                    { 
                      icon: <Zap className="w-5 h-5 text-indigo-400" />, 
                      title: "Faster QA Documentation", 
                      desc: "Generate complete, professional quality plans covering positive, negative, and edge logic scenarios in seconds.",
                      label: "Speed Boost"
                    },
                    { 
                      icon: <Shield className="w-5 h-5 text-emerald-400" />, 
                      title: "Better Requirement Coverage", 
                      desc: "Directly analyze specifications side-by-side with your test logs to keep gaps or unmapped flows out of production.",
                      label: "Risk Shield"
                    },
                    { 
                      icon: <Bug className="w-5 h-5 text-orange-400" />, 
                      title: "Clearer Bug Reports", 
                      desc: "Instantly structure loose text logs, screenshots, and device observations into formal, developer-friendly Jira/Linear tickets.",
                      label: "Bug Deflector"
                    },
                    { 
                      icon: <PieChart className="w-5 h-5 text-pink-400" />, 
                      title: "Reduced Missed Scenarios", 
                      desc: "Unlock intelligent boundary analysis and comprehensive system checks designed by advanced AI criteria models.",
                      label: "Data Defense"
                    }
                  ].map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1, duration: 0.4 }}
                      className="flex gap-4 p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all duration-300 relative group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/[0.02] group-hover:bg-indigo-600/10 border border-white/5 group-hover:border-indigo-500/20 flex items-center justify-center shrink-0 transition-all duration-300">
                        {item.icon}
                      </div>
                      <div className="space-y-1 pr-16">
                        <h5 className="text-base font-black text-white group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </h5>
                        <p className="text-slate-400 text-xs leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                      
                      {/* Premium Tag Badge */}
                      <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-2.5 py-1 rounded-md">
                        {item.label}
                      </span>
                    </motion.div>
                  ))}
                </div>

              </div>
            </div>
          </div>

          {/* Section 5: Final CTA Section */}
          <div id="cta" className="relative z-20 bg-[#020617] py-32 px-6 sm:px-10 text-center border-t border-white/5 overflow-hidden">
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent border border-blue-500/25 p-12 sm:p-16 rounded-[3rem] relative overflow-hidden backdrop-blur-xl">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
              <h3 className="text-3xl sm:text-4xl font-black text-white mb-6 tracking-tight">
                Ready to improve your QA workflow?
              </h3>
              <p className="text-slate-300 text-sm sm:text-base mb-10 max-w-2xl mx-auto leading-relaxed font-semibold">
                Automate raw, repetitive logic writing and gain total requirements confidence before your next deployment cycles launch.
              </p>
              <button 
                onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all shadow-lg shadow-blue-600/30 active:scale-95 inline-flex items-center gap-2"
              >
                <Zap className="w-4 h-4 fill-white" />
                Start Generator
              </button>
            </div>
          </div>

          {/* Section 6: FAQ & Footer Section */}
          <div id="faq" className="relative z-20 bg-[#020617] pt-20 pb-12 px-6 sm:px-10 border-t border-white/5">
            <footer id="footer" className="max-w-5xl mx-auto">
              <div className="mb-20">
                <div className="text-center mb-12">
                  <h3 className="text-3xl font-black text-white mb-4 tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Frequently Asked Questions</h3>
                  <p className="text-slate-400 text-sm font-medium">Answers to common questions about our validation system</p>
                </div>
                
                <div className="space-y-4 max-w-4xl mx-auto">
                  {[
                    {
                      q: "How does the platform analyze my product specifications?",
                      a: "The assistant parses requirement texts to extract functional parameters, mapping out main positive, negative, and edge-case testing coverage scenarios to avoid issues before code is written."
                    },
                    {
                      q: "Are my uploaded files and data secure?",
                      a: "Absolutely. All analysis, file reading, and data processing run entirely within your active browser session. We prioritize data privacy and do not retain uploaded files on external databases."
                    },
                    {
                      q: "What document formats are supported?",
                      a: "You can paste raw text or upload standard formats including PDF, Word (DOCX), Text (TXT), and Excel (XLSX). Results can be fully exported to XLSX and CSV formats."
                    },
                    {
                      q: "What is the Requirement Quality tool?",
                      a: "It acts as an automated QA audit partner, flagging missing acceptance criteria, incomplete user flows, or ambiguous statements in your PRD, and outputting clearer functional requirements."
                    }
                  ].map((faq, idx) => {
                    const isOpen = openFaq === idx;
                    return (
                      <div 
                        key={idx} 
                        className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden transition-all duration-300"
                      >
                        <button
                          onClick={() => setOpenFaq(isOpen ? null : idx)}
                          className="w-full px-6 py-5 text-left flex items-center justify-between text-white hover:bg-white/5 transition-colors focus:outline-none"
                        >
                          <span className="font-bold text-sm tracking-tight pr-4">{faq.q}</span>
                          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0", isOpen && "rotate-180")} />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-5 pt-1 text-xs text-slate-300 font-semibold leading-relaxed border-t border-white/5">
                                {faq.a}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 border-t border-white/5 pt-16 pb-12">
                {/* Brand & Mission Column */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <AppLogo theme="dark" />
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                    Automating raw, repetitive specification analysis to craft comprehensive, high-coverage scenarios and requirement validation checks.
                  </p>
                  
                  {/* Classy Systems Status Pill */}
                  <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    All Systems Operational
                  </div>
                </div>

                {/* Navigation Links Column */}
                <div className="lg:col-span-2 space-y-4">
                  <h6 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Platform</h6>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-300">
                    <li>
                      <button 
                        onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })} 
                        className="hover:text-indigo-400 transition-colors cursor-pointer text-left"
                      >
                        Tools Section
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} 
                        className="hover:text-amber-400 transition-colors cursor-pointer text-left"
                      >
                        Interactive Guide
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => document.getElementById('why-qa')?.scrollIntoView({ behavior: 'smooth' })} 
                        className="hover:text-pink-400 transition-colors cursor-pointer text-left"
                      >
                        Quality Benefits
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} 
                        className="hover:text-emerald-400 transition-colors cursor-pointer text-left"
                      >
                        Help Center
                      </button>
                    </li>
                  </ul>
                </div>

                {/* AI Utilities Column (Direct Routing) */}
                <div className="lg:col-span-3 space-y-4">
                  <h6 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">AI Utilities</h6>
                  <ul className="space-y-2.5 text-xs font-bold text-slate-300">
                    <li>
                      <button 
                        onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                        className="hover:text-pink-400 transition-colors cursor-pointer text-left flex items-center gap-2"
                      >
                        <Zap className="w-3 h-3 text-pink-500 shrink-0" />
                        Test Case Generator
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => { setAppPage('coverage'); setActiveFeature('coverage'); }}
                        className="hover:text-emerald-400 transition-colors cursor-pointer text-left flex items-center gap-2"
                      >
                        <PieChart className="w-3 h-3 text-emerald-500 shrink-0" />
                        Coverage Analyzer
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => setAppPage('bug_report')}
                        className="hover:text-orange-400 transition-colors cursor-pointer text-left flex items-center gap-2"
                      >
                        <Bug className="w-3 h-3 text-orange-500 shrink-0" />
                        Bug Report Generator
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => setAppPage('requirement_checker')}
                        className="hover:text-violet-400 transition-colors cursor-pointer text-left flex items-center gap-2"
                      >
                        <ClipboardCheck className="w-3 h-3 text-violet-500 shrink-0" />
                        Requirement Quality Checker
                      </button>
                    </li>
                  </ul>
                </div>

                {/* Trusted Community Column */}
                <div className="lg:col-span-3 space-y-4">
                  <h6 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Trusted Ecosystem</h6>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2.5">
                        <div className="w-7 h-7 rounded-lg border border-[#020617] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm shadow-[#020617]/50">
                          QA
                        </div>
                        <div className="w-7 h-7 rounded-lg border border-[#020617] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm shadow-[#020617]/50">
                          CO
                        </div>
                        <div className="w-7 h-7 rounded-lg border border-[#020617] bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm shadow-[#020617]/50">
                          AS
                        </div>
                        <div className="w-7 h-7 rounded-lg border border-[#020617] bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm shadow-[#020617]/50">
                          +
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">50+ Teams</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Earning the trust of QA Engineers, Product Managers, and Builders worldwide to eliminate test gaps and missed scenarios.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom attribution info */}
              <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center justify-center gap-2 text-center">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">
                  &copy; {new Date().getFullYear()} QA COPILOT. ALL RIGHTS RESERVED.
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  BY TSUZUI
                </div>
              </div>
            </footer>
          </div>
        </div>
      ) : (
        <div className="min-h-screen">
          {/* Tools Header */}
          <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-50">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setAppPage('home')}>
              <AppLogo theme={theme} />
            </div>

            <nav className="flex absolute left-1/2 -translate-x-1/2 items-center bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
              <button 
                onClick={() => { setAppPage('generator'); setActiveFeature('generator'); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 duration-200",
                  appPage === 'generator' ? "bg-pink-600 text-white shadow-lg hover:bg-pink-700 shadow-pink-600/20" : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-pink-50/50 dark:hover:bg-pink-950/20"
                )}
              >
                <Zap className={cn("w-3.5 h-3.5", appPage === 'generator' ? "fill-white text-white" : "fill-none")} />
                Generator
              </button>
              <button 
                onClick={() => { setAppPage('coverage'); setActiveFeature('coverage'); }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 duration-200",
                  appPage === 'coverage' ? "bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 shadow-emerald-600/20" : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                )}
              >
                <PieChart className="w-3.5 h-3.5" />
                Coverage
              </button>
              <button 
                onClick={() => setAppPage('bug_report')}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 duration-200",
                  appPage === 'bug_report' ? "bg-orange-600 text-white shadow-lg hover:bg-orange-700 shadow-orange-600/20" : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                )}
              >
                <Bug className="w-3.5 h-3.5" />
                Bug Report
              </button>
              <button 
                onClick={() => setAppPage('requirement_checker')}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 duration-200",
                  appPage === 'requirement_checker' ? "bg-violet-600 text-white shadow-lg hover:bg-violet-700 shadow-violet-600/20" : "text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
                )}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Requirement Checker
              </button>
            </nav>

            <div className="flex items-center gap-4 ml-auto">
              <button 
                onClick={() => setShowHistory(true)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 bg-white/50 dark:bg-slate-800/60 border rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-all shadow-sm cursor-pointer",
                  appPage === 'generator' ? "border-pink-100 dark:border-pink-900/50 hover:bg-pink-50/30 dark:hover:bg-pink-950/20 hover:text-pink-600 dark:hover:text-pink-400" :
                  appPage === 'coverage' ? "border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 hover:text-emerald-600 dark:hover:text-emerald-400" :
                  appPage === 'bug_report' ? "border-orange-100 dark:border-orange-900/50 hover:bg-orange-50/30 dark:hover:bg-orange-950/20 hover:text-orange-600 dark:hover:text-orange-400" :
                  "border-violet-100 dark:border-violet-900/50 hover:bg-violet-50/30 dark:hover:bg-violet-950/20 hover:text-violet-600 dark:hover:text-violet-400"
                )}
              >
                <History className="w-4 h-4" />
                History
              </button>
              <button
                onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 border rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer active:scale-95",
                  theme === 'dark' 
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-400/60 hover:text-amber-300" 
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                )}
                title={theme === 'dark' ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-slate-600 fill-slate-400/15" />
                )}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </header>

          {appPage === 'requirement_checker' ? (
            <div className="min-h-screen bg-slate-50/50 pt-24 pb-8 px-4 sm:px-6 md:px-8 flex flex-col gap-6 select-none animate-in fade-in duration-300">
              {/* Header Banner */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Requirement Quality Checker</h2>
                  </div>
                  <p className="text-slate-500 text-xs font-medium">
                    Analyze functional specifications and PRDs to detect ambiguities, missing validation, and prepare complete test boundaries.
                  </p>
                </div>
              </div>

              {/* Grid Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Left Panel: Inputs (col-span-12 on mobile, 5 on desktop) */}
                <div className="lg:col-span-5 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between flex-1 space-y-4">
                    <div className="space-y-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
                          Audit Configuration
                        </h3>
                        <button 
                          onClick={resetReqChecker}
                          className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      </div>

                      {/* Mode Selector */}
                      <div className="flex bg-slate-100 dark:bg-slate-805 p-1 rounded-xl border border-slate-200/65 dark:border-slate-700/65 shadow-inner">
                        <button 
                          type="button" 
                          onClick={() => { setReqInputMode('manual'); setReqAnalysisError(null); }}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                            reqInputMode === 'manual' ? "bg-white dark:bg-slate-705 text-violet-600 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          )}
                        >
                          Manual Text
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setReqInputMode('upload'); setReqAnalysisError(null); }}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                            reqInputMode === 'upload' ? "bg-white dark:bg-slate-705 text-violet-600 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          )}
                        >
                          Upload File PRD
                        </button>
                      </div>

                      {reqInputMode === 'manual' ? (
                        <div className="space-y-2 flex-1 flex flex-col">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Paste Requirements / PRD Section
                          </label>
                          <textarea
                            placeholder="Example: 'User must be able to register quickly and securely using the registration form. After registering, the user is sent a confirmation email.'"
                            rows={reqAnalysisResult ? 5 : 12}
                            value={reqText}
                            onChange={(e) => { setReqText(e.target.value); setReqAnalysisError(null); }}
                            className="w-full text-sm font-medium bg-slate-50/50 hover:bg-slate-50 focus:bg-white dark:bg-slate-950/40 dark:hover:bg-slate-950/20 border border-slate-200 dark:border-slate-800 focus:border-violet-500 rounded-2xl p-4 transition-all focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed font-sans resize-none flex-1"
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Upload Document File (PDF, DOCX, TXT, XLSX)
                          </label>
                          {reqFile ? (
                            <div className="border border-violet-150 dark:border-violet-900 bg-violet-50/20 rounded-2xl p-6 relative group flex items-center gap-3">
                              <div className="p-3 bg-violet-100 dark:bg-violet-950 rounded-xl text-violet-600 dark:text-violet-400">
                                <FileText className="w-8 h-8" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{reqFile.name}</h4>
                                <p className="text-[10px] uppercase font-black text-violet-500 dark:text-violet-400 tracking-wider">File uploaded successfully</p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setReqFile(null)}
                                className="text-slate-350 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <div 
                              {...reqFileDropzone.getRootProps()}
                              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-slate-950/20 transition-all flex flex-col items-center justify-center gap-2.5 group shadow-inner"
                            >
                              <input {...reqFileDropzone.getInputProps()} />
                              <div className="p-4 bg-slate-100 dark:bg-slate-800 group-hover:bg-violet-50 dark:group-hover:bg-violet-950 rounded-full text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-all">
                                <Upload className="w-6 h-6 animate-pulse" />
                              </div>
                              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Drag your PRD file here</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">PDF, DOCX, TXT, Excel (XLSX) up to 10MB</p>
                            </div>
                          )}
                        </div>
                      )}

                      {reqAnalysisError && (
                        <div className="p-4 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{reqAnalysisError}</span>
                        </div>
                      )}
                    </div>

                    <button 
                      type="button"
                      onClick={analyzeRequirement}
                      disabled={analyzingReq || loading}
                      className="w-full py-4 mt-4 bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                    >
                      {analyzingReq ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing Requirements...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-white animate-pulse" />
                          Analyze Requirement
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Panel: Overview Score / Loading or Waiting Header Card (col-span-7) */}
                <div className="lg:col-span-7 flex flex-col">
                  {analyzingReq ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 shadow-sm text-center flex flex-col items-center justify-center gap-4 flex-1 min-h-[350px]">
                      <div className="w-16 h-16 bg-violet-50 dark:bg-violet-955 rounded-full flex items-center justify-center relative text-violet-600 dark:text-violet-400">
                        <Loader2 className="w-8 h-8 text-violet-600 dark:text-violet-400 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-black text-slate-800 dark:text-slate-200 text-base tracking-tight animate-pulse">Running Quality Audit...</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-xs mx-auto leading-relaxed">
                          AI is dissecting functional specifications to detect ambiguity, identify gaps, and prepare testing guidelines.
                        </p>
                      </div>
                    </div>
                  ) : reqAnalysisResult ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center flex-1">
                      <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 pb-4 md:pb-0 pr-0 md:pr-6">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Quality Score</label>
                        <div className={cn(
                          "w-24 h-24 rounded-full flex flex-col items-center justify-center border-[6px] shadow-sm relative",
                          reqAnalysisResult.qualityLabel === 'Good' ? "border-emerald-500 text-emerald-600" :
                          reqAnalysisResult.qualityLabel === 'Needs Improvement' ? "border-amber-500 text-amber-600" : "border-rose-500 text-rose-600"
                        )}>
                          <span className="text-2xl font-black">{reqAnalysisResult.qualityScore}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider">/ 100</span>
                        </div>
                        <span className={cn(
                          "mt-3 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-xs",
                          reqAnalysisResult.qualityLabel === 'Good' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-955/20 dark:text-emerald-400 dark:border-emerald-900/50" :
                          reqAnalysisResult.qualityLabel === 'Needs Improvement' ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50" :
                          "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-955/20 dark:text-rose-400 dark:border-rose-900/50"
                        )}>
                          {reqAnalysisResult.qualityLabel}
                        </span>
                      </div>
                      <div className="md:col-span-8 space-y-2">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight uppercase tracking-wider text-slate-400 dark:text-slate-500 text-[10px]">General Executive Summary</h3>
                        <p className="text-slate-650 dark:text-slate-300 text-xs font-medium leading-relaxed font-sans">
                          {reqAnalysisResult.summary}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 shadow-sm text-center flex flex-col items-center justify-center gap-4 flex-1 min-h-[350px]">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center relative bg-violet-50 dark:bg-violet-955/30 text-violet-600 dark:text-violet-400 select-none animate-bounce">
                        <ClipboardCheck className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-slate-700 dark:text-slate-300 text-sm tracking-tight">Waiting for Analysis Input</h3>
                        <p className="text-slate-400 dark:text-slate-500 text-xs font-medium max-w-xs mx-auto leading-relaxed">
                          Enter requirements manually in the left panel or upload a PRD file to inspect its quality completeness.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Section: Full-Width Detail Tabs (Only when results are loaded) */}
              {reqAnalysisResult && !analyzingReq && (
                <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Tabs Navigation */}
                  <div className="flex bg-slate-100 dark:bg-slate-800/40 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setReqResultTab('issues')}
                      className={cn(
                        "flex-1 py-1.5 sm:py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer",
                        reqResultTab === 'issues' 
                          ? "bg-violet-600 text-white shadow-md shadow-violet-600/20" 
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      )}
                    >
                      <AlertTriangle className={cn("w-3.5 h-3.5", reqResultTab === 'issues' ? "text-white" : "text-slate-400")} />
                      Weaknesses ({(reqAnalysisResult.issuesFound || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReqResultTab('draft')}
                      className={cn(
                        "flex-1 py-1.5 sm:py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer",
                        reqResultTab === 'draft' 
                          ? "bg-violet-600 text-white shadow-md shadow-violet-600/20" 
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      )}
                    >
                      <FileText className={cn("w-3.5 h-3.5", reqResultTab === 'draft' ? "text-white" : "text-slate-400")} />
                      New Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setReqResultTab('notes')}
                      className={cn(
                        "flex-1 py-1.5 sm:py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer",
                        reqResultTab === 'notes' 
                          ? "bg-violet-600 text-white shadow-md shadow-violet-600/20" 
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      )}
                    >
                      <Lightbulb className={cn("w-3.5 h-3.5", reqResultTab === 'notes' ? "text-white" : "text-slate-400")} />
                      QA Strategy
                    </button>
                  </div>

                  {/* Active Tab Content */}
                  <AnimatePresence mode="wait">
                    {reqResultTab === 'issues' && (
                      <motion.div
                        key="issues"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                      >
                        <div className="flex justify-between items-center border-b border-violet-50 dark:border-slate-800 pb-3">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
                            Requirement Quality Weaknesses ({(reqAnalysisResult.issuesFound || []).length})
                          </h3>
                        </div>

                        {(!reqAnalysisResult.issuesFound || reqAnalysisResult.issuesFound.length === 0) ? (
                           <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-800 rounded-2xl space-y-1 opacity-85">
                             <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                             <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">Outstanding! Solid Requirements</h4>
                             <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">No specification quality weaknesses or ambiguous sentences were found.</p>
                           </div>
                        ) : (
                          <div className="space-y-4">
                            {(reqAnalysisResult.issuesFound || []).map((issue, idx) => (
                              <div key={issue.id || idx} className="border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 rounded-2xl p-4 bg-slate-50/30 dark:bg-slate-800/10 space-y-3 shadow-xs">
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-slate-800 text-white dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-tight">
                                      {issue.id || `ISSUE-${idx+1}`}
                                    </span>
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shadow-2xs",
                                      ['Ambiguous', 'Not Testable'].includes(issue.issueType) ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50" :
                                      ['Missing Validation', 'Missing Error Handling'].includes(issue.issueType) ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50" :
                                      "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-955/20 dark:text-violet-400 dark:border-violet-900/50"
                                    )}>
                                      {issue.issueType}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="text-xs font-bold text-slate-800 dark:text-slate-300">
                                    Contradiction / Issue Statement:
                                  </div>
                                  <div className="text-xs font-mono bg-rose-50/40 text-rose-700 dark:bg-rose-955/10 dark:text-rose-400 border border-rose-100/30 dark:border-rose-950 p-2.5 rounded-lg line-through whitespace-pre-wrap leading-relaxed">
                                    "{issue.requirementText}"
                                  </div>
                                </div>

                                <div className="space-y-1 text-xs">
                                  <div className="font-bold text-slate-800 dark:text-slate-300">Weakness Analysis:</div>
                                  <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{issue.explanation}</p>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center justify-between">
                                    <span>Suggested Testable Rewrite:</span>
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(issue.suggestedRewrite);
                                        toast.success("Suggested improvement copied successfully!");
                                      }}
                                      className="text-[10px] font-black uppercase text-violet-500 hover:text-violet-650 tracking-wider flex items-center gap-1 cursor-pointer"
                                    >
                                      <Copy className="w-3" /> Copy
                                    </button>
                                  </div>
                                  <div className="text-xs font-medium bg-emerald-50/40 text-emerald-800 dark:bg-emerald-955/10 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-950/50 p-2.5 rounded-lg leading-relaxed font-sans mt-0.5">
                                    {issue.suggestedRewrite}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {reqResultTab === 'draft' && (
                      <motion.div
                        key="draft"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
                            Improved Requirement Draft
                          </h3>
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(reqAnalysisResult.improvedRequirementDraft);
                              toast.success("Standardized requirement draft successfully copied!");
                            }}
                            className="px-3 py-1.5 bg-violet-50 border border-violet-150 dark:bg-violet-955/40 dark:border-violet-900 rounded-xl text-[10px] font-black uppercase tracking-wider text-violet-600 hover:bg-violet-100 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy Improved Requirement
                          </button>
                        </div>
                        <div className="text-xs font-medium bg-slate-50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap font-sans">
                           {reqAnalysisResult.improvedRequirementDraft}
                        </div>
                      </motion.div>
                    )}

                    {reqResultTab === 'notes' && (
                      <motion.div
                        key="notes"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                      >
                        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
                            QA Strategic Testing Notes
                          </h3>
                        </div>
                        <div className="text-xs font-medium text-slate-650 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                          {reqAnalysisResult.qaNotes}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : appPage === 'bug_report' ? (
            <div className="min-h-screen bg-slate-50/50 pt-24 pb-8 px-4 sm:px-6 md:px-8 flex flex-col gap-6">
              {/* Header Banner */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-orange-600 rounded-xl flex items-center justify-center">
                      <Bug className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Bug Report Generator</h2>
                  </div>
                  <p className="text-slate-500 text-xs font-medium">
                    Turn raw bug findings into structured, developer-ready reports.
                  </p>
                </div>
              </div>

              {/* Grid Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Panel Kiri: Form Input - Sticky on scroll to avoid empty space */}
                <div className="lg:col-span-5 lg:sticky lg:top-[88px] self-start bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                    Bug Details Form
                  </h3>

                  {/* Tab Switcher / Toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-full">
                    <button
                      onClick={() => {
                        setBugReportMode('manual');
                        setBugReportError(null);
                      }}
                      className={cn(
                        "flex-1 px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap text-center",
                        bugReportMode === 'manual' ? "bg-white text-orange-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Manual Report
                    </button>
                    <button
                      onClick={() => {
                        setBugReportMode('screenshot');
                        setBugReportError(null);
                      }}
                      className={cn(
                        "flex-1 px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1.5",
                        bugReportMode === 'screenshot' ? "bg-white text-orange-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Screenshot Report
                    </button>
                  </div>

                  {bugReportError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2.5 text-xs text-rose-600 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                      <div>{bugReportError}</div>
                    </div>
                  )}

                  {/* SCREENSHOT MODE EXCLUSIVE: Dropzone */}
                  {bugReportMode === 'screenshot' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Screenshot UI / Gambar Bug *</label>
                      
                      {bugScreenshot ? (
                        <div className="relative border border-slate-200 rounded-2xl p-2.5 bg-slate-50 flex items-center gap-3">
                          <img
                            src={`data:${bugScreenshot.mimeType};base64,${bugScreenshot.base64}`}
                            alt="Bug UI"
                            className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{bugScreenshot.name}</p>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Image Loaded</p>
                          </div>
                          <button
                            onClick={() => setBugScreenshot(null)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-xs active:scale-90"
                            title="Hapus Screenshot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleBugScreenshotDrop}
                          onClick={() => document.getElementById('bug-screenshot-picker')?.click()}
                          className="border-2 border-dashed border-slate-200 hover:border-orange-500 dark:hover:border-orange-400 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all flex flex-col items-center justify-center gap-2 group shadow-xs"
                        >
                          <input
                            type="file"
                            id="bug-screenshot-picker"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBugScreenshotChange}
                          />
                          <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:border-orange-500/20 shadow-sm transition-colors">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-700">Drop & select your file here</p>
                            <p className="text-[10px] font-medium text-slate-400">Supports PNG, JPG, JPEG, WEBP up to 5MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bug Description */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {bugReportMode === 'manual' ? 'Bug Description / Raw Findings *' : 'Short Bug Description *'}
                    </label>
                    <textarea
                      value={bugDescription}
                      onChange={(e) => {
                        setBugDescription(e.target.value);
                        setBugReportError(null);
                      }}
                      rows={bugReportMode === 'manual' ? 4 : 3}
                      placeholder={
                        bugReportMode === 'manual'
                          ? "Write details of your bug findings. Example: When entering password < 6 chars, page freezes and circular spinner spins indefinitely."
                          : "Example: Payment button overlaps with footer on mobile device resolution."
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all leading-relaxed"
                    />
                  </div>

                  {/* Mode Manual Specific Form Fields */}
                  {bugReportMode === 'manual' ? (
                    <>
                      {/* Steps to reproduce */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Steps to Reproduce (Optional)</label>
                        <textarea
                          value={stepsToReproduce}
                          onChange={(e) => setStepsToReproduce(e.target.value)}
                          rows={3}
                          placeholder="1. Go to login page&#10;2. Enter a valid email&#10;3. Enter password '123'&#10;4. Click Submit"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all leading-relaxed"
                        />
                      </div>

                      {/* Expected & Actual Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Result</label>
                          <textarea
                            value={expectedResult}
                            onChange={(e) => setExpectedResult(e.target.value)}
                            rows={3}
                            placeholder="Validation message 'Password must be at least 6 characters' appears"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all leading-relaxed"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Actual Result</label>
                          <textarea
                            value={actualResult}
                            onChange={(e) => setActualResult(e.target.value)}
                            rows={3}
                            placeholder="System freezes (hangs) and loading button rotates endlessly"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* Environment */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Environment / Browser / Device</label>
                        <input
                          type="text"
                          value={bugEnvironment}
                          onChange={(e) => setBugEnvironment(e.target.value)}
                          placeholder="Example: Chrome 125, macOS Sonoma, iPhone 15 Pro"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                      </div>

                      {/* Severity & Priority Selecting Fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Severity</label>
                          <select
                            value={bugSeverity}
                            onChange={(e) => setBugSeverity(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all cursor-pointer"
                          >
                            <option value="Blocker">Blocker</option>
                            <option value="Critical">Critical</option>
                            <option value="Major">Major</option>
                            <option value="Medium">Medium</option>
                            <option value="Minor">Minor</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                          <select
                            value={bugPriority}
                            onChange={(e) => setBugPriority(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-slate-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all cursor-pointer"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Screenshot Mode Optional Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasil yang Diharapkan (Opsional)</label>
                          <textarea
                            value={expectedResult}
                            onChange={(e) => setExpectedResult(e.target.value)}
                            rows={2}
                            placeholder="Tata letak tombol responsif dan sejajar"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all leading-relaxed"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasil Aktual (Opsional)</label>
                          <textarea
                            value={actualResult}
                            onChange={(e) => setActualResult(e.target.value)}
                            rows={2}
                            placeholder="Tombol overlap di belakang footer panel"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* Environment */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Environment / Browser / Device (Opsional)</label>
                        <input
                          type="text"
                          value={bugEnvironment}
                          onChange={(e) => setBugEnvironment(e.target.value)}
                          placeholder="Firefox 126, Windows 11"
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                      </div>
                    </>
                  )}

                  {/* Buttons: Submit & Reset */}
                  <div className="pt-3 flex gap-3">
                    <button
                      onClick={handleResetBugReport}
                      disabled={isGeneratingBugReport}
                      className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold uppercase text-[10px] tracking-wider transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      onClick={handleGenerateBugReport}
                      disabled={isGeneratingBugReport}
                      className="flex-1 bg-orange-600 hover:bg-orange-500 hover:border-orange-400 dark:bg-orange-600 dark:hover:bg-orange-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 text-[10px] uppercase tracking-widest"
                    >
                      {isGeneratingBugReport ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing & Structuring...
                        </>
                      ) : (
                        <>
                          <Bug className="w-4 h-4 fill-slate-200" />
                          {bugReportMode === 'manual' ? 'Generate Bug Report' : 'Analyze & Generate Report'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Panel Kanan: Output Bug Report */}
                <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm min-h-[500px] flex flex-col justify-between">
                  {isGeneratingBugReport ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 space-y-6">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-800 border-t-orange-600 rounded-full animate-spin"></div>
                        <Bug className="w-6 h-6 text-orange-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <div className="space-y-1 text-center">
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Structured Bug Report AI Generator</h3>
                        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                          AI is analyzing visual artifacts and input details to formulate logical reproduce steps, environmental diagnostics, and actionable recommendations.
                        </p>
                      </div>
                    </div>
                  ) : generatedBugReport ? (
                    <div className="space-y-6 flex-1 flex flex-col justify-between">
                      
                      {/* Output Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Struktur Laporan Bug</h4>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyBugReportMarkdown}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-bold tracking-wide hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy Markdown
                          </button>
                          <button
                            onClick={handleExportBugReportTxt}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-transparent text-slate-700 rounded-xl text-[10px] font-bold tracking-wide hover:bg-slate-200 hover:text-slate-900 transition-all active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export TXT
                          </button>
                        </div>
                      </div>

                      {/* Bug Contents */}
                      <div className="space-y-5 flex-1 max-h-[600px] overflow-y-auto pr-1">
                        
                        {/* Title Card */}
                        <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-1.5">
                          <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-550 flex items-center gap-1">
                            <Bug className="w-3 h-3 fill-slate-200 text-slate-500" />
                            Bug Title Highlight
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-slate-800 leading-tight">{generatedBugReport.title}</h4>
                        </div>

                        {/* Summary */}
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Summary</h5>
                          <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">{generatedBugReport.summary}</p>
                        </div>

                        {/* Steps to reproduce */}
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Steps to Reproduce (Saran AI)</h5>
                          <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl space-y-2">
                            {Array.isArray(generatedBugReport.steps) ? (
                              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 font-medium">
                                {generatedBugReport.steps.map((st, idx) => (
                                  <li key={idx} className="leading-relaxed pl-1">
                                    <span className="text-slate-600">{st}</span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-xs text-slate-600 leading-relaxed font-medium">{generatedBugReport.steps}</p>
                            )}
                          </div>
                        </div>

                        {/* Expected & Actual Status Display Panels */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="border border-emerald-100 bg-emerald-50/20 p-3.5 rounded-2xl space-y-1">
                            <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 fill-emerald-100" />
                              Expected Result
                            </div>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed">{generatedBugReport.expected}</p>
                          </div>
                          <div className="border border-rose-100 bg-rose-50/20 p-3.5 rounded-2xl space-y-1">
                            <div className="text-[9px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 fill-rose-100" />
                              Actual Result
                            </div>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed">{generatedBugReport.actual}</p>
                          </div>
                        </div>

                        {/* Environmental metadata, severity, priority */}
                        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Severity Suggested</span>
                            <div>
                              <span className={cn(
                                "inline-block px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border",
                                bugReportMode === 'manual' ? getBadgeColor(bugSeverity) : getBadgeColor(generatedBugReport.severity)
                              )}>
                                {bugReportMode === 'manual' ? bugSeverity : (generatedBugReport.severity || "Medium")}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Priority Suggested</span>
                            <div>
                              <span className={cn(
                                "inline-block px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border",
                                bugReportMode === 'manual' ? getBadgeColor(bugPriority) : getBadgeColor(generatedBugReport.priority)
                              )}>
                                {bugReportMode === 'manual' ? bugPriority : (generatedBugReport.priority || "Medium")}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Report Language</span>
                            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mt-1">
                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                              <span>{language}</span>
                            </div>
                          </div>
                        </div>

                        {/* Potentially Broken UI components (If screenshot mode) */}
                        {bugReportMode === 'screenshot' && generatedBugReport.uiElements && generatedBugReport.uiElements.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terindikasi Broken UI Elements</h5>
                            <div className="flex flex-wrap gap-2">
                              {generatedBugReport.uiElements.map((el, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-lg text-[10px] font-bold text-amber-700">
                                  <AlertCircle className="w-3 h-3 fill-amber-100" />
                                  {el}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Environment String value */}
                        {generatedBugReport.environment && (
                          <div className="space-y-1.5">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detected / Input Environment</h5>
                            <p className="text-xs text-slate-600 font-bold bg-slate-50/50 px-3 py-2.5 rounded-lg border border-slate-100">{generatedBugReport.environment}</p>
                          </div>
                        )}

                        {/* Possible root causes (If manual mode) */}
                        {bugReportMode === 'manual' && generatedBugReport.rootCause && (
                          <div className="space-y-1.5">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Possible Root Cause (Analisis AI)</h5>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">{generatedBugReport.rootCause}</p>
                          </div>
                        )}

                        {/* Developer Notes */}
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Developer / Suggestion Notes</h5>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed bg-amber-50/25 p-3.5 rounded-xl border border-amber-100/50">{generatedBugReport.devNote}</p>
                        </div>

                      </div>

                      {/* Output Footer */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-400">
                        <span>Report generated by QA Copilot AI Engine</span>
                        <span>Mode: {bugReportMode === 'manual' ? 'Manual details' : 'Visual screenshot audit'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-6 space-y-4">
                      <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center shadow-xs">
                        <Bug className="w-8 h-8 text-orange-500 dark:text-orange-400" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-sm font-bold text-slate-700 tracking-tight">Waiting for Report Input</h3>
                        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                          Please fill in the bug details on the left panel or upload a screenshot, then click "Generate" to construct a comprehensive bug report specification for the development team.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            <main className="pt-16 min-h-screen flex">
          {/* Side Pane */}
          <section className="w-[320px] border-r border-white/40 bg-white/20 backdrop-blur-sm p-6 flex flex-col gap-8 fixed top-16 left-0 h-[calc(100vh-64px)] overflow-y-auto">
            {activeFeature === 'generator' ? (
            <div className="space-y-6">
              {/* Mode Switcher for Generator */}
              <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button 
                  onClick={() => handleInputModeChange('manual')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                    inputMode === 'manual' ? "bg-white text-pink-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Manual Text
                </button>
                <button 
                  onClick={() => handleInputModeChange('upload')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                    inputMode === 'upload' ? "bg-white text-pink-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Upload PRD
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-pink-900 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PRD Source
                </h2>
                <p className="text-[11px] text-pink-600/70 font-medium tracking-wide">
                  {inputMode === 'manual' ? "Write or paste feature requirements" : "Attach PRD document"}
                </p>
              </div>

              {inputMode === 'manual' ? (
                <div className="relative group">
                  <textarea
                    value={prdText}
                    onChange={(e) => handlePrdTextChange(e.target.value)}
                    disabled={results.length > 0}
                    placeholder="Example: Login with Google feature, email validation, and login limits..."
                    className={cn(
                      "w-full h-[320px] p-5 text-sm bg-white/60 border border-pink-100 rounded-3xl focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 shadow-inner transition-all outline-none resize-none font-sans placeholder:text-slate-400 leading-relaxed",
                      results.length > 0 && "opacity-60 cursor-not-allowed"
                    )}
                  />
                  <div className="absolute bottom-4 right-5 flex items-center gap-1.5 px-2.5 py-1 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full shadow-sm">
                    <Hash className={cn("w-3 h-3", prdText.trim().split(/\s+/).filter(w => w.length > 0).length >= 15 ? "text-emerald-500" : "text-slate-400")} />
                    <span className={cn(
                       "text-[10px] font-bold",
                       prdText.trim().split(/\s+/).filter(w => w.length > 0).length >= 15 ? "text-emerald-600" : "text-slate-500"
                    )}>
                      {prdText.trim().split(/\s+/).filter(w => w.length > 0).length} / 15 words
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div 
                    {...generatorDropzone.getRootProps()} 
                    className={cn(
                      "h-[160px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all",
                      results.length > 0 ? "cursor-not-allowed opacity-40 border-slate-200" : generatorDropzone.isDragActive ? "border-pink-500 bg-pink-50 cursor-pointer" : "border-pink-100 bg-white/40 hover:bg-white/60 hover:border-pink-300 cursor-pointer"
                    )}
                  >
                    <input {...generatorDropzone.getInputProps()} disabled={results.length > 0} />
                    <Upload className="w-10 h-10 text-pink-400 mb-3" />
                    <p className="text-[10px] text-pink-600 font-bold uppercase tracking-[0.15em] px-6 text-center leading-relaxed">
                      {generatorDropzone.isDragActive ? "Drop file here" : "Click or drag PDF, DOCX, TXT"}
                    </p>
                  </div>

                  {generatorFile ? (
                    <div className="p-4 bg-white/80 border border-pink-100 rounded-3xl flex items-center gap-3 shadow-sm group animate-in zoom-in-95">
                      <div className="p-2 bg-pink-50 rounded-xl text-pink-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{generatorFile.name}</p>
                        <p className="text-[9px] text-pink-500 font-bold uppercase tracking-tighter mt-0.5">Generator PRD</p>
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
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No file uploaded</p>
                    </div>
                  )}
                </div>
              )}

              {/* UI Screenshots (Optional) Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-bold text-pink-900 uppercase tracking-widest opacity-60">UI Screenshots / Wireframe (Optional)</p>
                  {generatorImages.length > 0 && (
                    <span className="text-[9px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">{generatorImages.length} images</span>
                  )}
                </div>
                
                <div 
                  {...imageDropzone.getRootProps()} 
                  className={cn(
                    "flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all py-6",
                    results.length > 0 ? "cursor-not-allowed opacity-40 border-slate-200" : imageDropzone.isDragActive ? "border-pink-500 bg-pink-50 cursor-pointer" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-pink-200 cursor-pointer"
                  )}
                >
                  <input {...imageDropzone.getInputProps()} disabled={results.length > 0} />
                  <PlusCircle className="w-6 h-6 text-slate-400 mb-2" />
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-6 text-center leading-relaxed">
                    Upload Screenshot or UI Design
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
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-600" /> Coverage Analyzer
                </h2>
                <p className="text-[11px] text-emerald-600/70 font-medium tracking-wide">
                  Compare PRD with existing Test Cases
                </p>
              </div>

              <div className="space-y-5">
                {/* PRD Upload for Checker */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-emerald-950 uppercase tracking-widest ml-1 opacity-60">1. PRD Document</p>
                  <div 
                    {...checkerPrdDropzone.getRootProps()} 
                    className={cn(
                      "h-[100px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl transition-all",
                      checkerPrdDropzone.isDragActive ? "border-emerald-500 bg-emerald-50 cursor-pointer" : "border-emerald-100 bg-white/40 hover:bg-white/60 hover:border-emerald-300 cursor-pointer"
                    )}
                  >
                    <input {...checkerPrdDropzone.getInputProps()} />
                    <FileBox className="w-6 h-6 text-emerald-400 mb-2" />
                    <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider px-4 text-center leading-tight">
                      {checkerPrdFile ? checkerPrdFile.name : "Upload PRD"}
                    </p>
                  </div>
                </div>

                {/* Existing Test Case Upload for Checker */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-emerald-950 uppercase tracking-widest ml-1 opacity-60">2. Existing Test Case</p>
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
                  {checkerCoverage ? (
                    <button
                      onClick={() => {
                        setConfirmation({
                          show: true,
                          title: 'Reset Coverage Analysis?',
                          message: 'Are you sure you want to reset the current coverage analysis results and uploaded files?',
                          onConfirm: () => {
                            setCheckerCoverage(null);
                            setCheckerPrdFile(null);
                            setCheckerTestCaseFile(null);
                            setInputError(null);
                            setConfirmation(prev => ({ ...prev, show: false }));
                            toast.info("Coverage analysis successfully reset!");
                          }
                        });
                      }}
                      className="w-full bg-rose-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-rose-600/20 flex items-center justify-center gap-2 hover:bg-rose-700 hover:-translate-y-0.5 active:translate-y font-sans tracking-wide"
                    >
                      <RefreshCw className="w-5 h-5 animate-spin-once" />
                      Reset Analysis
                    </button>
                  ) : (
                    <button
                      onClick={checkCoverage}
                      disabled={isCheckingCoverage || !checkerPrdFile || !checkerTestCaseFile}
                      className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y font-sans tracking-wide"
                    >
                      {isCheckingCoverage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                      Analyze Coverage
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {activeFeature === 'generator' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-pink-900 uppercase tracking-widest ml-1 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Lang
                    </label>
                    <div className="relative group">
                      <select 
                        value={language}
                        disabled={results.length > 0}
                        onChange={(e) => setLanguage(e.target.value as LanguageType)}
                        className={cn(
                          "w-full bg-white/60 border border-pink-100 rounded-xl px-4 py-2 text-[11px] outline-none focus:ring-4 focus:ring-pink-500/10 shadow-sm transition-all appearance-none",
                          results.length > 0 && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-pink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-pink-600 transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-pink-900 uppercase tracking-widest ml-1 flex items-center gap-1">
                      <FileBox className="w-3 h-3" /> Layout
                    </label>
                    <div className="relative group">
                      <select 
                        value={template}
                        disabled={results.length > 0}
                        onChange={(e) => handleTemplateChange(e.target.value as TemplateType)}
                        className={cn(
                          "w-full bg-white/60 border border-pink-100 rounded-xl px-4 py-2 text-[11px] outline-none focus:ring-4 focus:ring-pink-500/10 shadow-sm transition-all appearance-none",
                          results.length > 0 && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-pink-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-pink-600 transition-colors" />
                    </div>
                  </div>
                </div>

                {results.length > 0 && (
                  <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                    <Info className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[9px] text-amber-700 leading-tight">
                      Template & Layout are locked to maintain data consistency. Reset session to change styles.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleGenerateClick}
                  disabled={loading || (inputMode === 'manual' ? !prdText.trim() : !generatorFile)}
                  className={cn(
                    "w-full text-white font-bold py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 group text-[11px] uppercase tracking-wider font-sans",
                    results.length > 0
                      ? "bg-slate-700 hover:bg-slate-800 shadow-slate-500/20" 
                      : "bg-pink-600 hover:bg-pink-700 shadow-pink-600/20",
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
                      <span>{results.length > 0 ? 'Regenerate' : 'Generate Test Cases'}</span>
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

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] text-slate-500 leading-relaxed">
              <strong>Pro Tip:</strong> {activeFeature === 'generator' ? (inputMode === 'manual' ? "Use clear commands and descriptions." : "Structured PDFs yield the best results.") : "Ensure your Test Case file has a Title or Scenario column."}
            </div>

            {results.length > 0 && activeFeature === 'generator' && (
              <button
                onClick={fullReset}
                className="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-3.5 rounded-2xl transition-all text-xs flex items-center justify-center gap-2"
              >
                <X className="w-3.5 h-3.5" />
                Reset All Data
              </button>
            )}
          </div>
        </section>


        {/* Right Pane: Results */}
        <section className="flex-1 ml-[320px] bg-white/10 flex flex-col p-8 overflow-hidden min-h-[calc(100vh-64px)]">
          <div className="w-full space-y-6">
            <div className="flex flex-col gap-6">
              {/* Header Banner */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    {activeFeature === 'generator' ? (
                      <div className="w-9 h-9 bg-pink-600 rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white fill-white" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
                        <PieChart className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">
                      {activeFeature === 'generator' ? "Test Case Generator" : "Coverage Analysis"}
                    </h2>
                  </div>
                  <p className="text-slate-500 text-xs font-medium">
                    {activeFeature === 'generator' 
                      ? (viewMode === 'coverage' ? "Coverage analysis of generated results vs PRD documents" : "High-quality automated test scenarios from specification requirements") 
                      : "Visualization of requirement coverage based on your uploaded test cases"}
                  </p>
                </div>

                <div className="flex items-center gap-4 sm:self-center">
                  {activeFeature === 'generator' && filteredResults.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 shadow-inner">
                      <button onClick={() => openExportModal('csv')} className="flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                      <button onClick={() => openExportModal('excel')} className="flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                        <FileBox className="w-3.5 h-3.5" />
                        Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {activeFeature === 'generator' && viewMode !== 'coverage' && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex bg-white/40 backdrop-blur-md p-1.5 rounded-2xl border border-pink-50 shadow-sm overflow-x-auto no-scrollbar">
                    {FILTERS.map(f => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={cn(
                          "px-6 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                          activeFilter === f 
                            ? "bg-pink-600 text-white shadow-md font-black" 
                            : "text-slate-500 hover:text-pink-600 font-extrabold"
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
                      placeholder="Search scenarios or expected results..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-pink-50 rounded-2xl outline-none focus:ring-4 focus:ring-pink-500/5 focus:border-pink-400 shadow-sm transition-all placeholder:text-slate-400 font-medium"
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
                    className="bg-white rounded-3xl border border-emerald-100 shadow-xl overflow-hidden"
                  >
                    <div className="p-8 border-b border-emerald-50 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight">Requirement Analysis</h2>
                          <p className="text-slate-500 text-sm">Comparison results between the PRD specification and provided Test Cases.</p>
                        </div>
                        <div className="text-right">
                          <div className="text-6xl font-black text-emerald-600 tracking-tighter leading-none">{checkerCoverage.percent}%</div>
                          <div className="text-xs font-bold text-emerald-900 uppercase tracking-widest mt-2">Coverage Ratio</div>
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

                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Covered (Fulfilled)</h3>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                          {checkerCoverage.fullyCovered.map((item, i) => (
                            <CoverageItemCard key={i} item={item} status="full" />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Partial (Partial)</h3>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                          {checkerCoverage.partiallyCovered.map((item, i) => (
                            <CoverageItemCard key={i} item={item} status="partial" />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Missing (None)</h3>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                          {checkerCoverage.missingRequirements.map((item, i) => (
                            <CoverageItemCard key={i} item={item} status="missing" />
                          ))}
                        </div>
                      </div>
                    </div>

                    {checkerCoverage.recommendations && (
                      <div className="mx-8 mb-8 bg-indigo-50/50 border border-indigo-100/60 p-4 rounded-2xl shadow-xs">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                            <Zap className="w-4 h-4 fill-indigo-200" strokeWidth={2.5} />
                          </div>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">AI Strategic Recommendations</h4>
                            <div className="max-h-48 overflow-y-auto pr-1">
                              {renderRecommendationText(checkerCoverage.recommendations)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  /* Empty state for Checker */
                  <div className="bg-white rounded-[40px] border border-emerald-100 shadow-xl p-20 flex flex-col items-center text-center gap-8">
                    <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center relative">
                      <PieChart className="w-16 h-16 text-emerald-300" strokeWidth={1} />
                      <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-lg border border-emerald-100 flex items-center justify-center animate-bounce">
                        <Upload className="w-6 h-6 text-emerald-600" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-emerald-900 tracking-tight">Start Coverage Analysis</h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                        Upload your PRD document and existing Test Case file. We will analyze the coverage ratio and gaps.
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
                  {results.length > 0 ? (
                    /* Table Section */
                    <div className="flex flex-col gap-4">
                      <div className="bg-white/60 backdrop-blur-md border border-pink-100 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse table-auto">
                            <thead>
                              <TestCaseTableHeader template={activeResultsTemplate} theme="pink" />
                            </thead>
                            <tbody className="divide-y divide-pink-50">
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
                                        "hover:bg-pink-50/20 transition-colors group cursor-default text-[13px]",
                                        isEditing && "bg-pink-50/60"
                                      )}
                                    >
                                      <td className="px-6 py-4 align-middle whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                          <span className="font-mono text-[11px] font-bold text-pink-600 uppercase">{tc.id}</span>
                                        </div>
                                      </td>

                                      <td className="px-6 py-4 align-middle text-center border-x border-pink-50/50">
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
                                            ) : <div className="text-slate-600 bg-pink-50/30 p-2 rounded font-medium">{tc.expectedResult}</div>}
                                          </td>
                                        </>
                                      )}

                                      {/* Gherkin Template Rows */}
                                      {activeResultsTemplate === 'Gherkin' && (() => {
                                        const gp = getGherkinParts(tc, language);
                                        return (
                                          <>
                                            <td className="px-6 py-4">
                                              {isEditing ? (
                                                <input className="w-full p-1 border rounded font-bold" value={data.title} onChange={e => setEditBuffer({...data, title: e.target.value})} />
                                              ) : <div className="font-bold text-slate-800">{tc.title}</div>}
                                            </td>
                                            <td className="px-6 py-4 italic text-slate-600">
                                              {isEditing ? (
                                                <textarea className="w-full p-1 border rounded text-xs" value={data.given} onChange={e => setEditBuffer({...data, given: e.target.value})} />
                                              ) : <>Given {gp.given}</>}
                                            </td>
                                            <td className="px-6 py-4 italic text-slate-600">
                                              {isEditing ? (
                                                <textarea className="w-full p-1 border rounded text-xs" value={data.when} onChange={e => setEditBuffer({...data, when: e.target.value})} />
                                              ) : <>When {gp.when}</>}
                                            </td>
                                            <td className="px-6 py-4 italic font-medium text-pink-700">
                                              {isEditing ? (
                                                <textarea className="w-full p-1 border rounded text-xs bg-white" value={data.then || data.expectedResult} onChange={e => setEditBuffer({...data, then: e.target.value})} />
                                              ) : <>Then {gp.then}</>}
                                            </td>
                                          </>
                                        );
                                      })()}

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
                                                  "p-1.5 rounded-lg border border-pink-100 text-pink-600 hover:bg-pink-50 shadow-sm bg-white transition-all",
                                                  regeneratingIds.has(tc.id) && "animate-spin cursor-not-allowed"
                                                )}
                                                title="Regenerate"
                                              >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => startEditing(tc)} className="p-1.5 rounded-lg border border-pink-100 text-slate-600 hover:bg-pink-50/50 shadow-sm bg-white" title="Edit">
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
                                  <td colSpan={10} className="p-0 bg-slate-50/10">
                                    {loading ? (
                                      <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-4">
                                        <div className="relative">
                                          <div className="w-12 h-12 bg-pink-100 rounded-full animate-ping absolute inset-0" />
                                          <Loader2 className="w-12 h-12 text-pink-600 animate-spin relative" />
                                        </div>
                                        <p className="text-sm text-pink-900 font-bold uppercase tracking-widest animate-pulse">Generating...</p>
                                      </div>
                                    ) : (
                                      <div className="py-24 text-center flex flex-col items-center justify-center gap-4 bg-white/40 border border-t-0 border-pink-100/50">
                                        <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center border border-pink-200">
                                          <Search className="w-6 h-6 text-pink-400" />
                                        </div>
                                        <div className="space-y-1">
                                          <h4 className="font-extrabold text-slate-700 text-sm">No Test Scenarios</h4>
                                          <p className="text-xs text-slate-500 max-w-sm leading-relaxed mx-auto flex-wrap">
                                            No test cases found for category <span className="font-bold text-pink-600">"{activeFilter}"</span>{searchQuery ? ` or search query "${searchQuery}"` : ""}. Please change your filter or clear your search query.
                                          </p>
                                        </div>
                                        <button 
                                          onClick={() => { setActiveFilter('All'); setSearchQuery(''); }}
                                          className="px-4 py-1.5 bg-pink-100 border border-pink-200 text-pink-700 text-xs font-black rounded-lg transition-all active:scale-95 shadow-xs"
                                        >
                                          Reset Filters & Search
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination & Footer */}
                      <div className="bg-slate-50/50 p-4 flex items-center justify-between border-t border-pink-50 text-[11px] font-medium text-slate-500">
                        <div className="flex items-center gap-4">
                           {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                               <button onClick={() => setResultsPage(prev => Math.max(1, prev - 1))} disabled={resultsPage === 1} className="p-1.5 rounded-lg bg-white border border-pink-100 text-pink-600 disabled:opacity-30">
                                 <Undo2 className="w-3.5 h-3.5 rotate-90" />
                               </button>
                               <span className="px-3">Page {resultsPage} of {totalPages}</span>
                               <button onClick={() => setResultsPage(prev => Math.min(totalPages, prev + 1))} disabled={resultsPage === totalPages} className="p-1.5 rounded-lg bg-white border border-pink-100 text-pink-600 disabled:opacity-30">
                                 <Undo2 className="w-3.5 h-3.5 -rotate-90" />
                               </button>
                            </div>
                           )}
                           <span className="h-4 w-px bg-slate-200" />
                           <span>Total: <strong className="text-pink-900 font-bold">{results.length}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="px-2 py-0.5 bg-pink-50 text-pink-700 rounded text-[9px] font-bold uppercase border border-pink-100">{activeResultsTemplate} Template</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : renderOnboardingLanding()}

                    {/* Action Button: Cek Coverage Hasil Generate */}
                    {inputMode === 'upload' && results.length > 0 && !generatorCoverage && !isFromHistory && (
                      <div className="flex justify-center">
                         <button 
                          onClick={() => checkCoverage()}
                          disabled={isCheckingCoverage}
                          className="px-8 py-3 bg-white border-2 border-emerald-600 text-emerald-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
                         >
                           {isCheckingCoverage ? <Loader2 className="w-4 h-4 animate-spin" /> : <PieChart className="w-4 h-4" />}
                           Check Generated Coverage
                         </button>
                      </div>
                    )}

                  {/* Coverage Section for Generator (shows below table) */}
                  {generatorCoverage && (
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-10"
                    >
                      <div className="bg-white rounded-[2.5rem] border border-emerald-100 shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-emerald-50 bg-slate-50/50">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight">Coverage findings</h2>
                              <p className="text-slate-500 text-sm">How well the PRD specifications are covered by the generated test cases above.</p>
                            </div>
                            <div className="text-right">
                              <div className="text-6xl font-black text-emerald-600 tracking-tighter leading-none">{generatorCoverage.percent}%</div>
                              <div className="text-xs font-bold text-emerald-950 uppercase tracking-widest mt-2">Coverage Ratio</div>
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
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Covered (Fulfilled)</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                              {generatorCoverage.fullyCovered.map((item, i) => (
                                <CoverageItemCard key={i} item={item} status="full" />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Partial (Partial)</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                              {generatorCoverage.partiallyCovered.map((item, i) => (
                                <CoverageItemCard key={i} item={item} status="partial" />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Missing (None)</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                              {generatorCoverage.missingRequirements.map((item, i) => (
                                <CoverageItemCard key={i} item={item} status="missing" />
                              ))}
                            </div>
                          </div>
                        </div>

                        {(generatorCoverage.missingRequirements.length > 0 || generatorCoverage.partiallyCovered.length > 0) && suggestedMissingTestCases.length === 0 && (
                          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                            <button
                              onClick={generateMissingTestCases}
                              disabled={isGeneratingMissingCases}
                              className="bg-pink-950 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] hover:bg-black transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                              {isGeneratingMissingCases ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />}
                              Generate Test Cases for Uncovered Gaps
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Suggested Missing Test Cases Section */}
                      {suggestedMissingTestCases.length > 0 && (
                        <div className="bg-amber-50/20 rounded-2xl border border-amber-200/50 shadow-xl overflow-hidden p-0.5">
                          <div className="bg-amber-100/30 border-b border-amber-200/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-amber-200 rounded-lg text-amber-700">
                                  <Zap className="w-4 h-4 fill-amber-700 animate-pulse" />
                                </div>
                                <h3 className="text-xl font-black text-amber-900 tracking-tight">Suggested Missing Test Cases</h3>
                              </div>
                              <p className="text-xs text-amber-700/80 font-semibold max-w-xl leading-relaxed">
                                Additional test scenarios based on requirement gaps. Review findings before merging with primary results list.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                               <button 
                                onClick={addAllSuggestedToMain}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                               >
                                 <PlusCircle className="w-4 h-4 text-amber-100" />
                                 Add to Main Results
                               </button>
                               <button 
                                onClick={() => setSuggestedMissingTestCases([])}
                                className="bg-white border border-amber-200 text-amber-700 px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-amber-50 transition-all flex items-center gap-1.5 active:scale-95"
                               >
                                 <X className="w-4 h-4 text-amber-600" />
                                 Discard
                               </button>
                            </div>
                          </div>

                          <div className="p-3">
                             <div className="bg-white rounded-xl overflow-hidden border border-amber-100 shadow-md overflow-x-auto">
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

                                      {activeResultsTemplate === 'Gherkin' && (() => {
                                        const gp = getGherkinParts(tc, language);
                                        return (
                                          <>
                                            <td className="px-6 py-4 font-bold text-slate-800">{tc.title}</td>
                                            <td className="px-6 py-4 italic text-slate-600">Given {gp.given}</td>
                                            <td className="px-6 py-4 italic text-slate-600">When {gp.when}</td>
                                            <td className="px-6 py-4 italic font-medium text-amber-700">Then {gp.then}</td>
                                          </>
                                        );
                                      })()}

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
                  <div className={cn(
                    "p-2 rounded-lg font-bold",
                    appPage === 'requirement_checker'
                      ? "bg-violet-50 text-violet-600"
                      : appPage === 'bug_report'
                        ? "bg-orange-50 text-orange-600"
                        : activeFeature === 'coverage'
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-pink-50 text-pink-600"
                  )}>
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {appPage === 'requirement_checker'
                        ? "Requirement Audit History"
                        : appPage === 'bug_report' 
                          ? "Bug Report History" 
                          : activeFeature === 'coverage' 
                            ? "Coverage History" 
                            : "Generation History"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {appPage === 'requirement_checker'
                        ? "Last 20 requirement audits on this device"
                        : appPage === 'bug_report'
                          ? "Last 20 bug reports on this device"
                          : activeFeature === 'coverage' 
                            ? "Last 20 coverage reports on this device" 
                            : "Last 20 sessions on this device"}
                    </p>
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
                {appPage === 'requirement_checker' ? (
                  reqQualityHistoryList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none py-12">
                      <Clock className="w-12 h-12 mb-2 text-slate-300" />
                      <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No history yet</p>
                    </div>
                  ) : (
                    reqQualityHistoryList.map(item => (
                      <div 
                        key={item.id}
                        className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer relative animate-in fade-in duration-300"
                        onClick={() => loadFromReqQualityHistory(item)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-bold uppercase tracking-tighter">
                              {item.id}
                            </div>
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold">
                              {item.results.qualityScore}/100
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteReqQualityHistoryItem(item.id); }}
                            className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-slate-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 truncate mb-1 pr-8">{item.title}</h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          Rating: {item.results?.qualityLabel || 'N/A'} • {(item.results?.issuesFound || []).length} Issues
                        </p>
                      </div>
                    ))
                  )
                ) : appPage === 'bug_report' ? (
                  bugReportHistoryList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none py-12">
                      <Clock className="w-12 h-12 mb-2 text-slate-300" />
                      <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No history yet</p>
                    </div>
                  ) : (
                    bugReportHistoryList.map(item => (
                      <div 
                        key={item.id}
                        className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-800 hover:shadow-md transition-all cursor-pointer relative animate-in fade-in duration-300"
                        onClick={() => loadFromBugReportHistory(item)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] font-bold uppercase tracking-tighter">
                              {item.id}
                            </div>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold capitalize">
                              {item.bugReportMode}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteBugReportHistoryItem(item.id); }}
                            className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-slate-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 truncate mb-1 pr-8">{item.title}</h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.bugDescription || "UI Screenshot Analysis"}
                        </p>
                      </div>
                    ))
                  )
                ) : activeFeature === 'coverage' ? (
                  coverageHistoryList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none py-12">
                      <Clock className="w-12 h-12 mb-2 text-slate-300" />
                      <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No history yet</p>
                    </div>
                  ) : (
                    coverageHistoryList.map(item => (
                      <div 
                        key={item.id}
                        className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer relative animate-in fade-in duration-300"
                        onClick={() => loadFromCoverageHistory(item)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[10px] font-bold uppercase tracking-tighter">
                              {item.percent}% Covered
                            </div>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteCoverageHistoryItem(item.id); }}
                            className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 truncate mb-1 pr-8">{item.title}</h4>
                        <p className="text-[11px] text-slate-500">
                          {item.coverage.fullyCovered.length + item.coverage.partiallyCovered.length + item.coverage.missingRequirements.length} Requirements • {item.percent}% Ratio
                        </p>
                      </div>
                    ))
                  )
                ) : (
                  historyList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none py-12">
                      <Clock className="w-12 h-12 mb-2 text-slate-300" />
                      <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No history yet</p>
                    </div>
                  ) : (
                    historyList.map(item => (
                      <div 
                        key={item.id}
                        className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-pink-200 hover:shadow-md transition-all cursor-pointer relative animate-in fade-in duration-300"
                        onClick={() => loadFromHistory(item)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 bg-pink-50 text-pink-600 rounded text-[10px] font-bold uppercase tracking-tighter">
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
                  )
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
            {(() => {
              const activeThemePage = appPage === 'generator' ? activeFeature : appPage;
              const toolTheme = getToolTheme(activeThemePage);
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
                >
                  <div className="p-8 text-center">
                    <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4", toolTheme.bgLight)}>
                      <Info className={cn("w-8 h-8", toolTheme.text)} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmation.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{confirmation.message}</p>
                  </div>
                  <div className="flex p-4 gap-3 bg-slate-50">
                    <button 
                      onClick={() => setConfirmation(prev => ({ ...prev, show: false }))}
                      className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmation.onConfirm}
                      className={cn("flex-1 py-3 text-sm font-bold text-white rounded-xl transition-colors shadow-xl", toolTheme.bg, toolTheme.hover, toolTheme.glowSm)}
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              );
            })()}
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
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6", exportModal.format === 'csv' ? "bg-pink-50" : "bg-emerald-50")}>
                  {exportModal.format === 'csv' ? <Download className="w-8 h-8 text-pink-600" /> : <FileBox className="w-8 h-8 text-emerald-600" />}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Export Data (.{exportModal.format})</h3>
                <p className="text-sm text-slate-500 mb-6">Enter a custom filename, or leave it blank to auto-generate one.</p>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Filename (Optional)</label>
                    <input 
                      type="text" 
                      value={exportModal.filename}
                      onChange={(e) => setExportModal(prev => ({ ...prev, filename: e.target.value }))}
                      placeholder="Example: checkout_flows_v1"
                      className={cn(
                        "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 outline-none transition-all placeholder:text-slate-300 font-medium",
                        exportModal.format === 'csv' ? "focus:ring-pink-500/10 focus:border-pink-400" : "focus:ring-emerald-500/10 focus:border-emerald-400"
                      )}
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
                    <Info className="w-4 h-4 text-slate-400 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-tight">
                      File will be saved as <span className="font-bold text-slate-700">{exportModal.filename || 'test_cases_TIMESTAMP'}.{exportModal.format}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex p-4 gap-3 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setExportModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExportConfirm}
                  className={cn(
                    "flex-1 py-3.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg",
                    exportModal.format === 'csv' ? "bg-pink-600 hover:bg-pink-700 shadow-pink-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
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
