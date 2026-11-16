# Deploying Rehearse (free tier, ~20 minutes)

Same setup as GymFuel: **GitHub** → **Render** (API, Docker) → **Vercel** (frontend), with **MongoDB Atlas** and the
**Gemini API**. You can reuse your existing Atlas cluster and Render / Vercel accounts.

You'll need: your Atlas connection string, your Gemini API key, the Render URL and the Vercel URL.

---

## 1. Push the code to GitHub

1. Create an empty **public** repository named `rehearse` at https://github.com/new (no README, .gitignore or licence).
2. From the `rehearse` folder:
   ```bash
   git remote add origin https://github.com/<your-username>/rehearse.git
   git push -u origin main
   ```
3. The **Actions** tab should go green: API tests, client build and Docker build.

## 2. MongoDB Atlas (reuse your cluster)

Use the same connection string as GymFuel but with a **different database name**, so the two apps never share data:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/rehearse?retryWrites=true&w=majority&appName=rehearse
```

Network Access already allows `0.0.0.0/0` from the GymFuel setup.

## 3. Render (API)

1. https://dashboard.render.com → **New → Blueprint** → pick the `rehearse` repo. Render reads `render.yaml`.
2. Fill in:
   | Key | Value |
   | --- | --- |
   | `MONGODB_URI` | the string from step 2 (database `rehearse`) |
   | `CLIENT_URL` | `http://localhost:5173` for now — updated in step 5 |
   | `GEMINI_API_KEY` | your key from https://aistudio.google.com/apikey |

   `JWT_SECRET` is generated for you; the Gemini model names are preset.
3. Wait for the deploy and open `https://<your-service>.onrender.com/api/health` → `{"status":"ok","db":"connected"}`.

Nothing needs seeding: the demo account and its example interviews are created on the first **Try the demo** click.

## 4. Vercel (frontend)

1. https://vercel.com → **Add New → Project** → import `rehearse`.
2. **Root Directory:** `client` (Vite is detected automatically).
3. Environment variable `VITE_API_URL` = `https://<your-service>.onrender.com` (no trailing slash).
4. Deploy and copy the URL, e.g. `https://rehearse-yourname.vercel.app`.

## 5. Connect them

In **Render → rehearse-api → Environment**, set `CLIENT_URL` to your Vercel URL (https, no trailing slash) and save.

## 6. Test it

1. Open the Vercel URL → **Try the demo** → the dashboard shows three example interviews.
2. **New interview** → generate questions (about 10–30 seconds with Gemini).
3. Start it, allow the microphone, answer a question, check the transcript, finish → the report appears in ~30 seconds.

The microphone only works on **https** pages, which Vercel provides.

## 7. Keep it awake

Render's free tier sleeps after 15 minutes. Add an UptimeRobot monitor for
`https://<your-service>.onrender.com/api/health` every 5 minutes, like GymFuel.

---

### Troubleshooting

- **"The AI model … isn't available for this API key"** — Google retired that model for new keys. Set `GEMINI_MODEL`
  / `GEMINI_FALLBACK_MODEL` on Render to models listed for your key in Google AI Studio.
- **"The AI service is busy"** — the main model is overloaded; the app already falls back to the lighter one. Try again.
- **Feedback stuck on "Analysing"** — if Render restarted mid-analysis, the report shows **Try again** after 3 minutes.
- **CORS errors** — `CLIENT_URL` on Render must exactly match the Vercel URL.
- **Microphone blocked** — the user must allow it from the icon next to the address bar.
