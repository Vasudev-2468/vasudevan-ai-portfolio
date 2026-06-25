# Vasudevan.ai — Portfolio Platform

A futuristic, 3D-animated personal AI portfolio for **Vasudevan Sundaramurthy** —
PhD scholar in Mathematics with Data Science, computer vision researcher, and
full-stack ML builder.

> "Vasudevan AI — Research, Innovation, and Intelligent Systems."

The platform boots end-to-end with Docker Compose. It ships with your real
resume seeded into Postgres, a vector-RAG assistant powered by Anthropic
Claude + Qdrant + fastembed, a Bruno-Simon-style 3D entry at `/explore`, and a
working **Portfolio Manager Agent** at `/admin` that ingests uploaded
documents and proposes structured updates for human review.

---

## Stack

| Layer         | Tech                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| Frontend      | Next.js 15 · React 19 · TypeScript · Tailwind · Framer Motion          |
| 3D            | Three.js · React Three Fiber v9 · @react-three/drei                    |
| Backend       | FastAPI · async SQLAlchemy 2 · Pydantic v2                             |
| Data          | PostgreSQL 15 · Redis 7 · Qdrant (vector DB)                           |
| ML            | Anthropic Claude (Haiku 4.5 chat · Sonnet 4.6 agent) · fastembed (bge) |
| Orchestration | Docker Compose                                                         |

---

## Quick start

```bash
cp .env.example .env
# (optional) paste an ANTHROPIC_API_KEY into .env to enable the LLM paths
# (required) change ADMIN_TOKEN to something private

docker compose up --build
```

- **Frontend** — <http://localhost:4000>
- **3D entry** — <http://localhost:4000/explore>
- **Admin** — <http://localhost:4000/admin>
- **Backend OpenAPI** — <http://localhost:4100/docs>
- **Qdrant** — <http://localhost:6333/dashboard>

On first boot the backend:
1. Creates tables, seeds the resume content
2. Builds the Qdrant index from all DB rows via the local fastembed model
   (no external API call needed)

If `ANTHROPIC_API_KEY` is set, the assistant chat uses Claude on top of
retrieved chunks. If it's not, the assistant falls back to a deterministic
keyword retriever over the same content — both paths return identical JSON.

---

## Three entry points

### 1. Classic site — `/`
Display-typography hero with a 3D R3F neural network, animated sections for
About, Experience, Research (with an orbiting publications scene), Projects
(mouse-tilt cards), Skills (animated bars), AI Assistant, Contact. Custom
cursor, scroll-progress bar, grain overlay, marquee strips between sections.

### 2. Explorable 3D — `/explore`
Bruno-Simon-style entry. A 3D space with floating clickable portal cards
(About / Work / Research / Projects / Skills / AI / Contact) orbiting a
wireframe core, with starfield + sparkles + wireframe ground plane. Drag to
orbit, scroll to zoom, click a portal to jump to the corresponding section.

### 3. Admin control room — `/admin`
Sign in with `ADMIN_TOKEN`. From there:
- **Drop a PDF** — resume, certificate, paper, project brief
- The **Portfolio Manager Agent** runs in the background:
  1. Extracts text with pypdf
  2. Indexes the chunks into Qdrant under `Upload · <filename>`
  3. Calls Claude Sonnet 4.6 with a strict-JSON extractor prompt
  4. Writes one `PendingDiff` per candidate update (create / update against
     publications / projects / experience / education / certifications / skills)
- **Review pending diffs** — see the structured payload, the evidence quote
  from the document, and a confidence score. Approve to apply to the live
  portfolio; reject to discard.
- **Reindex** — rebuild the vector store from the SQL tables.

---

## API surface

| Route                                  | Auth | Purpose                                |
| -------------------------------------- | ---- | -------------------------------------- |
| `GET  /health`                         | —    | LLM availability + health              |
| `GET  /api/profile`                    | —    | profile + contact + links              |
| `GET  /api/profile/education`          | —    | education entries                      |
| `GET  /api/profile/certifications`     | —    | certifications & awards                |
| `GET  /api/experience`                 | —    | work history                           |
| `GET  /api/skills`                     | —    | skills with proficiency                |
| `GET  /api/projects`                   | —    | projects with achievements + stack     |
| `GET  /api/publications?kind=`         | —    | journal / conference / patent          |
| `POST /api/assistant/chat`             | —    | RAG answer (LLM if key set, else keyword) |
| `GET  /api/admin/stats`                | bearer | dashboard counters + vector chunks   |
| `POST /api/admin/uploads`              | bearer | PDF upload → spawns agent task        |
| `GET  /api/admin/uploads`              | bearer | recent uploads                        |
| `GET  /api/admin/tasks`                | bearer | agent task feed                       |
| `GET  /api/admin/diffs?status_filter=` | bearer | pending / approved / rejected diffs   |
| `POST /api/admin/diffs/{id}/approve`   | bearer | apply diff to portfolio               |
| `POST /api/admin/diffs/{id}/reject`    | bearer | discard diff                          |
| `POST /api/admin/reindex`              | bearer | rebuild Qdrant from SQL               |

