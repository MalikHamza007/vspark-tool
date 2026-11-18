import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './roles';

export const authGuard: CanActivateFn = async (_r, state) => {
  const auth = inject(AuthService); const router = inject(Router);
  await auth.whenReady();
  return auth.session() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService); const router = inject(Router);
  await auth.whenReady();
  return auth.session() ? router.createUrlTree(['/']) : true;
};
export const roleGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService); const router = inject(Router);
  await auth.whenReady();
  if (!auth.profile()) await auth.loadProfile();
  const roles = (route.data?.['roles'] ?? []) as Role[];
  return roles.includes(auth.role() as Role) ? true : router.createUrlTree(['/']);
};
export function safeReturnUrl(u: string | null): string {
  return u && u.startsWith('/') && !u.startsWith('//') ? u : '/';
}
