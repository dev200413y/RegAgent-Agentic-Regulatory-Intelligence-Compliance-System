from typing import TypedDict, List, Dict, Any, Optional

class RegAgentState(TypedDict):
    # Monitor / Ingestion Phase
    circular_id: Optional[int]
    filename: str
    extracted_text: str
    
    # Parser Phase
    obligations: List[str]
    regulation_reference: str
    deadline: str
    affected_functions: List[str]
    summary: str
    priority: str
    penalty_risk: str
    
    # MAP Generation Phase
    maps: List[Dict[str, Any]]
    
    # Execution Tracking
    current_step: str
    errors: List[str]
