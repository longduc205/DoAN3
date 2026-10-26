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
}

export interface AiAdvice {
  content: string;
  provider: string;
  model: string;
  isAiAssisted: boolean;
  generatedAt: string;
}
