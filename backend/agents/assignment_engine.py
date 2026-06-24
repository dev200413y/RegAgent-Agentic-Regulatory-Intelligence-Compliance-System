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
    "contract": "Legal",
    "clause": "Legal",
    "penalty": "Legal",
    "audit": "Compliance"
}

def determine_department(map_title: str, affected_functions: list) -> str:
    """Rules-based routing engine."""
    title_lower = map_title.lower()
    
    # 1. Check if the parser explicitly identified affected functions
    for func in affected_functions:
        if func.lower() in ["risk", "it", "operations", "legal", "compliance"]:
            return func.capitalize()
            
    # 2. Fallback to keyword matching from the title
    for keyword, dept in DEFAULT_MAPPING.items():
        if keyword in title_lower:
            return dept
            
    return "Compliance" # Default fallback

def assignment_engine_node(state: dict) -> dict:
    """
    LangGraph Node: Assignment Engine.
    Assigns a department to each generated MAP.
    """
    print("--- [Assignment Engine] Routing MAPs to departments ---")
    maps = state.get("maps", [])
    affected_functions = state.get("affected_functions", [])
    
    updated_maps = []
    for m in maps:
        dept = determine_department(m.get("title", ""), affected_functions)
        m["department"] = dept
        updated_maps.append(m)
        
    return {"maps": updated_maps, "current_step": "assignment_engine"}
