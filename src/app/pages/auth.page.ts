import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { friendlyError } from '../core/errors';
import { safeReturnUrl } from '../core/guards';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
  <div class="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
    <section class="relative overflow-hidden border-b-2 lg:border-b-0 lg:border-r-2 border-ink bg-sun px-6 sm:px-10 py-8 lg:py-12 flex flex-col justify-between gap-10">
      <div class="flex items-center justify-between">
        <span class="display text-4xl">V<span class="text-teal-ink">spark</span></span>
        <span class="meta !text-ink">Caption &amp; schedule studio</span>
      </div>
      <div>
        <h1 class="display text-[clamp(3.4rem,11vw,8.5rem)]">Write it.<br/>Pick it.<br/><span class="text-teal-ink">Ship it.</span></h1>
        <ol class="mt-8 grid sm:grid-cols-3 border-2 border-ink bg-paper">
          <li class="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-ink"><div class="display-md text-lg">Gemini drafts</div><p class="text-sm text-ink-2 mt-1">Three captions with hashtags from one line.</p></li>
          <li class="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-ink"><div class="display-md text-lg">Drive keeps</div><p class="text-sm text-ink-2 mt-1">Every draft synced to your Google Drive.</p></li>
          <li class="p-4"><div class="display-md text-lg">Email reminds</div><p class="text-sm text-ink-2 mt-1">A nudge before each post goes out.</p></li>
        </ol>
      </div>
    </section>
    <div class="grid place-items-center px-4 sm:px-6 py-10">
      <form [formGroup]="form" (ngSubmit)="submit()" class="panel plate w-full max-w-md p-6 sm:p-8 space-y-5" novalidate>
        <div>
          <h2 class="display text-5xl">{{ mode === 'login' ? 'Sign in' : 'Join' }}</h2>
          <p class="text-sm text-ink-2 mt-2">{{ mode === 'login' ? 'Back to your desk.' : 'Make an account to start drafting and scheduling.' }}</p>
        </div>
        @if (mode === 'register') {
          <div><label class="label" for="n">Full name</label><input id="n" class="input" formControlName="fullName" autocomplete="name" [attr.aria-invalid]="form.controls.fullName.touched && form.controls.fullName.invalid" />
            @if (form.controls.fullName.touched && form.controls.fullName.invalid) { <p class="err">Enter your name, at least 2 characters.</p> }</div>
        }
        <div><label class="label" for="e">Email</label><input id="e" class="input" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid" />
          @if (form.controls.email.touched && form.controls.email.invalid) { <p class="err">Enter a valid email address.</p> }</div>
        <div><label class="label" for="p">Password</label><input id="p" class="input" type="password" formControlName="password" [attr.autocomplete]="mode === 'login' ? 'current-password' : 'new-password'" [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid" />
          @if (form.controls.password.touched && form.controls.password.invalid) { <p class="err">Use at least 8 characters.</p> }</div>
        @if (error()) { <div class="border-2 border-red bg-red-wash text-red text-sm font-semibold p-3" role="alert">{{ error() }}</div> }
        <button class="btn-primary w-full !min-h-12 text-base" [disabled]="busy()">{{ busy() ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account' }}</button>
        <p class="text-sm text-ink-2">
          @if (mode === 'login') { New here? <a routerLink="/register" class="font-bold text-ink underline decoration-2 decoration-teal">Create an account</a> }
          @else { Already have one? <a routerLink="/login" class="font-bold text-ink underline decoration-2 decoration-teal">Sign in</a> }
        </p>
      </form>
    </div>
  </div>`,
})
export class AuthPage {
  private route = inject(ActivatedRoute); private router = inject(Router);
  private auth = inject(AuthService); private toast = inject(ToastService);
  mode: 'login' | 'register' = this.route.snapshot.data['mode'];
  busy = signal(false); error = signal('');
  form = inject(FormBuilder).nonNullable.group({
    fullName: ['', this.mode === 'register' ? [Validators.required, Validators.minLength(2)] : []],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    const { email, password, fullName } = this.form.getRawValue();
    try {
      if (this.mode === 'login') await this.auth.signIn(email, password);
      else if (!(await this.auth.signUp(email, password, fullName))) {
        this.toast.show('Check your inbox to confirm your email, then sign in.', 'info');
        this.router.navigateByUrl('/login'); return;
      }
      this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } catch (e) { this.error.set(friendlyError(e)); } finally { this.busy.set(false); }
  }
}
