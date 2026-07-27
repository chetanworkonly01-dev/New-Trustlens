export interface Audit {
  id: string;
  status: string;
  config: {
    url?: string;
    type: string;
    wcagLevels?: string[];
    standard?: string;
    enabledPillars?: string[];
  };
  score: {
    overall: number;
    complianceLevel: string;
    totalIssues: number;
    testsRun?: number;
  };
  displayScore?: number;
  totalIssues?: number;
  pillarScores?: Record<string, number>;
  trustScore?: { overall: number; trustLevel: string };
  progress: number;
  startedAt: string;
  completedAt?: string;
  crawlCoverage?: {
    totalPagesFound: number;
    pagesAudited: number;
    coveragePercent: number;
  };
}
