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
| DevOps   | Docker, GitHub Actions CI                                    |

## Roadmap

- [x] **Phase 1** — Project setup, sign-up / sign-in, one-click demo account, app layout
- [ ] **Phase 2** — Resume upload and text extraction (PDF, DOCX)
- [ ] **Phase 3** — Interview setup and Gemini question generation
- [ ] **Phase 4** — Mock interview screen with voice recording
- [ ] **Phase 5** — Speech-to-text and transcript review
- [ ] **Phase 6** — Gemini answer evaluation and feedback report
- [ ] **Phase 7** — Dashboard stats and interview history
- [ ] **Phase 8** — Deploy (Render + Vercel + MongoDB Atlas)

## Run locally

Requires Node.js 20+. Without `MONGODB_URI` the API uses a throwaway in-memory MongoDB, so no setup is needed.

```bash
cd server && npm install && npm run dev     # API on http://localhost:4000
cd client && npm install && npm run dev     # App on http://localhost:5173
cd server && npm test                       # API tests
```
