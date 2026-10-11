# Wattwise · WTQ-2026

**Utility Bill Decoder** for the Women Tech Quest 2026 Build Track.
Wattwise reads a Pakistani electricity bill (K-Electric, LESCO or IESCO) from a scan, screenshot or photo,
pulls out every detail, and answers questions about it in plain English.

| | |
|---|---|
| **Live demo** | _add your Vercel link here_ |
| **Built by** | Mukadus Jawaid |
| **Model** | Claude Haiku 4.5 (`claude-haiku-4-5`), Anthropic API key |
| **Runtime** | Node.js 22 or later (developed on Node 24) |

## What it does
- **Level 1, Extract:** one structured result per bill: provider, tariff, dates, meter readings, units,
  every charge and tax line, totals, arrears and the payable amounts. Anything not printed or unreadable is
  `null`, never guessed.
- **Level 2, Explain:** answers customer questions using only what is on the bill. Every figure is either
  read from the bill or calculated in code, and estimates are labelled.
- **Wattwise app:** upload a bill and see the result, chat with the bill, or upload many bills plus the supplied
  question file and download both `level1.csv` and `level2.csv`.
- **Command line:** fills the two competition CSVs for a whole folder of bills.

## Why the app is designed this way
Before writing code I mapped the challenge into two lanes, one per level, because each is scored
separately and fails in different ways.



**Level 1 lane (extract).** The bill image goes to the vision model with strict rules (values as printed,
`null` if unreadable, no personal identifiers). The output is validated in code against a schema, then shown in
the app and written to `level1.csv`. The "hard cases" box is the reason the model reads the image directly:
tilted photos, Urdu labels and grey boxes defeat template or OCR approaches, and prebuilt invoice extractors
are not allowed.

**Level 2 lane (explain).** The 12 questions come from `level2.csv`. Anything that is arithmetic (tax share,
averages, summer vs winter, trends, "what if") is calculated in code from that bill's own numbers and handed to the
model as facts; the model writes the English answer from the image plus those facts. Pre-prompts enforce the
rules: only the bill, label estimates, say so when a value is missing, always English.

Both lanes end the same way: the result is displayed and written to a CSV by code, never edited by hand.

## Quick start
```bash
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# open .env and put your Anthropic API key in API_KEY
npm run dev                 # http://localhost:3000
```

`.env.example` contains exactly the three variables the code reads:
```env
MODEL_PROVIDER=anthropic
MODEL_NAME=claude-haiku-4-5
API_KEY=your-api-key-here
```
Only Claude Haiku 4.5 is accepted; any other value stops the app with a clear message.

## Generate the competition CSVs
Put the bill images in `test/bills/` (file name = `bill_id`, e.g. `KESC_0002.png`) and the two supplied
templates in `test/csv/` (`level1.csv`, `level2.csv`), then run:

```bash
npm run generate -- --bills test/bills --templates test/csv --out output
```

This writes `output/level1.csv` (one JSON object per bill, on one line) and `output/level2.csv` (one English
answer per question). Both files are produced by the code and the model, with a CSV library handling quoting.
Nothing is typed or edited by hand. If a bill fails after three attempts it is reported, and:

```bash
npm run generate -- --resume     # retry only the bills that failed, reuse the finished ones
```

## Build the submission ZIP
```bash
npm run package                                   # builds submission/wattwise-submission.zip
npm run package -- -Demo C:\path\to\demo.mp4      # optional demo video (max 3 minutes)
```
The ZIP contains `output/` (both CSVs), `source/` (this project without `node_modules`, `.next`, `.git`
and `.env`) and an optional `demo/`. The script refuses to run if a CSV is missing or has an empty cell, scans for
anything that looks like an API key, and reports the size (limit 15 MB). Windows PowerShell is required for this script.

## How the numbers are checked
1. **Reading:** the bill is sent as the full image plus overlapping, upscaled sections so small print stays
   legible. Small photos are enlarged and EXIF rotation is respected.
2. **Cross-checks in code:** charge lines against the printed charges subtotal, tax lines against the printed taxes
   subtotal, charges + taxes against the current bill, meter readings against units. If something does not add up
   the model gets one re-read with the exact mismatch.
