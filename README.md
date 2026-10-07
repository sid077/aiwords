# AI Words (aiwords.si)

Static site charting how many words AI models generate per day since ChatGPT (Nov 2022), compared with total human word output, plus the AI share of new web articles.

## Files

- `index.html` – page layout and styles
- `app.js` – loads `data.json` and draws the charts (Chart.js from cdnjs)
- `data.json` – every data point, with its unit and source link. **This is the only file the weekly update edits.**
- `CNAME` – your custom domain for GitHub Pages

## Adding a data point

Append to the right series in `data.json`:

```json
{"date": "2026-11-12", "value": 4.1e15, "unit": "tokens/month", "source": "https://..."}
```

Supported units: `words/day`, `tokens/day`, `tokens/minute`, `tokens/week`, `tokens/month`. The page converts to words/day at `wordsPerToken` (0.75). Update `lastChecked` on every check, even when nothing new was found.

## Deploying on GitHub Pages with a .si domain

1. Repo → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
2. Settings → Pages → Custom domain: enter your domain (same as in `CNAME`), then tick *Enforce HTTPS* once the certificate is issued.
3. At your .si registrar's DNS panel:
   - Apex domain (e.g. `example.si`): four `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (optionally `AAAA` to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`).
   - Plus `www` as a `CNAME` to `<your-github-username>.github.io`.
   - Subdomain only (e.g. `ai.example.si`): one `CNAME` to `<your-github-username>.github.io`.
4. DNS can take from minutes to a few hours to propagate.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 (opening `index.html` directly won't load `data.json`).
