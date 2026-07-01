# CULTOSOL

CULTOSOL is a Next.js app for soil and foliar lab analysis interpretation.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

`OPENAI_API_KEY` powers the AI document import reader.

## Git

This workspace is already initialized as a Git repository and has this remote:

```bash
origin https://github.com/esanderjacques-a11y/alakay-app.git
```

When Git is installed locally, push with:

```bash
git add .
git commit -m "Update AI import and deployment config"
git push origin main
```

## Vercel

The project includes `vercel.json` for Vercel deployment.

In Vercel:

1. Import the GitHub repository.
2. Select the Next.js framework preset.
3. Add the environment variables listed above.
4. Deploy.

With the Vercel CLI installed:

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add OPENAI_API_KEY
vercel --prod
```
