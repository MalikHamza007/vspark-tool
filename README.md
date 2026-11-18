<div align="center">

# VSPARK

**Write it. Pick it. Ship it.**
An AI caption studio and post scheduler for content creators.

Live: **https://vspark.learn2earntech.com**

</div>

---

## What it does

You describe a post in one line. **Google Gemini** writes three captions with hashtags. You pick one and set a time. VSpark then:

1. saves the post to the database,
2. syncs a copy to a **VSpark Drafts** folder in your **Google Drive**,
3. **emails you** when the post is scheduled and again before it goes out.

Everything you've drafted is listed on one **run sheet**, where you can edit, delete, re-sync and preview attachments.

## Features

| # | Brief requirement | How VSpark covers it |
|---|---|---|
| 1 | **AI Caption Generator** | The *Write* page sends prompt, platform and tone to a Supabase Edge Function. The function calls **Gemini 2.5 Flash** with a JSON response schema and returns **3 captions with hashtags**. Includes copy-to-clipboard, prompt ideas, a 24 h cache with offline fallback, and loading, empty and error/retry states. |
| 2 | **Google Drive storage & scheduler** | Pick a proof, then set a title, caption, hashtags, date/time, task notes and an optional attachment. The post is saved to Postgres and written as a JSON file to your Drive. Edits update that file and deletes remove it. Access uses the `drive.file` scope, so the app only sees files it created. |
| 3 | **Feed / list preview** | The *Run sheet* has search, status filters and a platform filter, all kept in the URL. Each post can be edited, deleted, re-synced to Drive or emailed now. Private attachments (image / PDF / text / CSV) open inside the app through 60-second signed links. |
| 4 | **Email notifications & customization** | The *Alerts* page sets: on/off, email on schedule, reminder on/off, lead time, timezone, and subject/body templates with placeholders and a live preview. Each post also has its own email toggle and task notes. `pg_cron` runs every minute and sends reminders through Resend. Every email is logged. |
| 5 | **Deployment** | A static Angular build for **Hostinger** (`.htaccess` included). `vercel.json` is included too. |

**Extras:** a role-aware dashboard ("Next out" time, counts, a 7-day / per-platform chart with table toggle and click-through), an admin console (all creators, posts and email log), and row-level security on every table.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | Angular 21 (standalone components, signals, zoneless), Tailwind CSS 4, reactive forms |
| Auth & data | Supabase Auth (email/password), Postgres with RLS |
| Files | Supabase Storage, private bucket `vs-post-media` |
| Server logic | Supabase Edge Functions (Deno): `vs-generate-captions`, `vs-notify`, `vs-dispatch-reminders` |
| Scheduling | `pg_cron` + `pg_net`, every minute |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Drive | Google Identity Services + Drive REST v3 |
| Email | Resend |
| Hosting | Hostinger (static) / Vercel |

## Architecture

```
Browser (Angular)
 ├── Supabase Auth ──────────────── sessions, roles (vs_profiles)
 ├── Postgres + RLS ─────────────── vs_posts, vs_notification_settings, vs_notification_log
 ├── Storage (private) ──────────── vs-post-media/{userId}/{uuid}/{file}
 ├── Edge Function vs-generate-captions ──► Gemini API (key stays server-side)
 ├── Edge Function vs-notify ─────────────► Resend email
 └── Google Drive API (OAuth in browser, drive.file scope)

pg_cron (1 min) ──► Edge Function vs-dispatch-reminders ──► Resend
```

## Project structure

```
src/app/
  core/       auth, roles & permissions, guards, posts/storage service, Drive service, models
  shared/     shell (masthead + nav), post form, media preview, icons, page header
  pages/      auth, dashboard, studio (write), posts (run sheet), settings (alerts), admin
supabase/
  migrations/ schema, RLS, storage policies, scheduler
  functions/  vs-generate-captions, vs-notify, vs-dispatch-reminders, _shared/
public/.htaccess   SPA rewrite + HTTPS for Hostinger
```

## Security

- **Roles:** `creator` (default) and `admin`, mapped to permissions in `core/roles.ts`. `authGuard`, `guestGuard` and a data-driven `roleGuard` protect routes, and nav items are hidden by permission.
- **RLS on every table:** creators can only read and write their own rows; admins can read everything. Profiles have **no UPDATE policy**, so nobody can promote themselves.
- **Secrets stay on the server:** the Gemini and Resend keys are Supabase secrets, and the functions verify the user's JWT. The cron function checks a random secret stored in a table no client role can read.
- **Storage:** private bucket, per-user folder policies, 60-second signed URLs. If saving the post fails, the uploaded file is deleted.

## Run locally

```bash
npm ci
npm start                 # http://localhost:4200
```

Public client config (Supabase URL, publishable key, Google client ID) is in `src/environments/environment.ts`.

## Backend setup

The schema and functions are already deployed to Supabase project `tayonxytmisuhbiqimhm`. To set up a new project:

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy vs-generate-captions vs-notify --use-api
supabase functions deploy vs-dispatch-reminders --no-verify-jwt --use-api
supabase secrets set GEMINI_API_KEY=... RESEND_API_KEY=... EMAIL_FROM="VSpark <onboarding@resend.dev>"
```

Then in **Auth → URL configuration**, set the Site URL to `https://vspark.learn2earntech.com` and add it as a redirect URL.

**Google Drive:** in Google Cloud Console, enable the Drive API and set up the OAuth consent screen. Create an OAuth client ID of type **Web** with these JS origins: `https://vspark.learn2earntech.com` and `http://localhost:4200`. Paste the ID into `googleClientId`.

**Make an admin:**
```sql
update public.vs_profiles set role = 'admin' where email = 'you@example.com';
```

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Supabase secret | Gemini caption generation |
| `GEMINI_MODEL` | Supabase secret (optional) | defaults to `gemini-2.5-flash` |
| `RESEND_API_KEY` | Supabase secret | sending email |
| `EMAIL_FROM` | Supabase secret (optional) | sender address |
| `supabaseUrl`, `supabaseKey` | `environment.ts` | public Supabase config (publishable key) |
| `googleClientId` | `environment.ts` | Google OAuth web client |

See `.env.example`.

## Deploy to Hostinger

```bash
npm run build
```
Upload **everything inside** `dist/captionflow/browser/`, including the hidden `.htaccess`, to the subdomain's `public_html` folder in hPanel's File Manager. The `.htaccess` sends refreshed deep links (such as `/posts`) back to the app and forces HTTPS.

## Demo script (3 minutes)

1. **Register.** You land on the Desk: "Next out", counts and the load chart.
2. **Write.** Enter "Launching our new cold brew with oat milk this Friday", choose Instagram and witty, then generate three proofs.
3. **Pick proof 2** (it gets a *Picked* stamp). Set a time 20 minutes out, attach a photo, tick *Sync to Google Drive*, then **Schedule**.
4. **Run sheet.** The post shows *In Drive* and *Email on*. Open the attachment preview, edit the caption, delete an old draft.
5. **Alerts.** Change the subject template and set the lead time to 15 minutes; the preview updates live. Email activity shows the confirmation.
6. **Admin** (admin account): all creators, posts and the email log.

## Known limitations

- Posting to social networks is simulated: at the scheduled time the post becomes *published* and a reminder email is sent.
- Resend's shared sender only delivers to the Resend account owner until you verify a domain.
- While the Google OAuth app is in *Testing* mode, only listed test users can connect Drive.

## License

MIT
