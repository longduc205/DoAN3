import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** Blocks routes whose data.permission the user lacks (sitemap: direct URL → 403). The API enforces it too. */
export const permissionGuard: CanActivateFn = (route) => {
  const code = route.data['permission'] as string | undefined;
  return !code || inject(AuthService).hasPermission(code) ? true : inject(Router).createUrlTree(['/403']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
