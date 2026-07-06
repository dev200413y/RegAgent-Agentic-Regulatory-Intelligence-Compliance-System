# RegAgent — Agent Specifications

This document describes each agent in the LangGraph pipeline: its responsibility, inputs/outputs, the model/logic it uses, and why it's designed the way it is.

---

## Agent 1: Monitor Agent

**Responsibility:** Detect that a new circular needs to be processed, regardless of how it arrived.

**Inputs:** File system events (new file in `/circulars/incoming/`) or a direct API call from the upload endpoint.

**Outputs:** A normalized "new circular" event pushed into the LangGraph pipeline, containing file path, source hint (regulator, if known from filename/upload metadata), and ingestion method.

**Implementation notes:**
- Uses Python's `watchdog` library to monitor the drop folder.
- Deduplicates — if a file with the same hash has already been processed, it's skipped (prevents double-processing on restarts).
- In production, this agent would also own the live-scraping logic against RBI/SEBI/IRDAI sites; in the offline prototype, this responsibility is simulated by the folder-watch + manual upload entry points.

---

## Agent 2: Parser Agent

**Responsibility:** Convert raw, unstructured circular text into structured compliance facts.

**Inputs:** Extracted plain text (from PyMuPDF or Tesseract OCR).

**Outputs:** A structured JSON object:
```json
{
  "obligations": ["..."],
  "regulation_reference": "RBI/2026-27/XX",
  "deadline": "2026-08-15",
  "affected_functions": ["Risk", "IT"],
  "summary": "..."
}
```

**Implementation notes:**
- Calls the local Ollama LLM (`llama3.2`) with a carefully constructed prompt that asks specifically for these fields, instructing the model to return **JSON only**.
- A lightweight JSON-repair/parsing step handles cases where the LLM adds stray text around the JSON.
- This is the agent doing genuine natural-language interpretation — circular language varies a lot (legal phrasing, tables, varying section structures), so this can't be done with regex/keyword rules alone. This is the clearest demonstration of "agentic" behavior in the pipeline.
- Long circulars are chunked and summarized before extraction if they exceed the model's comfortable context window, to keep local inference fast.

---

## Agent 3: MAP Generator

**Responsibility:** Turn the Parser Agent's structured obligations into one or more **Measurable Action Points** — concrete, trackable tasks rather than vague summaries.

**Inputs:** Parser Agent's JSON output.

**Outputs:** One or more MAP records:
```json
{
  "title": "Update KYC re-verification SOP per RBI/2026-27/XX",
  "kpi": "100% of flagged accounts re-verified",
  "deadline": "2026-08-15",
  "department": "Operations",
  "evidence_required": "Updated SOP document + sample verification log"
}
```

**Implementation notes:**
- Mostly deterministic templating logic combined with the LLM's extracted fields — this agent does light LLM-assisted phrasing (turning "must ensure X" into an action-oriented title) but the structure itself is rule-based, ensuring MAPs are always consistently formatted regardless of how the original circular was worded.
- If a circular contains multiple distinct obligations affecting different departments, this agent splits them into separate MAPs rather than one large vague task — this is core to the "Measurable" part of MAP.

---

## Agent 4: Assignment Engine

**Responsibility:** Route each MAP to the correct department.

**Inputs:** MAP record (specifically `affected_functions` / keywords from the Parser Agent output).

**Outputs:** MAP record with `department` field finalized and a `assigned_at` timestamp.

**Implementation notes:**
- **Deliberately not LLM-based.** This is a rule-based engine reading from a configurable mapping file (`department_mapping.yaml` or similar), e.g.:
```yaml
KYC: Operations
capital_adequacy: Risk
data_localization: IT
contract_clause: Legal
```
- This determinism is a feature: department assignment needs to be predictable and explainable during an audit — "this MAP was assigned to Risk because the circular referenced capital adequacy" is a clean, defensible answer, vs. relying on an LLM's possibly-inconsistent judgment for routing.
- Extensibility to a new regulator (MCA, PFRDA) means adding new keyword-to-department rows to this config — no code change, exactly as claimed in the pitch.

---

## Agent 5: Validator Agent

**Responsibility:** Autonomously determine whether evidence submitted by a department actually satisfies a MAP's completion criteria.

**Inputs:** The MAP's `evidence_required` description + the submitted evidence document's extracted text/content.

**Outputs:**
```json
{
  "result": "pass" | "fail",
  "reasoning": "The submitted SOP document includes the updated KYC re-verification clause as required, and the attached log shows 100% of flagged accounts verified.",
  "confidence": "high"
}
```

**Implementation notes:**
- Calls the local Ollama LLM with both the MAP's criteria and the evidence content, asking it to judge sufficiency and explain its reasoning — this is the second clear "agentic decision" point in the system, since it replaces a human reviewer's sign-off for routine cases.
- Every validation result, pass or fail, is written to `audit_log` with the full reasoning text retained — so even an autonomous "pass" is traceable and explainable if questioned later by a human auditor or regulator.
- Borderline/low-confidence results are flagged for **human review** rather than auto-passed — the system is designed to escalate uncertainty, not hide it. This matters for the "autonomous but accountable" framing in our pitch.

---

## Why the agent boundaries are drawn this way

We split the system into five agents rather than one big LLM call because:
1. **Each step is independently testable** — we can verify Parser Agent accuracy on a circular without involving Assignment or Validation at all.
2. **It mirrors how a real compliance process is decomposed**, which makes the system explainable to non-technical bank stakeholders (Risk/Legal/IT) who will recognize each step.
3. **It isolates where LLM judgment is used vs. where determinism is required** — critical for a system whose output may eventually be scrutinized by a regulator.
4. **LangGraph's state graph model rewards this decomposition** — each agent is a node with clear inputs/outputs, and the shared state object naturally accumulates the full provenance of a MAP from circular to validation.
