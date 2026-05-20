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
  requirement: string;
  matchedTestCaseIds?: string[];
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

export interface GenerationSettings {
  template: TemplateType;
  filter: 'All' | TestCaseType;
  language: LanguageType;
  count: number;
}