---

## How RAG works here

1. **Embedding** — `fastembed` runs `BAAI/bge-small-en-v1.5` locally (384-dim).
   No external embedding API.
2. **Index** — Qdrant `vasudevan-knowledge` collection, cosine distance.
3. **First boot** — `ingest_portfolio()` walks every row in
   `profile / experience / education / project / publication / certification`
   and writes chunked, labelled entries.
4. **Upload path** — admin upload → PDF text → chunked → upserted under
   `Upload · <filename>`.
5. **Query** — embed the question, top-6 cosine match, drop hits below 0.18.
6. **Generation** — Claude Haiku 4.5 with the cached `ASSISTANT_SYSTEM`
   prompt and the retrieved chunks as grounding. The model is forced to cite
   labels in a `Sources:` line.
7. **Fallback** — if Anthropic is disabled OR Qdrant is empty, returns a
   keyword-retrieval bullet list (still source-grounded).

---

## How the Portfolio Manager Agent works

`backend/app/services/agents/portfolio_manager.py`

1. Background task picks up an `AgentTask` row with `agent="portfolio_manager"`
2. Reads the uploaded PDF, indexes chunks into Qdrant
3. Calls Claude Sonnet 4.6 with `EXTRACTOR_SYSTEM` (strict JSON schema)
4. For each candidate, creates a `PendingDiff` (never mutates the user-facing
   tables directly)
5. Admin reviews and either:
   - **Approve** — `apply_diff` inserts/updates the target table
   - **Reject** — diff is marked rejected, no side effects

This is the template for the other five agents (Resume / Research / GitHub /
Content / Verification). Each new agent is a new module under
`backend/app/services/agents/`, a string identifier on `AgentTask.agent`, and
a button in the admin UI.

---

## Local dev (without Docker)

Backend (uses SQLite, no Anthropic, no Qdrant):
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install --legacy-peer-deps
copy .env.example .env.local
npm run dev
```

---

## Roadmap

Five more agents to add following the Portfolio Manager template:

| Agent              | Source signal                          | Confidence checks                       |
| ------------------ | -------------------------------------- | --------------------------------------- |
| Research Agent     | Google Scholar / Scopus polling        | DOI verification, dedup vs `publication` |
| GitHub Agent       | GraphQL: repos, stars, languages       | repo ownership, last-push freshness     |
| Content Agent      | Claude generation from latest activity | grounded against indexed body of work   |
| Verification Agent | Cross-cutting gatekeeper               | source check, dedup, confidence floor   |
| Resume Agent       | Combines profile + filters             | role-specific resume PDFs               |

Production hardening:
- Replace bearer-token admin with NextAuth + GitHub OAuth
- Move background tasks to a Celery / Arq worker once the queue grows
- Helm chart per service, GitHub Actions → GHCR → ArgoCD
- Add a 6th column to publications: `verified_by`, written by the
  Verification Agent before any insert

---

## Folder layout

```
.
├── backend/app/
│   ├── main.py
│   ├── config.py
│   ├── database.py · models.py · schemas.py
│   ├── data/seed.py                    # real resume content
│   ├── routers/
│   │   ├── profile · experience · skills · projects · publications
│   │   ├── assistant.py                # /chat (vector + LLM + keyword)
│   │   └── admin.py                    # bearer-protected control plane
│   └── services/
│       ├── vector.py                   # AsyncQdrantClient + fastembed
│       ├── llm.py                      # Anthropic + prompt caching
│       ├── ingest.py                   # PDF + SQL → chunks → embeddings
│       ├── assistant.py                # RAG pipeline with fallback
│       └── agents/
│           └── portfolio_manager.py    # 1st of 6 agents
│
├── frontend/src/
│   ├── app/
│   │   ├── page.tsx                    # /
│   │   ├── explore/page.tsx            # /explore — 3D entry
│   │   └── admin/page.tsx              # /admin — control room
│   ├── components/
│   │   ├── NeuralScene.tsx · PaperOrbit.tsx · ExploreScene.tsx
│   │   ├── Hero · NavBar · Section · Cursor · ScrollProgress · Marquee
│   │   ├── About · ExperienceTimeline · Publications · Projects · Skills
│   │   ├── Assistant · Contact · TiltCard
│   └── lib/{api,admin,fallback}.ts
│
├── docker-compose.yml · .env.example · README.md
```
