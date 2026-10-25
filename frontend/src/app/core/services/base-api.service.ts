import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../shared/models/api.models';

/** All feature API services extend this: one place for the base URL and the POST convention. */
export abstract class BaseApiService {
  protected readonly http = inject(HttpClient);
  protected abstract readonly resource: string;

  protected post<TRes>(action: string, body: unknown = {}): Observable<TRes> {
    return this.http.post<TRes>(`/api/${this.resource}/${action}`, body);
  }
}

/** Extracts the safe server message (or a translation key fallback) from an HTTP error. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ApiResponse<unknown>> | null;
    if (body?.message) return body.message;
    if (err.status === 0) return 'errors.network';
  }
  return 'errors.unknown';
}
