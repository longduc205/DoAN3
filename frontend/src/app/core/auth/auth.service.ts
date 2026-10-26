import { computed, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { BaseApiService } from '../services/base-api.service';
import { ApiResponse, CurrentUser, LoginResult } from '../../shared/models/api.models';

interface Session {
  token: string;
  expiresAt: string;
  user: CurrentUser;
}

const STORAGE_KEY = 'websec.session';

// shortcut: access token kept in sessionStorage, or localStorage when "remember me" is ticked (no refresh token yet);
// move to HttpOnly refresh cookie when refresh is implemented.
@Injectable({ providedIn: 'root' })
export class AuthService extends BaseApiService {
  protected readonly resource = 'auth';
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(AuthService.load());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);

  get token(): string | null {
    return this.session()?.token ?? null;
  }

  hasPermission(code: string): boolean {
    return this.user()?.permissions.includes(code) ?? false;
  }

  login(userName: string, password: string, remember = false): Observable<ApiResponse<LoginResult>> {
    return this.post<ApiResponse<LoginResult>>('login', { userName, password }).pipe(
      tap((res) => {
        if (!res.data) return;
        const s: Session = { token: res.data.accessToken, expiresAt: res.data.expiresAt, user: res.data.user };
        (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(s));
        this.session.set(s);
      }),
    );
  }

  logout(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
    this.router.navigateByUrl('/login');
  }

  private static load(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
      const s = JSON.parse(raw ?? 'null') as Session | null;
      return s && new Date(s.expiresAt) > new Date() ? s : null;
    } catch {
      return null;
    }
  }
}
