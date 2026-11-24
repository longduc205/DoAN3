import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TargetFormPage } from './target-form.page';

describe('TargetFormPage (new target)', () => {
  let fixture: ComponentFixture<TargetFormPage>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const submit = () => {
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
  };
  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TargetFormPage, TranslocoTestingModule.forRoot({ langs: { vi: {} }, translocoConfig: { availableLangs: ['vi'], defaultLang: 'vi' } })],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TargetFormPage);
    fixture.componentRef.setInput('id', 'p1');
    fixture.detectChanges();
    http.expectOne('/api/projects/get-by-id').flush({ success: true, data: { id: 'p1', name: 'Shop' } });
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('blocks an invalid form: shows errors and sends nothing', () => {
    type('#t-url', 'not a url');
    submit();
    expect(el.querySelector('.field-error')).not.toBeNull(); // name required
    expect(el.querySelector('#t-url')!.getAttribute('aria-invalid')).toBe('true');
    http.expectNone('/api/targets/create');
  });

  it('disables save while saving, then shows the API error and stays on the page', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    type('#t-name', 'Lab');
    type('#t-url', 'http://shop.lab.local');
    submit();

    const req = http.expectOne('/api/targets/create');
    expect(req.request.body).toMatchObject({ projectId: 'p1', name: 'Lab', baseUrl: 'http://shop.lab.local', isAuthorized: false });
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);

    req.flush({ success: false, code: 'VALIDATION_ERROR', message: 'errors.invalidUrl' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('errors.invalidUrl');
    expect(el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes back to the project after a successful save', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    type('#t-name', 'Lab');
    type('#t-url', 'http://shop.lab.local');
    submit();
    http.expectOne('/api/targets/create').flush({ success: true, data: { id: 't1' } });
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p1']);
  });
});
