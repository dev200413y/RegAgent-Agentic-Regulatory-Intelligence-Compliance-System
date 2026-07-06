# RegAgent — System Architecture

## 1. High-Level Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   ENTRY POINTS (no internet) │
                         │                              │
                         │  ① Folder-drop watcher        │
                         │  ② Dashboard manual upload    │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │      INGESTION LAYER         │
                         │  PyMuPDF (text PDFs)         │
                         │  Tesseract OCR (scans/images)│
                         └──────────────┬───────────────┘
                                        │ raw extracted text
                                        ▼
                         ┌─────────────────────────────┐
                         │     LANGGRAPH PIPELINE       │
                         │                              │
                         │  Monitor Agent               │
                         │       │                      │
                         │       ▼                      │
                         │  Parser Agent (Ollama LLM)   │
                         │       │                      │
                         │       ▼                      │
                         │  MAP Generator                │
                         │       │                      │
                         │       ▼                      │
                         │  Assignment Engine            │
                         │       │                      │
                         │       ▼                      │
                         │  [stored in PostgreSQL]       │
                         │       │                      │
                         │       ▼                      │
                         │  Validator Agent (Ollama LLM) │
                         │   (triggered on evidence      │
                         │    submission)                │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │      PERSISTENCE LAYER       │
                         │   SQLite — MAPs,             │
                         │   department mappings,       │
                         │   audit log (every state     │
                         │   transition timestamped)    │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │      FASTAPI BACKEND         │
                         │   REST endpoints for:        │
                         │   upload, MAP list, MAP      │
                         │   detail, evidence submit,   │
                         │   audit trail                │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │     REACT DASHBOARD          │
                         │   Upload UI, MAP board,      │
                         │   department views,          │
                         │   audit trail viewer          │
                         └─────────────────────────────┘

         All of the above runs via separate local processes on a single
         host machine — zero outbound network calls at runtime.
```

---

## 2. Design Principles

### 2.1 Air-gapped by construction, not by configuration
Every component that could plausibly require a network call (LLM inference, embeddings, OCR) was deliberately chosen because it has a **local-only execution mode**. There is no "offline switch" to flip — there is simply no code path in the running system that reaches the internet. This was a constraint of the brief, but it also reflects how a real bank's infosec team would want such a system deployed in production: **on-premise, within the bank's own network perimeter.**

### 2.2 One pipeline, two doors
Both ingestion entry points (folder-watch and dashboard upload) write into the same drop location and trigger the identical LangGraph pipeline. This avoids duplicated business logic and means anything we test via one entry point is implicitly tested for the other.

### 2.3 Stateful graph, not a script
LangGraph models the pipeline as an explicit state machine rather than a linear script. Each agent reads and writes to a shared state object. This makes every transition inspectable and loggable — important for an audit-trail-driven compliance product — and makes it straightforward to later add conditional branches (e.g., "if deadline < 7 days, escalate immediately" without restructuring the whole pipeline).

### 2.4 LLM does interpretation, rules do routing
We deliberately split responsibilities:
- **LLM (Ollama)** is used where judgment/interpretation of natural language is genuinely required — extracting obligations from circular text, and assessing whether evidence satisfies a MAP's criteria.
- **Deterministic rules** (a department/keyword config) handle department assignment, because this needs to be predictable, fast, and explainable to an auditor — not subject to LLM variance.

This hybrid approach keeps the system fast, cheaper to run, and easier to defend during a regulatory audit ("why was this MAP assigned to Legal?" has a deterministic, inspectable answer).

### 2.5 Config-driven extensibility
Department-routing rules and regulator-specific parsing hints live in external config files, not hardcoded logic. Adding a new regulator (MCA, PFRDA) is a configuration change, not a code change — a key claim in our pitch.

---

## 3. Data Model (SQLite — core tables)

```
circulars
  id, source_regulator, filename, ingested_at, raw_text, ingestion_method

maps
  id, circular_id, title, kpi, deadline, department,
  evidence_required, status (pending/in_review/validated/failed),
  created_at

evidence_submissions
  id, map_id, filename, submitted_by, submitted_at

validation_results
  id, evidence_id, map_id, result (pass/fail), reasoning, validated_at

audit_log
  id, entity_type, entity_id, action, actor, timestamp, details
```

Every state transition — circular ingested, MAP created, MAP assigned, evidence submitted, validation result — writes a row to `audit_log`. This is what makes the dashboard's "audit trail" view regulator-ready rather than just a status tracker.

---

## 4. Deployment Topology (prototype)

```
regagent/
 ├── database (SQLite regagent.db, no external exposure)
 ├── backend (FastAPI, run via uvicorn)
 ├── frontend (React, served via Vite dev server)
 └── [Ollama runs as a separate local host process,
      backend connects via http://localhost:11434]
```

All four components run on a single machine for the demo. The architecture has no inherent reason it couldn't be split across containers/VMs within a bank's internal network for production — but for the prototype, single-host simplicity makes the offline demo easier to run and verify live.

---

## 5. Production Evolution Path (beyond this prototype)

| Prototype (this submission) | Production (future) |
|---|---|
| Folder-drop simulates monitoring | Live scraper agents watch RBI/SEBI/IRDAI sites + gazette feeds |
| Single local Ollama instance | Possibly a larger self-hosted model on bank GPU infra, still on-premise |
| Single-host Docker Compose | Kubernetes deployment across bank's internal infrastructure |
| Manual evidence upload | Integration with existing document management / DMS systems |
| Single bank's department config | Multi-tenant config per bank/NBFC, deployable as a SaaS-like internal product |
