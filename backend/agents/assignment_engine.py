import yaml
import os

# Deterministic assignment mapping
# This makes it easy to add new regulators without code changes.
DEFAULT_MAPPING = {
    "kyc": "Operations",
    "customer": "Operations",
    "verification": "Operations",
    "capital": "Risk",
    "adequacy": "Risk",
    "credit": "Risk",
    "data": "IT",
    "cybersecurity": "IT",
    "software": "IT",
    "localization": "IT",
    "authentication": "IT",
    "access": "IT",
    "network": "IT",
    "system": "IT",
    "charter": "Compliance",
    "contract": "Legal",
    "clause": "Legal",
    "penalty": "Legal",
    "audit": "Compliance"
}

def determine_department(map_title: str, affected_functions: list) -> str:
    """Rules-based routing engine."""
    title_lower = map_title.lower()
    
    # 1. Keyword matching from the title (Deterministic, Priority)
    for keyword, dept in DEFAULT_MAPPING.items():
        if keyword in title_lower:
            return dept
            
    # 2. Check if the parser explicitly identified affected functions
    for func in affected_functions:
        if func.lower() in ["risk", "it", "operations", "legal", "compliance", "hr"]:
            return func.capitalize()
            
    return "Compliance" # Default fallback

from db.database import SessionLocal
from db.models import Employee

def assignment_engine_node(state: dict) -> dict:
    """
    LangGraph Node: Assignment Engine.
    Assigns a department to each generated MAP and auto-assigns to the Department Head.
    """
    print("--- [Assignment Engine] Routing MAPs to departments ---")
    maps = state.get("maps", [])
    affected_functions = state.get("affected_functions", [])
    
    db = SessionLocal()
    updated_maps = []
    for m in maps:
        dept = determine_department(m.get("title", ""), affected_functions)
        m["department"] = dept
        
        # Auto-assign to Head of this department
        head = db.query(Employee).filter(Employee.department == dept, Employee.level == "Head").first()
        if not head:
            # Fallback to any employee in dept
            head = db.query(Employee).filter(Employee.department == dept).first()
            
        if head:
            m["assignee_id"] = head.id
            m["assignee_role"] = f"{head.name} ({head.level})"
        else:
            m["assignee_id"] = None
            m["assignee_role"] = "TBD"
            
        updated_maps.append(m)
        
    db.close()
    return {"maps": updated_maps, "current_step": "assignment_engine"}
