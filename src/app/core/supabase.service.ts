import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  /** Invoke an Edge Function and unwrap the {error:{code,message}} envelope. */
  async fn<T>(name: string, body: unknown): Promise<T> {
    const { data, error } = await this.client.functions.invoke(name, { body: body as Record<string, unknown> });
    if (error) {
      let payload: any = null;
      try { payload = await (error as any).context?.json?.(); } catch {}
      throw payload?.error ?? { message: error.message };
    }
    return data as T;
  }
}
