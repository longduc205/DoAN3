import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../core/services/base-api.service';
import {
  AiAdvice, AiContext, AuditLog, AuditStats, VulnerabilityFacets, AuditResult, Report, RolePermissions, UserAdmin, ReportDetail, ReportTemplate, ApiResponse, BaseSearchParam, DashboardSummary, PaginatedResponse, Project, ProjectStatus, Scan,
  ScanFinding, ScanProgress, ScanStatus, ScopeMode, Severity, Target, TargetEnvironment, UserLookup, Vulnerability,
  VulnerabilityComment, VulnerabilityDetail, VulnerabilityHistory, VulnerabilityStatus,
} from '../shared/models/api.models';

export interface ProjectInput { code: string; name: string; description: string | null; status?: ProjectStatus }
export interface TargetInput {
  projectId: string; name: string; baseUrl: string; environment: TargetEnvironment; scopeMode: ScopeMode;
  isEnabled: boolean; isAuthorized: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProjectsApi extends BaseApiService {
  protected readonly resource = 'projects';
  getAll(p: BaseSearchParam & { status?: ProjectStatus | null }): Observable<PaginatedResponse<Project[]>> { return this.post('get-all', p); }
  getById(id: string): Observable<ApiResponse<Project>> { return this.post('get-by-id', { id }); }
  create(body: ProjectInput): Observable<ApiResponse<Project>> { return this.post('create', body); }
  update(body: ProjectInput & { id: string }): Observable<ApiResponse<Project>> { return this.post('update', body); }
  delete(id: string): Observable<ApiResponse<boolean>> { return this.post('delete', { id }); }
}

@Injectable({ providedIn: 'root' })
export class TargetsApi extends BaseApiService {
  protected readonly resource = 'targets';
  getAll(p: BaseSearchParam & { projectId?: string }): Observable<PaginatedResponse<Target[]>> { return this.post('get-all', p); }
  getById(id: string): Observable<ApiResponse<Target>> { return this.post('get-by-id', { id }); }
  create(body: TargetInput): Observable<ApiResponse<Target>> { return this.post('create', body); }
  update(body: TargetInput & { id: string }): Observable<ApiResponse<Target>> { return this.post('update', body); }
  delete(id: string): Observable<ApiResponse<boolean>> { return this.post('delete', { id }); }
}

@Injectable({ providedIn: 'root' })
export class ScansApi extends BaseApiService {
  protected readonly resource = 'scans';
  getAll(p: BaseSearchParam & { projectId?: string; status?: ScanStatus }): Observable<PaginatedResponse<Scan[]>> { return this.post('get-all', p); }
  getById(id: string): Observable<ApiResponse<Scan>> { return this.post('get-by-id', { id }); }
  create(targetId: string): Observable<ApiResponse<Scan>> { return this.post('create', { targetId, scanType: 'Mock' }); }
  getProgress(id: string): Observable<ApiResponse<ScanProgress>> { return this.post('get-progress', { id }); }
  cancel(id: string): Observable<ApiResponse<Scan>> { return this.post('cancel', { id }); }
  getFindings(scanId: string, p: BaseSearchParam & { severity?: Severity } = {}): Observable<PaginatedResponse<ScanFinding[]>> {
    return this.post('get-findings', { ...p, scanId });
  }
}

@Injectable({ providedIn: 'root' })
export class AiApi extends BaseApiService {
  protected readonly resource = 'ai';
  explain(ref: AiRef): Observable<ApiResponse<AiAdvice>> { return this.post('explain-vulnerability', ref); }
  suggestRemediation(ref: AiRef): Observable<ApiResponse<AiAdvice>> { return this.post('suggest-remediation', ref); }
  getContext(ref: AiRef): Observable<ApiResponse<AiContext>> { return this.post('get-context', ref); }
  ask(vulnerabilityId: string, question: string): Observable<ApiResponse<AiAdvice>> { return this.post('ask', { vulnerabilityId, question }); }
}

/** AI works on a scan finding or a vulnerability (its latest occurrence). */
export type AiRef = { findingId: string } | { vulnerabilityId: string };

export interface VulnerabilitySearch extends BaseSearchParam {
  projectId?: string; severity?: Severity; status?: VulnerabilityStatus; isOpen?: boolean | null; assignedToMe?: boolean;
  findingType?: string; assigneeId?: string;
}

@Injectable({ providedIn: 'root' })
export class VulnerabilitiesApi extends BaseApiService {
  protected readonly resource = 'vulnerabilities';
  getAll(p: VulnerabilitySearch): Observable<PaginatedResponse<Vulnerability[]>> { return this.post('get-all', p); }
  getFacets(p: VulnerabilitySearch): Observable<ApiResponse<VulnerabilityFacets>> { return this.post('get-facets', p); }
  getById(id: string): Observable<ApiResponse<VulnerabilityDetail>> { return this.post('get-by-id', { id }); }
  updateStatus(body: { id: string; status: VulnerabilityStatus; reason?: string | null; reviewAt?: string | null }): Observable<ApiResponse<VulnerabilityDetail>> {
    return this.post('update-status', body);
  }
  assign(ids: string[], assigneeId: string): Observable<ApiResponse<number>> { return this.post('assign', { ids, assigneeId }); }
  getAssignees(): Observable<ApiResponse<UserLookup[]>> { return this.post('get-assignees'); }
  addComment(vulnerabilityId: string, content: string, isAiNote = false): Observable<ApiResponse<VulnerabilityComment>> {
    return this.post('add-comment', { vulnerabilityId, content, isAiNote });
  }
  getComments(id: string): Observable<ApiResponse<VulnerabilityComment[]>> { return this.post('get-comments', { id }); }
  getHistory(id: string): Observable<ApiResponse<VulnerabilityHistory[]>> { return this.post('get-history', { id }); }
}

@Injectable({ providedIn: 'root' })
export class DashboardApi extends BaseApiService {
  protected readonly resource = 'dashboard';
  getSummary(): Observable<ApiResponse<DashboardSummary>> { return this.post('get-summary'); }
}

@Injectable({ providedIn: 'root' })
export class ReportsApi extends BaseApiService {
  protected readonly resource = 'reports';
  getAll(p: BaseSearchParam & { projectId?: string }): Observable<PaginatedResponse<Report[]>> { return this.post('get-all', p); }
  getById(id: string): Observable<ApiResponse<ReportDetail>> { return this.post('get-by-id', { id }); }
  create(body: { projectId: string; title?: string | null; template: ReportTemplate }): Observable<ApiResponse<ReportDetail>> { return this.post('create', body); }
  retry(id: string): Observable<ApiResponse<ReportDetail>> { return this.post('retry', { id }); }
}

@Injectable({ providedIn: 'root' })
export class UsersApi extends BaseApiService {
  protected readonly resource = 'users';
  getAll(p: BaseSearchParam & { role?: string }): Observable<PaginatedResponse<UserAdmin[]>> { return this.post('get-all', p); }
  changeRole(userId: string, role: string): Observable<ApiResponse<UserAdmin>> { return this.post('change-role', { userId, role }); }
  setActive(userId: string, isActive: boolean): Observable<ApiResponse<UserAdmin>> { return this.post('set-active', { userId, isActive }); }
  getRolePermissions(): Observable<ApiResponse<RolePermissions[]>> { return this.post('get-role-permissions'); }
}

export interface AuditLogSearch extends BaseSearchParam {
  userId?: string; action?: string; entityType?: string; result?: AuditResult; from?: string; to?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogsApi extends BaseApiService {
  protected readonly resource = 'audit-logs';
  getAll(p: AuditLogSearch): Observable<PaginatedResponse<AuditLog[]>> { return this.post('get-all', p); }
  getStats(): Observable<ApiResponse<AuditStats>> { return this.post('get-stats'); }
  /** CSV file (not the JSON envelope), so it bypasses post(). */
  exportCsv(p: AuditLogSearch): Observable<Blob> { return this.http.post(`/api/${this.resource}/export`, p, { responseType: 'blob' }); }
}