3. **Late-payment amounts:** the model lists every amount payable after the due date and code takes the highest.
4. **Level 2 figures:** tax share, late surcharge, cost per unit, highest month, same month last year, summer vs
   winter, payment check, 3-month direction, next-month estimates, spreading the cost and "same units as last
   month" are computed in code (`src/lib/bill/facts.ts`, `src/lib/bill/trends.ts`).
5. **Answer formulas:** the model proposes an arithmetic expression; the app evaluates it with its own parser
   (no `eval`) and re-asks the model once if the result does not match the answer text.

These checks catch inconsistent readings. They cannot prove a misread that is consistent on both sides. The
rules from the guide are encoded as tests (`npm test`).

## Using the app
1. **Upload:** drop a K-Electric, LESCO or IESCO bill (PNG/JPG, up to 10 MB). Any other document is rejected.
2. **Extract:** amount to pay, charges and taxes line by line, readings and dates, and whether the lines add up.
3. **Ask:** a chat about the bill. Answers are tagged _From the bill_, _Calculated_, _Estimate_ or
   _Not on this bill_.
4. **Batch run:** the competition flow in the browser. The supplied `test/csv/level1.csv` and `level2.csv` are
   preselected automatically (the 12 questions and the row order). Press **Generate output**: the supplied bills in `test/bills` are read, each bill's questions are answered,
   then download the new `level1.csv` and `level2.csv`. Optionally upload your own CSVs or bills; they replace the
   preselected ones (the file name is the bill id, e.g. `KESC_0002.png`).
   Each bill is read, then its questions are answered by the model; the files are written by a CSV library in the
   template's row order.

## Deploying (Vercel)
- Set `MODEL_PROVIDER`, `MODEL_NAME` and `API_KEY` in the Vercel project's environment variables
  (`.env` is not deployed).
- The model routes declare `maxDuration = 60`; large images are shrunk in the browser to stay under the
  4.5 MB request limit.
- The command-line batch (`npm run generate`) reads and writes local files, so run it on your own machine.

## Data and privacy
- Uploaded images are processed in memory and sent to the Anthropic API; the server does not keep them.
- Names, addresses, CNIC and account, reference, consumer and meter numbers are never extracted.
- The browser stores only the chosen theme. The decoded bill and chat live in memory and disappear on refresh.
- The command-line batch writes `output/` and per-bill checkpoints in `output/.work/` (git-ignored).

## Project structure
```
src/
  app/                  Next.js App Router: layout, page, API routes (analyze, ask, answers)
  components/
    layout/ ui/         header, step navigation, theme, toast, buttons, cards, mascot, icons
    home/ upload/       landing page and the single-bill upload
    extract/ ask/       result screen and the chat
    batch/ processing/  many-bill upload and the "reading your bill" overlay
  hooks/                use-ask, use-bulk-upload, use-count-up, use-sample-bill
  store/                app state (zustand) and the decode controller
  lib/
    ai.ts               the only code that talks to a model
    bill/               schema, prompts, pipeline, image prep, facts and trends
    batch/              the batch engine behind `npm run generate`
    calc.ts format.ts   safe arithmetic evaluator, display helpers
  styles/               design system: colors.css, typography.css and one file per area
scripts/                generate.ts (batch CLI), package.ps1 (submission ZIP)
tests/                  unit tests
docs/                   requirements diagram and its editable source
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build and server |
| `npm run generate` | fill `level1.csv` and `level2.csv` (see above) |
| `npm run package` | build the submission ZIP |
| `npm test` | unit tests |
| `npm run lint` | ESLint |

## Quality
Lighthouse on the production build: Performance 96 (mobile) / 100 (desktop), Accessibility 100,
Best Practices 100, SEO 100.

## AI usage
- **Models:** Claude Haiku 4.5 (`claude-haiku-4-5`).
- **APIs:** Anthropic API (Messages API with image input), called through the Vercel AI SDK.
- **Services:** none beyond the Anthropic API. No OCR or document-extraction service is used.
- **AI tools used to write the code:** Claude Code (Anthropic).
- **Frameworks and libraries:** Next.js, React, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Zod, sharp, csv-parse,
  csv-stringify, zustand, Vitest.

See [`GUIDELINES.md`](GUIDELINES.md) for the competition rules this project follows.
