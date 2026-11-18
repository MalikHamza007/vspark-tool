# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Content creators who need to draft social captions and plan posts quickly (inferred from the hackathon brief; user's only stated requirement: "it should look good"). Also evaluated live by hackathon judges in a short demo.

## Product Purpose
Turn a one-line idea into 2–3 ready captions with hashtags (Google Gemini), pick one, schedule it, keep the draft synced to Google Drive, and get email notifications before it goes out — without a multi-tool setup.

## Positioning
One small studio that covers idea → caption → schedule → Drive copy → email reminder in a single page flow.

## Capabilities and Constraints
- Angular 21 + Tailwind 4, Supabase (auth, Postgres RLS, private storage, Edge Functions, pg_cron), static hosting on Hostinger subdomain vspark.learn2earntech.com.
- Roles: creator, admin. Pages: sign in/up, dashboard, Caption Studio, Scheduled Feed, Notifications settings, Admin.
- Posting to social networks is mocked; scheduling = reminder email + status change.

## Brand Commitments
Name "VSpark". No other visual constraints (user: "your call").

## Evidence on Hand
No testimonials, customers or metrics exist; do not fabricate any.

## Product Principles
1. The caption is the hero — the writing surface gets the room.
2. Time is always explicit: every post shows when it goes out.
3. Fast to demo: each core action is one obvious step from the dashboard.
