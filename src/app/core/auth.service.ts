import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Profile, toCamel } from './models';
import { can, Permission } from './roles';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SupabaseService).client;
  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly ready = signal(false);
  readonly role = computed(() => this.profile()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  private initP: Promise<void>;

  constructor() {
    this.initP = this.init();
    this.sb.auth.onAuthStateChange((_e, s) => {
      this.session.set(s);
      if (s) this.loadProfile(); else this.profile.set(null);
    });
  }
  whenReady() { return this.initP; }
  private async init() {
    const { data } = await this.sb.auth.getSession();
    this.session.set(data.session);
    if (data.session) await this.loadProfile();
    this.ready.set(true);
  }
  async loadProfile() {
    const uid = this.session()?.user.id;
    if (!uid) return;
    const { data } = await this.sb.from('vs_profiles').select('*').eq('id', uid).maybeSingle();
    this.profile.set(data ? toCamel<Profile>(data) : null);
  }
  can(p: Permission) { return can(this.role(), p); }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.loadProfile();
  }
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await this.sb.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: location.origin || environment.siteUrl },
    });
    if (error) throw error;
    if (data.session) await this.loadProfile();
    return !!data.session;
  }
  async signOut() { await this.sb.auth.signOut(); this.profile.set(null); }
}
