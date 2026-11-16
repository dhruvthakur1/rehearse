# Rehearse — AI Interview Practice

Rehearse turns your resume into a realistic mock interview. It writes questions about your own projects and
experience, lets you **answer out loud** (speech is transcribed so you can check it), and gives detailed feedback on
every answer using the Gemini API.

> 🚧 In progress — being built in small phases. See [the roadmap](#roadmap).

## Tech stack

| Layer    | Tech                                                         |
| -------- | ------------------------------------------------------------ |
| Frontend | React 18, React Router, Vite, lucide icons                   |
| Backend  | Node.js, Express 5, Mongoose, Zod validation, Helmet, rate limiting |
| Data     | MongoDB                                                      |
| AI       | Gemini API (question generation, transcription, evaluation)  |
| Files    | Multer (in-memory uploads), unpdf (PDF text), mammoth (DOCX text) |
| DevOps   | Docker, GitHub Actions CI                                    |

## How resume upload works

1. The browser checks the file type and size, then uploads it with a progress bar.
2. The API keeps the file in memory only (never on disk), checks the file's real signature bytes so a renamed file
   can't sneak through, and extracts the text with `unpdf` (PDF) or `mammoth` (DOCX).
3. Scanned, image-only PDFs are detected (no text layer) and rejected with a helpful message.
4. Only the extracted text is stored, with detected skills and resume sections. The full text is returned only by
   `GET /api/resumes/:id`, never in lists.

## Roadmap

- [x] **Phase 1** — Project setup, sign-up / sign-in, one-click demo account, app layout
- [x] **Phase 2** — Resume upload (drag and drop, PDF/DOCX), text extraction, skill and section detection
- [x] **Phase 3** — Interview setup and Gemini question generation (with built-in fallback questions)
- [x] **Phase 4** — Mock interview screen: mic check, questions read aloud, voice recording with live waveform, review and re-record
- [x] **Phase 5** — Speech-to-text: live captions while speaking, Gemini transcription of each recording, and an editable transcript to check before saving
- [x] **Phase 6** — Gemini evaluation (4 skills per answer, server-computed scores) and the feedback report with model answers
- [x] **Phase 7** — Live dashboard (scores, trend, skills, streak), interview history with filters and search, and a pre-filled demo account
- [ ] **Phase 8** — Deploy (Render + Vercel + MongoDB Atlas)

## How questions are generated

- The resume text, role, optional company and job description are sent to Gemini with a **JSON response schema**, so
  the model must return structured questions (text, category, topic, the resume item it's based on, and 3 points a
  strong answer covers).
- The output is **validated with Zod**: invalid or duplicate questions are dropped, and if too few remain the request
  is retried once before failing with a clear error.
- The resume and job description are wrapped in tags and the model is told to treat them as data, which guards
  against **prompt injection** from pasted job descriptions.
- Generation is **rate-limited per user** (15 an hour) to protect the API quota, falls back automatically to `gemini-3.5-flash-lite` when the main model is overloaded or slow, and every call has a timeout.
- Without `GEMINI_API_KEY`, the app generates sensible questions from the resume's projects and skills, so local
  development, CI and demos work with no key.

## Run locally

Requires Node.js 20+. Without `MONGODB_URI` the API uses a throwaway in-memory MongoDB, so no setup is needed.

```bash
cd server && npm install && npm run dev     # API on http://localhost:4000
cd client && npm install && npm run dev     # App on http://localhost:5173
cd server && npm test                       # API tests
```
