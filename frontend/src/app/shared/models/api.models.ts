// Mirrors backend WebSec.Shared response/model types. Enums are serialized as strings.

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  code: string | null;
  traceId: string | null;
}

export interface PagingInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  paging: PagingInfo | null;
}

export interface BaseSearchParam {
  page?: number;
  pageSize?: number;
  keyword?: string | null;
  sortBy?: string | null;
  sortDirection?: 'Asc' | 'Desc';
}

export type ProjectStatus = 'Active' | 'Archived';
export type TargetEnvironment = 'Lab' | 'Development' | 'Staging' | 'Production';
export type ScopeMode = 'ExactUrl' | 'SameHostPathPrefix';
export type ScanType = 'Mock' | 'Passive';
export type ScanStatus = 'Pending' | 'Queued' | 'Running' | 'Cancelling' | 'Completed' | 'Failed' | 'Cancelled';
export type Severity = 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';
export type Confidence = 'Low' | 'Medium' | 'High';
export type VulnerabilityStatus =
  | 'Open' | 'Triaged' | 'Assigned' | 'InProgress' | 'PendingVerification' | 'Resolved' | 'Reopened' | 'FalsePositive' | 'AcceptedRisk';

export interface CurrentUser {
  id: string;
  userName: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ownerId: string;
  status: ProjectStatus;
  createdDate: string;
  updatedDate: string | null;
  // Summary, only filled by projects/get-all.
  targetCount: number;
  unauthorizedTargetCount: number;
  findingCount: number;
  isScanning: boolean;
  lastScanAt: string | null;
}

export interface Target {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  environment: TargetEnvironment;
  scopeMode: ScopeMode;
  isEnabled: boolean;
  isAuthorized: boolean;
  lastScanAt: string | null;
  createdDate: string;
}

export interface Scan {
  id: string;
  projectId: string;
  targetId: string;
  targetName: string;
  targetBaseUrl: string;
  scanType: ScanType;
  status: ScanStatus;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  totalUrls: number;
  totalRequests: number;
  totalFindings: number;
  createdAt: string;
}

export interface ScanProgress {
  id: string;
  status: ScanStatus;
  progressPercent: number;
  totalUrls: number;
  totalRequests: number;
  totalFindings: number;
  isTerminal: boolean;
}

export interface ScanFinding {
  id: string;
  scanId: string;
  targetId: string;
  findingType: string;
  title: string;
  url: string;
  parameterName: string | null;
  severity: Severity;
  confidence: Confidence;
  evidenceSummary: string;
  evidenceRedacted: boolean;
  detectorName: string;
  detectedAt: string;
}

export interface DashboardSummary {
  projects: number;
  targets: number;
  scans: number;
  findings: number;
  findingsBySeverity: Partial<Record<Severity, number>>;
  openVulnerabilities: number;
  openBySeverity: Partial<Record<Severity, number>>;
  byStatus: Partial<Record<VulnerabilityStatus, number>>;
  reappeared: number;
  unassigned: number;
  riskScore: number;
}

export interface Vulnerability {
  id: string;
  projectId: string;
  projectName: string;
  targetId: string;
  targetName: string;
  findingType: string;
  title: string;
  url: string;
  parameterName: string | null;
  severity: Severity;
  status: VulnerabilityStatus;
  isReappeared: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
}

export interface VulnerabilityDetail extends Vulnerability {
  targetBaseUrl: string;
  closeReason: string | null;
  reviewAt: string | null;
  resolvedAt: string | null;
  occurrences: number;
  latestFinding: ScanFinding | null;
  allowedTransitions: VulnerabilityStatus[];
}

export interface VulnerabilityComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  isAiNote: boolean;
  createdAt: string;
}

export interface VulnerabilityHistory {
  id: string;
  changedByName: string | null;
  oldStatus: VulnerabilityStatus | null;
  newStatus: VulnerabilityStatus | null;
  summary: string;
  createdAt: string;
}

export type ReportStatus = 'Generating' | 'Ready' | 'Failed';
export type ReportTemplate = 'Executive' | 'Technical';

export interface Report {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  template: ReportTemplate;
  status: ReportStatus;
  errorSafe: string | null;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ReportVulnerabilityRow {
  title: string; findingType: string; severity: Severity; status: VulnerabilityStatus; targetName: string; url: string;
  assigneeName: string | null; firstDetectedAt: string;
}

export interface ReportSnapshot {
  projectCode: string;
  projectName: string;
  generatedAt: string;
  targets: number;
  scans: number;
  lastScanAt: string | null;
  openVulnerabilities: number;
  riskScore: number;
  openBySeverity: Partial<Record<Severity, number>>;
  byStatus: Partial<Record<VulnerabilityStatus, number>>;
  vulnerabilities: ReportVulnerabilityRow[];
}

export interface ReportDetail extends Report { snapshot: ReportSnapshot | null }

export interface UserLookup { id: string; fullName: string; role: string }

export interface AiContext { findingType: string; title: string; url: string; severity: Severity; evidenceSummary: string }

export interface AiAdvice {
  content: string;
  provider: string;
  model: string;
  isAiAssisted: boolean;
  generatedAt: string;
}
