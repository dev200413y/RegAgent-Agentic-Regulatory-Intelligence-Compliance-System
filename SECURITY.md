# RegAgent — Security & Data Handling

## 1. Core Security Principle

RegAgent is designed around one non-negotiable rule, driven directly by the hackathon's evaluation condition but also reflecting how a real bank would actually want this deployed:

> **No regulatory data, internal compliance evidence, or department information ever leaves the host machine / bank's internal network.**

There is no external API call, no cloud LLM, no telemetry, and no third-party SDK that phones home, anywhere in the runtime path. This is true by construction (see `ARCHITECTURE.md` §2.1), not by a configuration toggle that could be misconfigured or accidentally re-enabled.

---

## 2. Threat Model — What We're Protecting Against

| Risk | How RegAgent Addresses It |
|---|---|
| Sensitive circular/evidence data leaking to a third-party LLM provider | All LLM inference (Ollama) runs locally; no network egress during inference |
| Man-in-the-middle exposure of regulatory data in transit to cloud APIs | No such transit exists — everything is `localhost` / internal local network |
| Vendor lock-in / dependency on external API uptime or pricing changes | Self-hosted model, no external dependency at runtime |
| Tampering with audit trail records | Every MAP/evidence/validation event is append-only logged with timestamps in `audit_log`; no update/delete path exposed via the API for historical entries |
| Unauthorized access to the dashboard | (Prototype: single-user demo. Production note below covers RBAC.) |
| Malicious or malformed uploaded files (PDF/image) | File type validation on upload; OCR/PDF parsing run in a bounded, isolated process; size limits enforced on upload endpoint |

---

## 3. Data Flow & Storage

- **Circulars**: stored as files on local disk (`/circulars/`) + extracted text stored in SQLite. No copy of this data is sent anywhere else.
- **Evidence documents**: same pattern — local disk + DB reference, never transmitted externally.
- **LLM prompts/responses**: constructed and consumed entirely within the host process calling `localhost:11434` (Ollama's local API port). This is not a public-facing port and is not exposed outside the local host environment.
- **Database**: SQLite runs as a local file with no external port mapping exposed.

---

## 4. Verifying "No Internet" During the Live Demo

Because this is an evaluation condition, not just a design claim, we built the demo script specifically to **prove** it live:

1. Disconnect the host machine from WiFi/Ethernet entirely.
2. Run `ping 8.8.8.8` (or similar) on camera — show it failing.
3. Run the full circular → MAP → evidence → validation cycle with the network still disconnected.
4. Optionally, show the local network configuration and the FastAPI backend code to confirm no service has external network access configured.

This is the single most convincing thing we can show a judge — not a slide claiming "offline capable," but a live, disconnected machine doing real work.

---

## 5. Authentication & Access Control

**Prototype scope:** single-user local demo — no multi-user auth implemented, since the focus of Round 2 is the agentic pipeline and offline operation, not enterprise IAM.

**Production roadmap (stated honestly, not implemented in prototype):**
- Role-based access control — department users should only see/act on MAPs assigned to their own department; only Compliance/Admin roles should see the full cross-department dashboard.
- Integration with the bank's existing SSO/Active Directory rather than a standalone auth system.
- Evidence upload restricted to authenticated users from the owning department, with the uploader's identity recorded in `audit_log`.

We're flagging this explicitly rather than glossing over it — a hackathon prototype reasonably scopes this out, but a judge asking "what about access control?" deserves a direct, honest answer rather than a deflection.

---

## 6. Input Validation & Robustness

- Uploaded files are restricted by type (PDF, PNG, JPG) and size at the FastAPI endpoint before any processing begins.
- OCR/PDF extraction failures (corrupted file, unreadable scan) are caught and surfaced as a clear error state on the MAP/circular record rather than silently failing or crashing the pipeline.
- LLM outputs from the Parser and Validator agents are validated against an expected JSON schema before being written to the database; malformed LLM output triggers a retry with a stricter prompt rather than being trusted blindly.

---

## 7. Audit Trail as a Security Feature, Not Just a Compliance Feature

Every action in the system — ingestion, MAP creation, assignment, evidence submission, validation result — is logged immutably with a timestamp and actor. This serves two purposes simultaneously:
1. **Regulatory defensibility** — if asked, the bank can produce a complete, ordered history of how a circular was handled.
2. **Security forensics** — if something in the pipeline behaves unexpectedly, the audit log is the first place to trace what happened and why, including the LLM's stated reasoning for any validation decision.

---

## 8. Honest Limitations (Prototype Scope)

We'd rather state these directly than have a judge find them unprompted:

- No multi-user authentication in this build (see §5).
- No encryption-at-rest configured for the local SQLite database file in the prototype (straightforward to add via standard SQLite encryption / SQLCipher for production).
- Local LLM (`llama3.2`) is smaller and less capable than a frontier cloud model — extraction accuracy on unusually complex circular language may need human spot-checking in early production rollout, with confidence-based escalation (see `AGENTS.md` §Validator Agent) as the mitigation built into the design.
- Single-host deployment in the demo is intentionally simple; a real bank rollout would need a proper internal network deployment plan (see `ARCHITECTURE.md` §5).
