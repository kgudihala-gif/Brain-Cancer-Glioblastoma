# AfterScan

AfterScan is a responsive brain MRI companion with four pages: Intro, My scan, Resources, and Settings.

## Result and guidance

Choosing one MRI image sends it to Pyxeda using the supplied base64 request flow. After a readable label comes back, the app sends Pyxeda's label, raw score, model name, and message to `/api/guidance`. The MRI image and filename are not sent to OpenAI. The server keeps the OpenAI key in an environment variable and returns a plain-language explanation, practical questions and next steps, and links chosen from an approved resource list. The Walnut Creek cancer center is always included as a local CA‑10 option.

OpenAI guidance runs automatically when `OPENAI_API_KEY` is configured. If OpenAI is unavailable, the Pyxeda result remains visible. Scores are shown as returned and are not described as probabilities.

## Local development

Use Node.js 22.9 or later. If `.env.local` does not exist, copy `.env.example` to it. Add your OpenAI key to `.env.local`, then restart the dev server:

```sh
npm run dev
```

Open the local address printed in the terminal. The server serves both the source app and `/dist/`, and runs the same-origin `/api/guidance` route. Keep `.env.local` private; it is ignored by Git. Do not paste an API key into Settings, client code, or chat.

For a serverless deployment, deploy the repository root so the host includes `api/guidance.js`; add `OPENAI_API_KEY` and, optionally, `OPENAI_MODEL` as server-side environment variables. Publishing `dist/` as a static-only site does not include the OpenAI route.

## Resources and privacy

The Resources page links to NCI appointment guidance, Cancer Support Community San Francisco Bay Area in Walnut Creek, the UCSF–John Muir Health Cancer Center in Walnut Creek, the UCSF Brain Tumor Center, and Brain Tumor Network. Treatment resources are options to discuss with a clinician, not personalized referrals.

AfterScan does not save the scan or result. Before using an image, make sure it is authorized for sharing with Pyxeda. Configure provider-side rate limits and spending alerts before enabling OpenAI for a public audience.
