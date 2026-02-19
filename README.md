# Earnings Signal

AI-powered earnings call sentiment analysis. Paste transcripts, use mic, or upload files — analyzed by Claude against analyst consensus in real time.

## Deploy on CodeSandbox

### Option A — Import from ZIP (fastest)
1. Go to https://codesandbox.io/dashboard
2. Click **Create Sandbox → Import project → Upload ZIP**
3. Upload `earnings-signal.zip`
4. In the sidebar, go to **Env Variables** and add:
   - Key: `ANTHROPIC_API_KEY`  Value: `sk-ant-...`
5. The server starts automatically — click the preview URL

### Option B — Import from GitHub
1. Push this folder to a GitHub repo
2. Go to https://codesandbox.io → **Import from GitHub**
3. Paste your repo URL
4. Add `ANTHROPIC_API_KEY` in the Environment Variables panel

## Local Development
```bash
cp .env.example .env        # add your API key
npm install
npm start                   # runs on http://localhost:3000
```

## How it works
- **Backend**: Express server proxies requests to Anthropic API (avoids CORS)
- **Frontend**: Single HTML file served statically, calls `/api/analyze`
- **Fallback**: If API key missing or call fails, uses local rule-based NLP engine
- **Status indicator**: Shows "● CLAUDE AI" or "● LOCAL NLP" in header

## Project Structure
```
earnings-signal/
├── server.js          # Express backend + Anthropic proxy
├── public/
│   └── index.html     # Complete frontend (React via CDN)
├── package.json
└── .env               # Add your ANTHROPIC_API_KEY here
```
