export type TestCaseType = 'Positive' | 'Negative' | 'Edge Case';

export interface TestCase {
  id: string;
  title: string;
  type: TestCaseType;
  priority: 'High' | 'Medium' | 'Low';
  preconditions?: string;
  steps: string[];
  expectedResult: string;
  source?: 'generated' | 'coverage-gap';
  // Gherkin specific fields (optional)
  given?: string;
  when?: string;
  then?: string;
  coveredRequirement?: string;
}

export type TemplateType = 'Simple' | 'Gherkin' | 'Jira/Zephyr' | 'TestRail';
export type LanguageType = 'Indonesia' | 'English';

export interface CoverageItem {
  requirementId: string;
  requirement: string;
  matchedTestCases?: { id: string; title: string }[];
  reason: string;
  missingAspects?: string[];
}

export interface CoverageResult {
  percent: number;
  fullyCovered: CoverageItem[];
  partiallyCovered: CoverageItem[];
  missingRequirements: CoverageItem[];
  recommendations: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  timestamp: number;
  template: TemplateType;
  language: LanguageType;
  testCases: TestCase[];
}

export interface CoverageHistoryItem {
  id: string;
  title: string;
  timestamp: number;
  prdFileName: string;
  tcFileName: string;
  percent: number;
  coverage: CoverageResult;
}

export interface GenerationSettings {
  template: TemplateType;
  filter: 'All' | TestCaseType;
  language: LanguageType;
  count: number;
}

export interface BugReportHistoryItem {
  id: string;
  title: string;
  timestamp: number;
  bugReportMode: 'manual' | 'screenshot';
  bugDescription: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  bugEnvironment: string;
  bugSeverity: string;
  bugPriority: string;
  bugScreenshot: { name: string; base64: string; mimeType: string } | null;
  generatedBugReport: any;
}

export interface ReqQualityHistoryItem {
  id: string;
  title: string;
  timestamp: number;
  reqText: string;
  fileName: string | null;
  language: LanguageType;
  results: {
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
  };
}

