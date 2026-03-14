# Aegis

AI-Powered Fraud Detection & Prevention Platform built with Next.js App Router.

## Modes

- `local`: uses local PostgreSQL directly (no Supabase required)
- `supabase`: uses Supabase Auth + DB

Default is `local` mode.

## Local PostgreSQL setup (first)

1. Use Node.js `>=20.9.0`.
2. Install dependencies:

```bash
npm install
```

3. Create env:

```bash
cp .env.example .env.local
```

4. Start local Postgres (example with Docker):

```bash
docker run --name aegis-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aegis -p 5432:5432 -d postgres:16
```

5. Run schema + seed:

```bash
psql postgres://postgres:postgres@localhost:5432/aegis -f supabase/local-postgres.sql
```

6. Start app:

```bash
npm run dev
```

App runs at `http://localhost:3000`.

## Switch to Supabase later

When you give the command, we will switch `APP_DB_MODE=supabase` and wire your Supabase credentials.

- Run `supabase/schema.sql` in Supabase SQL editor
- Set:
  - `APP_DB_MODE=supabase`
  - `NEXT_PUBLIC_APP_DB_MODE=supabase`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase CLI deploy prep

Supabase CLI is installed globally (`supabase --version`).

Set these in `.env.local` before deploy commands:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

Then run:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

## Product pages

- `/` landing page
- `/login` and `/signup`
- `/app/dashboard`
- `/app/transactions` (full CRUD)
- `/app/cases` (full CRUD)
