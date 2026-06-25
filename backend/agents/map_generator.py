import json
from llm import get_llm
from langchain_core.prompts import PromptTemplate
import re

MAP_PROMPT = """
You are an expert compliance officer. Convert the following obligation into a highly specific, advanced Measurable Action Point (MAP) and a KPI to track it.
Avoid generic phrases like "ensure compliance". Be specific about systems, policies, or committees mentioned.
Obligation: {obligation}
Regulation: {regulation}

Return a valid JSON object ONLY (no markdown, no backticks). Format:
{{
  "title": "Specific, actionable task (e.g., Update IT Steering Committee Charter to include Chapter II)",
  "kpi": "Measurable criteria (e.g., 100% of board members signed off)",
  "evidence_required": "Exact document name needed (e.g., Board Resolution Document)",
  "assignee_role": "Specific role (e.g. Chief Risk Officer)",
  "estimated_effort_hours": "Estimated hours (e.g. 20)",
  "risk_category": "One of: Operational, Financial, Reputational, IT",
  "regulatory_fine_potential": "Estimated fine or High/Medium/Low",
  "budget_required": "Yes/No"
}}
"""

def clean_json_response(response: str) -> dict:
    import json, re
    match = re.search(r'\{.*\}', response.strip(), re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {
        "title": f"Review Obligation: {response[:30]}...",
        "kpi": "Detailed Review Completed",
        "evidence_required": "Specific System Log / Policy Update",
        "assignee_role": "Compliance Team",
        "estimated_effort_hours": "TBD",
        "risk_category": "Operational",
        "regulatory_fine_potential": "Unknown",
        "budget_required": "TBD"
    }

def map_generator_node(state: dict) -> dict:
    """
    LangGraph Node: MAP Generator.
    Turns parser obligations into actionable MAPs.
    """
    print("--- [MAP Generator] Creating Action Points ---")
    obligations = state.get("obligations", [])
    regulation = state.get("regulation_reference", "Unknown")
    deadline = state.get("deadline", "Unknown")
    
    maps = []
    llm = get_llm()
    prompt = PromptTemplate.from_template(MAP_PROMPT)
    chain = prompt | llm
    
    for ob in obligations:
        try:
            response = chain.invoke({"obligation": ob, "regulation": regulation})
            map_data = clean_json_response(response)
            
            # Attach deterministc fields
            map_data["deadline"] = deadline
            map_data["status"] = "Pending"
            
            # Temporary department (Assignment Engine will fill this later)
            map_data["department"] = "Unassigned" 
            
            maps.append(map_data)
        except Exception as e:
            print(f"Error generating MAP for obligation: {e}")
            
    return {"maps": maps, "current_step": "map_generator"}
