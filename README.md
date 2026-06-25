# RegAgent — Agentic Regulatory Intelligence & Compliance System

> **SuRaksha Cyber Hackathon 2.0 (Canara Bank) — Submission**
> Theme: Agentic Regulatory Intelligence & Compliance
> Status: Prototype (Offline / Air-Gapped Build)

---

## 1. Problem Statement

Indian banks receive **100+ regulatory circulars every year** from RBI, SEBI, and IRDAI. Today, compliance teams manually read, interpret, and route these updates to the right internal department. This process:

- Takes **3–7 days** per circular
- Is **error-prone** (manual interpretation of legal/regulatory language)
- Risks **penalties of ₹1 Crore+** per non-compliance incident
- Has **no end-to-end automation** — monitoring, interpretation, assignment, and validation are all disconnected manual steps

There is no existing system that handles the **full compliance lifecycle autonomously**, from "a new circular was published" to "we have verified evidence that every department complied."

---

## 2. Our Idea — RegAgent

RegAgent is a **multi-agent AI system** built on LangGraph that takes a regulatory circular (PDF, scanned document, or image) and autonomously carries it through the entire compliance lifecycle:

1. **Ingests** the circular (upload or folder-drop)
2. **Parses** it to extract obligations, deadlines, and affected functions
3. **Generates Measurable Action Points (MAPs)** — not vague to-dos, but structured tasks with KPIs, deadlines, owners, and **5 critical business dimensions**: Assignee Role, Estimated Effort, Risk Category, Regulatory Fine Potential, and Budget Required.
4. **Assigns** each MAP to the correct bank department (Risk, Legal, IT, Operations)
5. **Validates** completion by checking submitted evidence against the MAP's criteria — autonomously, without manual sign-off for routine cases
6. **Logs everything** in an audit trail that is regulator-ready

The system features a **state-of-the-art Glassmorphism Dark Mode UI** that includes a Live Agentic Pipeline Visualizer, a MAP Kanban Board, a Live Penalty Exposure Ticker, and an AI Chat Copilot to query regulations on the fly.

The result: what used to take **3–7 days of manual work** now takes **under 5 minutes per circular**, with a complete, defensible audit trail.

### Why this matters for a bank specifically
Compliance failures aren't just slow — they're **expensive and reputational**. RegAgent doesn't just speed up the process, it makes it **consistent and auditable**, which is exactly what a regulator wants to see during an inspection.

---

## 3. The Critical Constraint: Fully Offline / No External LLM APIs

Per the Round 2 evaluation conditions, the prototype **cannot call any external LLM API** and must run **without internet access**. This shaped our entire technical approach — and we leaned into it as a feature, not a limitation:

> **A compliance system that never sends a bank's regulatory and operational data outside its own infrastructure is inherently more trustworthy to a bank's risk and security teams than one that depends on a third-party cloud LLM.**

Every component below — LLM inference, embeddings, OCR, storage — runs **entirely on local hardware**, with zero outbound network calls during operation.

---

## 4. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Multi-agent orchestration | **LangGraph** | Defines and runs the agent pipeline as a stateful graph |
| LLM inference | **Ollama** (`mistral:7b` / `phi3:mini`, run locally) | Parses circulars, validates evidence — zero cloud calls |
| Embeddings / semantic search | **sentence-transformers** (local model) + **FAISS** | Optional RAG over historical circulars, fully offline |
| Document ingestion | **PyMuPDF (fitz)**, **pdf2image**, **Tesseract OCR** | Extracts text from clean PDFs and scanned/image circulars |
| Backend API | **FastAPI** | REST endpoints for upload, MAPs, evidence, dashboard data |
| Database | **PostgreSQL** (local Docker container) | Stores MAPs, department mappings, audit logs |
| Frontend | **React** | Compliance dashboard — MAP status, department progress, audit trail |
| File watching | **watchdog** (Python) | Detects new circulars dropped into a monitored folder |
| Deployment | **Docker Compose** | One-command local spin-up — no cloud infra required for the prototype |
| CI/CD (future/production) | **GitHub Actions** | Automated build/test pipeline for a production rollout |

