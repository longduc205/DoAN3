import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../core/services/base-api.service';
import {
  AiAdvice, ApiResponse, BaseSearchParam, DashboardSummary, PaginatedResponse, Project, ProjectStatus, Scan,
  ScanFinding, ScanProgress, ScanStatus, ScopeMode, Severity, Target, TargetEnvironment,
} from '../shared/models/api.models';

export interface ProjectInput { code: string; name: string; description: string | null; status?: ProjectStatus }
export interface TargetInput {
  projectId: string; name: string; baseUrl: string; environment: TargetEnvironment; scopeMode: ScopeMode;
  isEnabled: boolean; isAuthorized: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProjectsApi extends BaseApiService {
  protected readonly resource = 'projects';
  getAll(p: BaseSearchParam): Observable<PaginatedResponse<Project[]>> { return this.post('get-all', p); }
  getById(id: string): Observable<ApiResponse<Project>> { return this.post('get-by-id', { id }); }
  create(body: ProjectInput): Observable<ApiResponse<Project>> { return this.post('create', body); }
  update(body: ProjectInput & { id: string }): Observable<ApiResponse<Project>> { return this.post('update', body); }
  delete(id: string): Observable<ApiResponse<boolean>> { return this.post('delete', { id }); }
}

@Injectable({ providedIn: 'root' })
export class TargetsApi extends BaseApiService {
  protected readonly resource = 'targets';
  getAll(p: BaseSearchParam & { projectId?: string }): Observable<PaginatedResponse<Target[]>> { return this.post('get-all', p); }
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
  explain(findingId: string): Observable<ApiResponse<AiAdvice>> { return this.post('explain-vulnerability', { findingId }); }
  suggestRemediation(findingId: string): Observable<ApiResponse<AiAdvice>> { return this.post('suggest-remediation', { findingId }); }
}

@Injectable({ providedIn: 'root' })
export class DashboardApi extends BaseApiService {
  protected readonly resource = 'dashboard';
  getSummary(): Observable<ApiResponse<DashboardSummary>> { return this.post('get-summary'); }
}
