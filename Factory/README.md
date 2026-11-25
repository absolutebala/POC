# Production Tower — wireframes (static site)

Plain HTML/JS, no build step. Pages:
index (Plant overview) · orders · order-detail · process-board · shop-floor · quality · capacity · data-sources

## Deploy to Vercel
Option A — CLI (2 minutes)
1. Unzip, open a terminal in this folder.
2. npx vercel        (log in when asked; accept defaults; "Framework: Other")
3. npx vercel --prod (gives the public URL)

Option B — GitHub
1. Push this folder to a new GitHub repo.
2. vercel.com → Add New → Project → Import the repo → Framework preset "Other" → Deploy.

Pages carry a noindex tag so search engines won't list them.
