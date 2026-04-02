# RivalScope

RivalScope is an AdTech competitor analysis tool that uses Google Gemini AI + dual web search (Brave + Serper.dev) to generate structured, data-driven competitor analyses for the programmatic advertising ecosystem. It stores all history locally in SQLite, supports scheduled recurring analysis, and emails results via SendGrid.

## Prerequisites

- Node.js 18+
- API keys for: Gemini, Brave Search, Serper.dev, SendGrid (optional for email)

## Setup

```bash
git clone <your-repo-url>
cd rivalscope
cp backend/.env.example backend/.env
# Fill in your API keys in backend/.env
npm install
cd frontend && npm install && cd ..
npm run dev
```

Open http://localhost:5173

## API Keys

| Service | Where to get it |
|---|---|
| Gemini | https://aistudio.google.com/app/apikey |
| Brave Search | https://brave.com/search/api/ |
| Serper.dev | https://serper.dev/ |
| SendGrid | https://app.sendgrid.com/settings/api_keys |

You can also configure keys via the Settings modal in the app (saved in SQLite, never in .env at runtime).

## How Scheduling Works

1. Open any analysis result → click "Schedule This"
2. Set a label, frequency, and email address
3. RivalScope will re-run the analysis on your schedule and email results with change highlights

## Email Configuration

Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL either in backend/.env or via the Settings modal.
