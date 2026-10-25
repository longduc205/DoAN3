import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { authGuard } from './guards/auth.guard';
import { authInterceptor } from './interceptors/auth.interceptor';

describe('auth guard + interceptor', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', children: [] }]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('redirects to /login when logged out', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result instanceof UrlTree && TestBed.inject(Router).serializeUrl(result)).toBe('/login');
  });

  it('stores the session on login and sends the bearer token on API calls', () => {
    const auth = TestBed.inject(AuthService);
    auth.login('analyst', 'pw').subscribe();
    http.expectOne('/api/auth/login').flush({
      success: true,
      data: { accessToken: 'tkn', expiresAt: new Date(Date.now() + 60_000).toISOString(), user: { id: '1', userName: 'analyst', email: '', fullName: '', roles: [], permissions: [] } },
    });
    expect(auth.isLoggedIn()).toBe(true);
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(true);

    TestBed.inject(HttpClient).post('/api/projects/get-all', {}).subscribe();
    expect(http.expectOne('/api/projects/get-all').request.headers.get('Authorization')).toBe('Bearer tkn');
  });

  it('logs out on 401', () => {
    const auth = TestBed.inject(AuthService);
    sessionStorage.setItem('websec.session', JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 60_000).toISOString(), user: {} }));
    TestBed.inject(HttpClient).post('/api/projects/get-all', {}).subscribe({ error: () => undefined });
    http.expectOne('/api/projects/get-all').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isLoggedIn()).toBe(false);
  });
});
