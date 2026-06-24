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

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="RegAgent API", description="Agentic Regulatory Intelligence API")

# Add CORS so React frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("../circulars/incoming", exist_ok=True)

class HealthResponse(BaseModel):
    status: str
    message: str

@app.get("/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "message": "RegAgent Backend is running"}

@app.post("/upload")
async def upload_circular(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Receives a file upload, saves it, and adds it to DB for processing."""
    file_location = f"../circulars/incoming/{file.filename}"
    
    # Save file to disk
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    # Save to DB
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
    """Triggers the LangGraph pipeline for a given circular and saves MAPs to DB."""
    circular = db.query(models.Circular).filter(models.Circular.id == request.circular_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
        
    circular.status = "Processing"
    db.commit()
    
    # Initialize the state
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
    
    # Run the graph
    print(f"Starting processing for: {request.filepath}")
    final_state = langgraph_app.invoke(initial_state)
    
    # Save results to DB
    circular.extracted_text = final_state.get("extracted_text")
    circular.priority = final_state.get("priority", "Medium")
    circular.penalty_risk = final_state.get("penalty_risk", "None")
    circular.status = "Parsed"
    db.commit()
    
    # Save MAPs to DB
    generated_maps = final_state.get("maps", [])
    for m in generated_maps:
        new_map = models.MapItem(
            circular_id=circular.id,
            title=m.get("title", ""),
            kpi=m.get("kpi", ""),
            deadline=m.get("deadline", ""),
            department=m.get("department", "Unassigned"),
            evidence_required=m.get("evidence_required", ""),
            status="Pending",
            priority=final_state.get("priority", "Medium")
        )
        db.add(new_map)
    db.commit()
    
    return {
        "status": "success",
        "regulation": final_state.get("regulation_reference"),
        "summary": final_state.get("summary"),
        "priority": final_state.get("priority", "Medium"),
        "penalty_risk": final_state.get("penalty_risk", "Unknown"),
        "generated_maps": generated_maps
    }

@app.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Returns aggregated stats for the dashboard."""
    total_circulars = db.query(models.Circular).count()
    total_maps = db.query(models.MapItem).count()
    pending_maps = db.query(models.MapItem).filter(models.MapItem.status == "Pending").count()
    validated_maps = db.query(models.MapItem).filter(models.MapItem.status.in_(["Validated_Pass"])).count()
    
    # Department workload
    from sqlalchemy import func
    dept_counts = db.query(models.MapItem.department, func.count(models.MapItem.id)).group_by(models.MapItem.department).all()
    departments = [{"name": d[0], "count": d[1]} for d in dept_counts]
    
    return {
        "total_circulars": total_circulars,
        "total_maps": total_maps,
        "pending_maps": pending_maps,
        "validated_maps": validated_maps,
        "department_workload": departments
    }

@app.get("/maps")
def get_all_maps(db: Session = Depends(get_db)):
    """Returns all MAPs for display."""
    maps = db.query(models.MapItem).all()
    return maps

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
    
    # Run Validator Agent
    validation_result = validate_evidence(map_data, request.evidence_text)
    
    # Update Status
    if validation_result.get("result") == "pass":
        map_item.status = "Validated_Pass"
    else:
        map_item.status = "Validated_Fail"
        
    # Save Audit Log
    log = models.AuditLog(
        map_id=map_item.id,
        action="Evidence Validation",
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
    You are an expert, highly advanced compliance AI assistant analyzing a specific regulatory circular.
    Do not give generic answers. Give deeply specific, exact answers based ONLY on the circular text below.
    If the text mentions exact amounts, deadlines, or committee names, use them.
    Explain the reasoning clearly so a non-technical stakeholder can understand the business impact.
    
    Circular Text:
    {text}
    
    Question: {question}
    
    Answer (detailed and specific):
    """
    )
    chain = prompt | llm
    
    try:
        # truncate text to fit context window
        text = circular.extracted_text[:15000] if circular.extracted_text else "No text available."
        response = chain.invoke({"text": text, "question": request.question})
        return {"status": "success", "answer": response.strip()}
    except Exception as e:
        return {"status": "error", "answer": f"Sorry, the AI encountered an error: {e}"}

@app.get("/circulars")
def get_all_circulars(db: Session = Depends(get_db)):
    """Returns a list of all uploaded circulars."""
    circulars = db.query(models.Circular).order_by(models.Circular.upload_date.desc()).all()
    # Provide a formatted list
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

@app.post("/demo/reset")
def demo_reset(db: Session = Depends(get_db)):
    """Wipes all data from the database."""
    db.query(models.AuditLog).delete()
    db.query(models.MapItem).delete()
    db.query(models.Circular).delete()
    db.commit()
    return {"status": "success", "message": "Database wiped clean."}

@app.post("/demo/populate")
def demo_populate(db: Session = Depends(get_db)):
    """Populates the database with 3 mock circulars and associated MAPs."""
    import datetime
    
    # Check if already populated
    if db.query(models.Circular).count() > 0:
        return {"status": "success", "message": "Already populated"}

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
        
        # Add 2 MAPs for each
        for i in range(2):
            new_map = models.MapItem(
                circular_id=circular.id,
                title=f"Review and update policy section {i+1} as per {c['filename']}",
                kpi=f"{100 - i*10}% compliance rate required",
                deadline="2026-08-01",
                department="IT" if i == 0 else "Risk",
                evidence_required="Updated SOP Document",
                status="Pending",
                priority=c["priority"]
            )
            db.add(new_map)
    db.commit()
    return {"status": "success"}

@app.post("/demo/simulate-scrape")
def demo_simulate_scrape(db: Session = Depends(get_db)):
    """Simulates the Monitor Agent finding a new circular online."""
    import datetime
    # Create a dummy circular in DB so /process has an ID to work with
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

@app.post("/validate-doc")
async def validate_document(map_id: int = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Validates a MAP using an uploaded evidence document instead of raw text."""
    map_item = db.query(models.MapItem).filter(models.MapItem.id == map_id).first()
    if not map_item:
        raise HTTPException(status_code=404, detail="MAP not found")

    # Save and extract text
    os.makedirs("uploads", exist_ok=True)
    filepath = os.path.join("uploads", file.filename)
    with open(filepath, "wb") as buffer:
        import shutil
        shutil.copyfileobj(file.file, buffer)
        
    from agents.pdf_extractor import extract_text
    extracted_text = extract_text(filepath)
    
    # Call validator agent
    from agents.validator_agent import validate_evidence
    validation_result = validate_evidence(map_item.evidence_required, extracted_text)
    
    if validation_result.get("result") == "pass":
        map_item.status = "Validated_Pass"
    else:
        map_item.status = "Validated_Fail"
        
    # Log it
    log = models.AuditLog(
        map_item_id=map_item.id,
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

@app.post("/analyze-complaint")
async def analyze_complaint_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Analyzes an uploaded complaint document against all circulars."""
    os.makedirs("uploads", exist_ok=True)
    filepath = os.path.join("uploads", file.filename)
    with open(filepath, "wb") as buffer:
        import shutil
        shutil.copyfileobj(file.file, buffer)
        
    from agents.pdf_extractor import extract_text
    complaint_text = extract_text(filepath)
    
    # Get all parsed circulars
    circulars = db.query(models.Circular).filter(models.Circular.status == "Parsed").all()
    c_data = [{"id": c.id, "filename": c.filename, "priority": c.priority, "summary": (c.extracted_text[:500] if c.extracted_text else "No summary available")} for c in circulars]
    
    from agents.complaint_agent import analyze_complaint
    result = analyze_complaint(complaint_text, c_data)
    
    # If it violates a circular, fetch the circular details
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
