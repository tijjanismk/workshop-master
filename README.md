# The Workshop Master

Multilingual, safety-aware diagnostic assistant for workshops, with web and Telegram channels.

## Durable Telegram memory with Supabase

1. Create a Supabase project.
2. In **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql).
3. In **Project Settings → API**, copy the project URL and the server-only `service_role` key.
4. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables, then redeploy.

When those variables are absent, local development uses SQLite. On Vercel, SQLite uses temporary `/tmp` storage and is not durable across instances.

Never place the Supabase service-role key in a `NEXT_PUBLIC_` variable, browser code, Git, or a Telegram message.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
