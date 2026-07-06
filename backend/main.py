from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os
import shutil
import datetime

from db.database import engine, get_db
from db import models
from agents.workflow import app as langgraph_app
from agents.validator_agent import validate_evidence
from fastapi.staticfiles import StaticFiles

# Create database tables
models.Base.metadata.create_all(bind=engine)

def seed_employees():
    db = next(get_db())
    if db.query(models.Employee).count() == 0:
        print("Seeding default employees...")
        defaults = [
            models.Employee(name="Chief Information Security Officer (CISO)", department="IT", level="Head", email="ciso@bank.local"),
            models.Employee(name="Chief Risk Officer (CRO)", department="Risk", level="Head", email="cro@bank.local"),
            models.Employee(name="Chief Compliance Officer (CCO)", department="Compliance", level="Head", email="cco@bank.local"),
            models.Employee(name="Head of Legal", department="Legal", level="Head", email="legal@bank.local"),
            models.Employee(name="Head of Operations", department="Operations", level="Head", email="ops@bank.local")
        ]
        db.add_all(defaults)
        db.commit()
    db.close()

seed_employees()

app = FastAPI(title="RegAgent API", description="Agentic Regulatory Intelligence API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CIRCULARS_DIR = os.path.join(BASE_DIR, "..", "circulars", "incoming")
os.makedirs(CIRCULARS_DIR, exist_ok=True)
app.mount("/files", StaticFiles(directory=CIRCULARS_DIR), name="files")

# Add CORS so React frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("../circulars/incoming", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
os.makedirs("working_docs", exist_ok=True)

class HealthResponse(BaseModel):
    status: str
    message: str

@app.get("/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "message": "RegAgent Backend is running"}

# ═══════════════════════════════════════════════════════════════
#  TEAM / EMPLOYEE MANAGEMENT
# ═══════════════════════════════════════════════════════════════

class EmployeeCreate(BaseModel):
    name: str
    department: str
    level: str
    email: str

class EmployeeResponse(EmployeeCreate):
    id: int
    class Config:
        orm_mode = True

@app.post("/employees", response_model=EmployeeResponse)
def create_employee(emp: EmployeeCreate, db: Session = Depends(get_db)):
    db_emp = models.Employee(**emp.dict())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp

@app.get("/employees", response_model=list[EmployeeResponse])
def get_employees(department: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Employee)
    if department:
        query = query.filter(models.Employee.department == department)
    return query.all()

class AssignMapRequest(BaseModel):
    assignee_id: int | None = None
    custom_role: str | None = None

@app.put("/maps/{map_id}/assign")
def assign_map(map_id: int, req: AssignMapRequest, db: Session = Depends(get_db)):
    map_item = db.query(models.MapItem).filter(models.MapItem.id == map_id).first()
    if not map_item:
        raise HTTPException(status_code=404, detail="Map not found")
    
    if req.assignee_id:
        emp = db.query(models.Employee).filter(models.Employee.id == req.assignee_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        map_item.assignee_id = emp.id
        map_item.assignee_role = f"{emp.name} ({emp.level})"
    elif req.custom_role:
        map_item.assignee_id = None
        map_item.assignee_role = req.custom_role
    else:
        raise HTTPException(status_code=400, detail="Must provide assignee_id or custom_role")
    
    # Audit log the assignment
    audit = models.AuditLog(
        map_id=map_id,
        action="Map Assigned",
        result="Success",
        reasoning=f"Task manually assigned to {map_item.assignee_role}"
    )
    db.add(audit)
    db.commit()
    db.refresh(map_item)
    return {"status": "success", "assignee_id": map_item.assignee_id, "assignee_role": map_item.assignee_role}

# ═══════════════════════════════════════════════════════════════
#  CIRCULAR UPLOAD & PROCESSING (with Gap Analysis integration)
# ═══════════════════════════════════════════════════════════════

@app.post("/upload")
async def upload_circular(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Receives a file upload, saves it, and adds it to DB for processing."""
    file_location = f"../circulars/incoming/{file.filename}"
    
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    existing_circular = db.query(models.Circular).filter(models.Circular.filename == file.filename).first()
    if existing_circular:
        new_circular = existing_circular
        new_circular.status = "Uploaded"
        db.commit()
        db.refresh(new_circular)
    else:
        new_circular = models.Circular(filename=file.filename, status="Uploaded")
        db.add(new_circular)
        db.commit()
        db.refresh(new_circular)
    
    return {"status": "success", "circular_id": new_circular.id, "filename": file.filename, "filepath": file_location}

class ProcessRequest(BaseModel):
    filepath: str
    circular_id: int

@app.post("/process")
def process_circular(request: ProcessRequest, db: Session = Depends(get_db)):
    """Triggers the LangGraph pipeline AND runs Gap Analysis against Knowledge Base."""
    circular = db.query(models.Circular).filter(models.Circular.id == request.circular_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
        
    circular.status = "Processing"
    db.commit()
    
    initial_state = {
        "filename": request.filepath,
        "extracted_text": "",
        "obligations": [],
        "regulation_reference": "",
        "deadline": "",
        "affected_functions": [],
        "summary": "",
        "priority": "Medium",
        "penalty_risk": "None",
        "maps": [],
        "current_step": "init",
        "errors": []
    }
    
    print(f"Starting processing for: {request.filepath}")
    final_state = langgraph_app.invoke(initial_state)
    
    # Save parsed results
    circular.extracted_text = final_state.get("extracted_text")
    circular.summary = final_state.get("summary")
    circular.priority = final_state.get("priority", "Medium")
    circular.penalty_risk = final_state.get("penalty_risk", "None")
    circular.status = "Parsed"
    db.commit()
    
    # ── Gap Analysis against Knowledge Base ──
    obligations = final_state.get("obligations", [])
    affected_functions = final_state.get("affected_functions", [])
    
    # Fetch relevant working documents (match by department if possible)
    all_working_docs = db.query(models.WorkingDocument).all()
    relevant_docs = []
    for doc in all_working_docs:
        # Include docs whose department matches any affected function, or include all if no match
        if not affected_functions or doc.department in affected_functions or doc.department.lower() in [f.lower() for f in affected_functions]:
            relevant_docs.append({
                "id": doc.id,
                "title": doc.title,
                "department": doc.department,
                "category": doc.category,
                "content": doc.content[:500] if doc.content else "",
                "ai_summary": doc.ai_summary or ""
            })
    
    gap_results = []
    if obligations and len(obligations) > 0:
        try:
            from agents.gap_analyzer import run_gap_analysis
            gap_results = run_gap_analysis(obligations, relevant_docs)
            print(f"Gap Analysis completed: {len(gap_results)} results")
        except Exception as e:
            print(f"Gap Analysis failed: {e}")
    
    # Save MAPs — but tag them with gap analysis status
    generated_maps = final_state.get("maps", [])
    saved_maps = []
    for i, m in enumerate(generated_maps):
        # Try to match this MAP to a gap result
        gap_status = "NEW_REQUIREMENT"
        matched_doc = "None"
        gap_detail = ""
        if i < len(gap_results):
            gap_status = gap_results[i].get("status", "NEW_REQUIREMENT")
            matched_doc = gap_results[i].get("matched_document", "None")
            gap_detail = gap_results[i].get("gap_detail", "")
        
        new_map = models.MapItem(
            circular_id=circular.id,
            title=m.get("title", ""),
            kpi=m.get("kpi", ""),
            deadline=m.get("deadline", ""),
            department=m.get("department", "Unassigned"),
            evidence_required=m.get("evidence_required", ""),
            status="Already_Compliant" if gap_status == "ALREADY_COMPLIANT" else "Pending",
            priority=final_state.get("priority", "Medium"),
            assignee_role=m.get("assignee_role", "Compliance Team"),
            estimated_effort_hours=str(m.get("estimated_effort_hours", "TBD")),
            risk_category=m.get("risk_category", "Operational"),
            regulatory_fine_potential=m.get("regulatory_fine_potential", "Unknown"),
            budget_required=str(m.get("budget_required", "No")),
            gap_status=gap_status,
            matched_document=matched_doc,
            gap_detail=gap_detail
        )
        db.add(new_map)
        db.commit()
        db.refresh(new_map)
        
        map_data = {
            **m,
            "id": new_map.id,
            "gap_status": gap_status,
            "matched_document": matched_doc,
            "gap_detail": gap_detail
        }
        saved_maps.append(map_data)
    
    db.commit()
    
    return {
        "status": "success",
        "regulation": final_state.get("regulation_reference"),
        "summary": final_state.get("summary"),
        "priority": final_state.get("priority", "Medium"),
        "penalty_risk": final_state.get("penalty_risk", "Unknown"),
        "generated_maps": saved_maps,
        "gap_analysis": gap_results,
        "knowledge_base_docs_matched": len(relevant_docs)
    }

# ═══════════════════════════════════════════════════════════════
#  KNOWLEDGE BASE (Working Documents)
# ═══════════════════════════════════════════════════════════════

@app.get("/working-docs")
def list_working_docs(db: Session = Depends(get_db)):
    """Returns all working documents in the Knowledge Base."""
    docs = db.query(models.WorkingDocument).order_by(models.WorkingDocument.uploaded_at.desc()).all()
    return [{
        "id": d.id,
        "title": d.title,
        "department": d.department,
        "category": d.category,
        "ai_summary": d.ai_summary or "No summary generated yet.",
        "uploaded_at": str(d.uploaded_at),
        "file_path": d.file_path
    } for d in docs]

@app.post("/working-docs")
async def upload_working_doc(
    title: str = Form(...),
    department: str = Form(...),
    category: str = Form("Policy"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a bank policy/SOP/evidence document to the Knowledge Base."""
    file_location = f"working_docs/{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Extract text
    from agents.pdf_extractor import extract_text
    content = extract_text(file_location)
    
    # Generate AI summary
    ai_summary = ""
    try:
        from agents.parser_agent import get_llm
        from langchain_core.prompts import PromptTemplate
        llm = get_llm()
        summary_prompt = PromptTemplate.from_template(
            "Summarize this bank document in 2-3 sentences. Focus on what compliance requirements it addresses:\n\n{text}\n\nSummary:"
        )
        chain = summary_prompt | llm
        ai_summary = chain.invoke({"text": content[:3000]})
    except Exception as e:
        ai_summary = content[:300] + "..."
        print(f"Summary generation failed: {e}")
    
    new_doc = models.WorkingDocument(
        title=title,
        department=department,
        category=category,
        content=content,
        ai_summary=ai_summary,
        file_path=file_location
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    return {
        "status": "success",
        "id": new_doc.id,
        "title": new_doc.title,
        "ai_summary": ai_summary
    }

@app.get("/working-docs/{doc_id}")
def get_working_doc(doc_id: int, db: Session = Depends(get_db)):
    """Get a specific working document with full details."""
    doc = db.query(models.WorkingDocument).filter(models.WorkingDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "title": doc.title,
        "department": doc.department,
        "category": doc.category,
        "content": doc.content,
        "ai_summary": doc.ai_summary,
        "uploaded_at": str(doc.uploaded_at)
    }

class AskDocRequest(BaseModel):
    question: str

@app.post("/working-docs/{doc_id}/ask")
def ask_working_doc(doc_id: int, request: AskDocRequest, db: Session = Depends(get_db)):
    """Ask an AI question about a specific working document."""
    doc = db.query(models.WorkingDocument).filter(models.WorkingDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    from agents.parser_agent import get_llm
    from langchain_core.prompts import PromptTemplate
    llm = get_llm()
    prompt = PromptTemplate.from_template(
        """You are analyzing a bank's internal document. Answer the question based on the document content.

Document Title: {title}
Department: {department}
Content:
{content}

Question: {question}

Answer (specific and detailed):"""
    )
    chain = prompt | llm
    try:
        answer = chain.invoke({
            "title": doc.title,
            "department": doc.department,
            "content": doc.content[:4000] if doc.content else "No content",
            "question": request.question
        })
        return {"status": "success", "answer": answer.strip()}
    except Exception as e:
        return {"status": "error", "answer": f"AI error: {e}"}

@app.delete("/working-docs/{doc_id}")
def delete_working_doc(doc_id: int, db: Session = Depends(get_db)):
    """Remove a working document from the Knowledge Base."""
    doc = db.query(models.WorkingDocument).filter(models.WorkingDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"status": "success", "message": f"Deleted '{doc.title}'"}

@app.get("/gap-analysis/{circular_id}")
def get_gap_analysis(circular_id: int, db: Session = Depends(get_db)):
    """Re-runs gap analysis for a circular against current Knowledge Base."""
    circular = db.query(models.Circular).filter(models.Circular.id == circular_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
    
    # Get obligations from extracted text (re-parse if needed)
    maps = db.query(models.MapItem).filter(models.MapItem.circular_id == circular_id).all()
    obligations = [m.title for m in maps]
    
    all_docs = db.query(models.WorkingDocument).all()
    doc_list = [{
        "title": d.title, "department": d.department,
        "category": d.category, "ai_summary": d.ai_summary or d.content[:300] if d.content else ""
    } for d in all_docs]
    
    from agents.gap_analyzer import run_gap_analysis
    results = run_gap_analysis(obligations, doc_list)
    
    return {"circular_id": circular_id, "gap_analysis": results, "docs_checked": len(doc_list)}

# ═══════════════════════════════════════════════════════════════
#  DASHBOARD, STATS & EXISTING ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Returns aggregated stats for the dashboard."""
    total_circulars = db.query(models.Circular).count()
    total_maps = db.query(models.MapItem).count()
    pending_maps = db.query(models.MapItem).filter(models.MapItem.status == "Pending").count()
    validated_maps = db.query(models.MapItem).filter(models.MapItem.status.in_(["Validated_Pass", "Already_Compliant"])).count()
    kb_docs = db.query(models.WorkingDocument).count()
    
    from sqlalchemy import func
    dept_counts = db.query(models.MapItem.department, func.count(models.MapItem.id)).group_by(models.MapItem.department).all()
    departments = [{"name": d[0], "count": d[1]} for d in dept_counts]
    
    return {
        "total_circulars": total_circulars,
        "total_maps": total_maps,
        "pending_maps": pending_maps,
        "validated_maps": validated_maps,
        "kb_docs": kb_docs,
        "department_workload": departments
    }

@app.get("/maps")
def get_all_maps(db: Session = Depends(get_db)):
    """Returns all MAPs for display."""
    maps = db.query(models.MapItem).all()
    return maps

@app.get("/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    """Returns all Audit Logs."""
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()
    result = []
    for log in logs:
        # fetch the related map item to show title
        map_item = db.query(models.MapItem).filter(models.MapItem.id == log.map_id).first()
        result.append({
            "id": log.id,
            "map_id": log.map_id,
            "map_title": map_item.title if map_item else f"MAP #{log.map_id}",
            "action": log.action,
            "result": log.result,
            "reasoning": log.reasoning,
            "timestamp": str(log.timestamp)
        })
    return result

COST_RATE_PER_HOUR = 2500  # ₹2,500/hr default

@app.get("/tasks")
def get_all_tasks(db: Session = Depends(get_db)):
    """Returns all MAPs across all circulars with enriched data for the Task Board."""
    maps = db.query(models.MapItem).all()
    result = []
    for m in maps:
        circular = db.query(models.Circular).filter(models.Circular.id == m.circular_id).first()
        # Calculate cost estimate
        try:
            effort = float(m.estimated_effort_hours) if m.estimated_effort_hours and m.estimated_effort_hours not in ['TBD', '?', ''] else 0
        except (ValueError, TypeError):
            effort = 0
        cost = effort * COST_RATE_PER_HOUR
        
        # Deadline countdown
        days_left = None
        if m.deadline and m.deadline not in ['None', 'Unknown', '']:
            try:
                dl = datetime.datetime.strptime(m.deadline, '%Y-%m-%d')
                days_left = (dl - datetime.datetime.utcnow()).days
            except:
                pass
        
        result.append({
            "id": m.id,
            "title": m.title,
            "kpi": m.kpi,
            "deadline": m.deadline,
            "days_left": days_left,
            "department": m.department,
            "evidence_required": m.evidence_required,
            "status": m.status,
            "priority": m.priority,
            "assignee_role": m.assignee_role,
            "estimated_effort_hours": m.estimated_effort_hours,
            "risk_category": m.risk_category,
            "regulatory_fine_potential": m.regulatory_fine_potential,
            "budget_required": m.budget_required,
            "cost_estimate": cost,
            "circular_filename": circular.filename if circular else "Unknown",
            "circular_id": m.circular_id,
            "gap_status": m.gap_status or ("ALREADY_COMPLIANT" if m.status == "Already_Compliant" else "NEW_REQUIREMENT"),
            "matched_document": m.matched_document or "None",
            "gap_detail": m.gap_detail or ""
        })
    return result

class ExtendRequest(BaseModel):
    new_deadline: str
    reason: str

@app.post("/tasks/{map_id}/extend")
def request_extension(map_id: int, request: ExtendRequest, db: Session = Depends(get_db)):
    """Request a deadline extension for a MAP task."""
    map_item = db.query(models.MapItem).filter(models.MapItem.id == map_id).first()
    if not map_item:
        raise HTTPException(status_code=404, detail="MAP not found")
    
    old_deadline = map_item.deadline
    map_item.deadline = request.new_deadline
    
    log = models.AuditLog(
        map_id=map_item.id,
        action="Deadline Extension",
        result="extended",
        reasoning=f"Extended from {old_deadline} to {request.new_deadline}. Reason: {request.reason}"
    )
    db.add(log)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Deadline extended to {request.new_deadline}",
        "old_deadline": old_deadline,
        "new_deadline": request.new_deadline
    }


class ValidateRequest(BaseModel):
    map_id: int
    evidence_text: str

@app.post("/validate")
def validate_map_evidence(request: ValidateRequest, db: Session = Depends(get_db)):
    """Runs the Validator Agent on submitted evidence."""
    map_item = db.query(models.MapItem).filter(models.MapItem.id == request.map_id).first()
    if not map_item:
        raise HTTPException(status_code=404, detail="MAP not found")
        
    map_data = {
        "title": map_item.title,
        "kpi": map_item.kpi,
        "evidence_required": map_item.evidence_required
    }
    
    validation_result = validate_evidence(map_data, request.evidence_text)
    
    if validation_result.get("result") == "pass":
        map_item.status = "Validated_Pass"
    else:
        map_item.status = "Validated_Fail"
        
    log = models.AuditLog(
        map_id=map_item.id,
        action="Evidence Validation",
        result=validation_result.get("result"),
        reasoning=validation_result.get("reasoning", "")
    )
    db.add(log)
    db.commit()
    
    return {
        "status": "success",
        "result": map_item.status,
        "reasoning": validation_result.get("reasoning"),
        "confidence": validation_result.get("confidence")
    }

class ChatRequest(BaseModel):
    circular_id: int
    question: str

@app.post("/chat")
def chat_with_circular(request: ChatRequest, db: Session = Depends(get_db)):
    """Simple chatbot endpoint to ask questions about a specific circular."""
    circular = db.query(models.Circular).filter(models.Circular.id == request.circular_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
        
    from agents.parser_agent import get_llm
    from langchain_core.prompts import PromptTemplate
    
    llm = get_llm()
    prompt = PromptTemplate.from_template(
        """
    You are an expert compliance AI assistant analyzing a specific regulatory circular.
    Give deeply specific answers based ONLY on the circular text below.
    
    Circular Text:
    {text}
    
    Question: {question}
    
    Answer (detailed and specific):
    """
    )
    chain = prompt | llm
    
    try:
        text = circular.extracted_text[:15000] if circular.extracted_text else "No text available."
        response = chain.invoke({"text": text, "question": request.question})
        return {"status": "success", "answer": response.strip()}
    except Exception as e:
        return {"status": "error", "answer": f"Sorry, the AI encountered an error: {e}"}

@app.get("/circulars")
def get_all_circulars(db: Session = Depends(get_db)):
    """Returns a list of all uploaded circulars."""
    circulars = db.query(models.Circular).order_by(models.Circular.upload_date.desc()).all()
    result = []
    for c in circulars:
        result.append({
            "id": c.id,
            "filename": c.filename,
            "upload_date": str(c.upload_date),
            "status": c.status,
            "priority": c.priority,
            "penalty_risk": c.penalty_risk
        })
    return result

@app.get("/circular/{circular_id}")
def get_circular_details(circular_id: int, db: Session = Depends(get_db)):
    circular = db.query(models.Circular).filter(models.Circular.id == circular_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
        
    maps = db.query(models.MapItem).filter(models.MapItem.circular_id == circular_id).all()
    
    generated_maps = []
    for m in maps:
        # Calculate cost
        try:
            effort = float(m.estimated_effort_hours) if m.estimated_effort_hours and m.estimated_effort_hours not in ['TBD', '?', ''] else 0
        except (ValueError, TypeError):
            effort = 0
        cost = effort * COST_RATE_PER_HOUR
        
        generated_maps.append({
            "id": m.id,
            "title": m.title,
            "kpi": m.kpi,
            "deadline": m.deadline,
            "department": m.department,
            "evidence_required": m.evidence_required,
            "status": m.status,
            "priority": m.priority,
            "assignee_role": m.assignee_role,
            "estimated_effort_hours": m.estimated_effort_hours,
            "risk_category": m.risk_category,
            "regulatory_fine_potential": m.regulatory_fine_potential,
            "budget_required": m.budget_required,
            "cost_estimate": cost,
            "gap_status": m.gap_status or ("ALREADY_COMPLIANT" if m.status == "Already_Compliant" else "NEW_REQUIREMENT"),
            "matched_document": m.matched_document or "None",
            "gap_detail": m.gap_detail or ""
        })
        
    return {
        "status": "success",
        "circular_id": circular.id,
        "filename": circular.filename,
        "regulation": circular.filename,
        "summary": circular.summary if circular.summary else (circular.extracted_text[:500] + "..." if circular.extracted_text else "No summary available."),
        "extracted_text": circular.extracted_text or "",
        "priority": circular.priority,
        "penalty_risk": circular.penalty_risk,
        "generated_maps": generated_maps
    }

@app.post("/validate-doc")
async def validate_document(map_id: int = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Validates a MAP using an uploaded evidence document."""
    map_item = db.query(models.MapItem).filter(models.MapItem.id == map_id).first()
    if not map_item:
        raise HTTPException(status_code=404, detail="MAP not found")

    filepath = os.path.join("uploads", file.filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    from agents.pdf_extractor import extract_text
    extracted_text = extract_text(filepath)
    
    from agents.validator_agent import validate_evidence
    map_data = {
        "title": map_item.title,
        "kpi": map_item.kpi,
        "evidence_required": map_item.evidence_required
    }
    validation_result = validate_evidence(map_data, extracted_text)
    
    if validation_result.get("result") == "pass":
        map_item.status = "Validated_Pass"
    else:
        map_item.status = "Validated_Fail"
        
    log = models.AuditLog(
        map_id=map_item.id,
        action="Document Validation",
        result=validation_result.get("result"),
        reasoning=validation_result.get("reasoning")
    )
    db.add(log)
    db.commit()
    
    return {
        "status": "success",
        "result": validation_result.get("result"),
        "reasoning": validation_result.get("reasoning"),
        "confidence": validation_result.get("confidence")
    }

class ValidateKbRequest(BaseModel):
    map_id: int
    doc_id: int

@app.post("/validate-kb-doc")
def validate_kb_document(request: ValidateKbRequest, db: Session = Depends(get_db)):
    """Validates a MAP against an existing Knowledge Base document."""
    map_item = db.query(models.MapItem).filter(models.MapItem.id == request.map_id).first()
    if not map_item:
        raise HTTPException(status_code=404, detail="MAP not found")
        
    doc = db.query(models.WorkingDocument).filter(models.WorkingDocument.id == request.doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="KB Document not found")
        
    from agents.validator_agent import validate_evidence
    map_data = {
        "title": map_item.title,
        "kpi": map_item.kpi,
        "evidence_required": map_item.evidence_required
    }
    validation_result = validate_evidence(map_data, doc.content)
    
    if validation_result.get("result") == "pass":
        map_item.status = "Validated_Pass"
    else:
        map_item.status = "Validated_Fail"
        
    log = models.AuditLog(
        map_id=map_item.id,
        action="Document Validation (from KB)",
        result=validation_result.get("result"),
        reasoning=validation_result.get("reasoning")
    )
    db.add(log)
    db.commit()
    
    return {
        "status": "success",
        "result": validation_result.get("result"),
        "reasoning": validation_result.get("reasoning"),
        "confidence": validation_result.get("confidence")
    }

@app.post("/analyze-complaint")
async def analyze_complaint_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Analyzes an uploaded complaint document against all circulars."""
    filepath = os.path.join("uploads", file.filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    from agents.pdf_extractor import extract_text
    complaint_text = extract_text(filepath)
    
    circulars = db.query(models.Circular).filter(models.Circular.status == "Parsed").all()
    c_data = [{"id": c.id, "filename": c.filename, "priority": c.priority, "summary": (c.extracted_text[:500] if c.extracted_text else "No summary available")} for c in circulars]
    
    from agents.complaint_agent import analyze_complaint
    result = analyze_complaint(complaint_text, c_data)
    
    violated_filename = "None"
    if result.get("is_violation") and result.get("violates_circular_id"):
        violated_c = db.query(models.Circular).filter(models.Circular.id == result["violates_circular_id"]).first()
        if violated_c:
            violated_filename = violated_c.filename
            
    return {
        "status": "success",
        "is_violation": result.get("is_violation"),
        "violates_circular": violated_filename,
        "reasoning": result.get("reasoning"),
        "severity": result.get("severity")
    }

# ═══════════════════════════════════════════════════════════════
#  DEMO / RESET
# ═══════════════════════════════════════════════════════════════

@app.post("/demo/reset")
def demo_reset(db: Session = Depends(get_db)):
    """Wipes all data from the database."""
    db.query(models.AuditLog).delete()
    db.query(models.MapItem).delete()
    db.query(models.Circular).delete()
    db.query(models.WorkingDocument).delete()
    db.commit()
    return {"status": "success", "message": "Database wiped clean."}

@app.post("/demo/populate")
def demo_populate(db: Session = Depends(get_db)):
    """Populates the database with mock data including Knowledge Base documents."""
    
    # Check if already populated
    if db.query(models.Circular).count() > 0:
        return {"status": "success", "message": "Already populated"}

    # ── Seed Knowledge Base with realistic bank documents ──
    kb_docs = [
        {
            "title": "IT Governance SOP v3.2",
            "department": "IT",
            "category": "SOP",
            "content": "Standard Operating Procedure for IT Governance. The bank has formed an IT Strategy Committee comprising Board members. IAM controls are implemented with role-based access. Quarterly vulnerability assessments are conducted by the CISO office.",
            "ai_summary": "Covers IT Strategy Committee formation, IAM controls, and quarterly vulnerability assessments. Compliant with basic RBI IT governance requirements."
        },
        {
            "title": "KYC Re-verification Policy 2025",
            "department": "Operations",
            "category": "Policy",
            "content": "All customer accounts flagged as high-risk must undergo KYC re-verification within 30 days. The Operations team uses the centralized CKYC portal for verification. Digital KYC via video verification is permitted for remote customers.",
            "ai_summary": "Defines KYC re-verification timelines, use of CKYC portal, and video KYC process for flagged accounts."
        },
        {
            "title": "Data Localization Compliance Report",
            "department": "IT",
            "category": "Audit Report",
            "content": "As per RBI mandate, all payment system data is stored exclusively in India. The primary data center is in Mumbai, with DR site in Chennai. No payment data is mirrored to overseas locations. Last audit: Jan 2025 — Compliant.",
            "ai_summary": "Confirms all payment data is stored within India (Mumbai + Chennai DC). Last audited Jan 2025 — fully compliant with RBI data localization."
        },
        {
            "title": "Cyber Security Incident Response Plan",
            "department": "IT",
            "category": "Policy",
            "content": "Incident response plan includes: 24/7 SOC monitoring, automated alerting via SIEM, mandatory CERT-In reporting within 6 hours for critical incidents, and quarterly tabletop exercises.",
            "ai_summary": "Covers SOC operations, SIEM alerting, CERT-In 6hr reporting, and quarterly incident drills. Aligns with CERT-In directives."
        },
        {
            "title": "Board Risk Committee Charter",
            "department": "Risk",
            "category": "Committee Minutes",
            "content": "The Board Risk Committee meets quarterly to review credit risk, market risk, operational risk, and compliance risk. Current composition: 3 independent directors, 1 executive director. Minutes from last 4 meetings are maintained.",
            "ai_summary": "Board Risk Committee with 3 independent + 1 executive director meets quarterly. Reviews all major risk categories."
        }
    ]
    
    for kd in kb_docs:
        doc = models.WorkingDocument(**kd)
        db.add(doc)
    db.commit()

    # ── Seed Circulars & MAPs ──
    circs = [
        {"filename": "SEBI_Cyber_Security_Guidelines.pdf", "priority": "High", "risk": "₹50 Lakh"},
        {"filename": "IRDAI_Data_Localization.pdf", "priority": "Critical", "risk": "₹1 Crore"},
        {"filename": "RBI_Master_Direction_KYC.pdf", "priority": "Medium", "risk": "₹10 Lakh"}
    ]
    
    for c in circs:
        circular = models.Circular(
            filename=c["filename"], 
            status="Parsed", 
            priority=c["priority"], 
            penalty_risk=c["risk"],
            upload_date=datetime.datetime.utcnow() - datetime.timedelta(days=1)
        )
        db.add(circular)
        db.commit()
        db.refresh(circular)
        
        for i in range(2):
            new_map = models.MapItem(
                circular_id=circular.id,
                title=f"Review and update policy section {i+1} as per {c['filename']}",
                kpi=f"{100 - i*10}% compliance rate required",
                deadline="2026-08-01",
                department="IT" if i == 0 else "Risk",
                evidence_required="Updated SOP Document",
                status="Pending",
                priority=c["priority"],
                assignee_role="IT Admin" if i == 0 else "Risk Officer",
                estimated_effort_hours="20" if i == 0 else "8",
                risk_category="IT" if i == 0 else "Operational",
                regulatory_fine_potential="$2.1M" if c["priority"] == "Critical" else "$500K",
                budget_required="Yes"
            )
            db.add(new_map)
    db.commit()
    return {"status": "success", "message": "Populated with circulars, MAPs, and Knowledge Base documents."}

@app.post("/demo/simulate-scrape")
def demo_simulate_scrape(db: Session = Depends(get_db)):
    """Simulates the Monitor Agent finding a new circular online."""
    circular = models.Circular(
        filename="RBI_Gazette_Notification_2026.txt",
        status="Uploaded",
        upload_date=datetime.datetime.utcnow()
    )
    db.add(circular)
    db.commit()
    db.refresh(circular)
    
    return {
        "status": "success",
        "message": "Monitor Agent detected new RBI Gazette Notification: RBI/2026/XYZ.",
        "simulated_filepath": "../circulars/sample-circulars/rbi_it_governance_2023.txt",
        "circular_id": circular.id
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
