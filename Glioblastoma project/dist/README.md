# AfterScan static page

This folder contains the four-page responsive interface. The same-origin `/api/guidance` function lives in the project root under `api/`; a static-only host cannot provide OpenAI guidance. Deploy the project root or use `npm run dev` so the server-side route is available.

After a successful Pyxeda response, only the returned model label, raw score, model name, and message are sent to the OpenAI route. The MRI and filename are not sent. The key belongs in `.env.local` or the hosting provider's server-side environment settings, never in this folder or browser storage.