---

## 5. How a Circular Gets Into the System

We support **two entry points feeding the same pipeline** — this matters because real compliance teams work both ways:

1. **Folder-drop (simulated monitoring)** — a file placed into `/circulars/incoming/` is auto-detected and processed. In a production version with internet access, this folder would instead be populated automatically by a live scraper watching RBI/SEBI/IRDAI websites.
2. **Manual upload (dashboard)** — a compliance officer uploads a PDF or image directly through the React dashboard, exactly how they'd attach an emailed circular today.

Both paths converge into the same ingestion → parsing → MAP generation → assignment → validation pipeline. No duplicated logic, two ways in.

---

## 6. Data Strategy (per submission conditions)

Since live internet scraping is disallowed for the prototype, we built our test dataset manually, as permitted:

- **15–20 real RBI/SEBI/IRDAI circulars**, downloaded in advance and used as realistic input documents
- **4–5 self-edited circulars** (dates, clauses, deadlines altered) to test edge cases and parsing robustness
- **Self-created evidence documents** — a mix of compliant and intentionally incomplete submissions — to properly exercise the Validator Agent's pass/fail logic

This lets us demonstrate the full lifecycle with realistic regulatory language without depending on live internet access during the demo.

---

## 7. Quick Start (local, offline)

```bash
# 1. Pull the local LLM once (requires internet only this one time)
ollama pull mistral:7b

# 2. Start everything locally — Postgres, FastAPI, React, all in containers
docker-compose up --build

# 3. Confirm Ollama is serving locally
ollama list

# 4. Open the dashboard (running on Vite locally)
http://localhost:5173

# 5. Drop a circular into the watched folder, or upload via the dashboard
cp sample-circulars/rbi_circular_01.pdf ./circulars/incoming/
```

To prove offline operation during a live demo: disconnect from the network entirely (`ping` should fail), then run the same steps — the system works unaffected because all inference happens locally via Ollama.

---

## 8. What Makes This "Truly Agentic" (not just a rule-based pipeline)

- Agents **interpret unstructured regulatory language** (not keyword matching) to extract obligations
- The **Validator Agent makes an autonomous pass/fail judgment** with reasoning, rather than requiring a human reviewer for routine cases
- The system is **config-driven for new regulators** — adding MCA or PFRDA requires updating a department/keyword mapping, not rewriting code
- Each agent is a discrete, inspectable node in a LangGraph state machine — decisions are traceable, not a black box

See `AGENTS.md` for a detailed breakdown of each agent's responsibilities and design, `ARCHITECTURE.md` for system structure, and `SECURITY.md` for the security/data-handling model.

---

## 9. Impact

- Cuts regulatory review time from **3–7 days to under 5 minutes** per circular
- Removes the risk of **missed deadlines** that lead to ₹1 Crore+ penalties
- Produces a **complete, regulator-ready audit trail** automatically
- Scales to **any Indian bank, NBFC, or fintech**
- Extensible to **new regulators** (MCA, PFRDA, etc.) via configuration, not code changes
- Runs entirely **on-premise**, so no regulatory or financial data ever leaves bank infrastructure

---

## 10. Project Structure

```
regagent/
├── agents/                  # LangGraph agent definitions (see AGENTS.md)
│   ├── monitor_agent.py
│   ├── parser_agent.py
│   ├── map_generator.py
│   ├── assignment_engine.py
│   └── validator_agent.py
├── ingestion/                # PDF/OCR extraction
│   ├── pdf_extractor.py
│   └── ocr_extractor.py
├── backend/                  # FastAPI app
│   ├── main.py
│   ├── routes/
│   └── db/
├── frontend/                  # React dashboard
├── circulars/
│   ├── incoming/              # folder-watch drop zone
│   └── sample-circulars/      # test dataset
├── evidence/                  # uploaded evidence documents
├── docker-compose.yml
├── README.md
├── ARCHITECTURE.md
├── AGENTS.md
└── SECURITY.md
```
