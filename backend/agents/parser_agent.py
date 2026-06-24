import json
from langchain_core.prompts import PromptTemplate
from llm import get_llm
import re

PARSER_PROMPT = """
You are an expert regulatory compliance parser. Your job is to read a regulatory circular from RBI/SEBI/IRDAI and extract key compliance facts.
Extract the information into the following JSON structure exactly, and nothing else. Do not output markdown code blocks.

{{
  "obligations": ["List of specific actions the bank must take"],
  "regulation_reference": "The circular reference number or title",
  "deadline": "YYYY-MM-DD or 'None'",
  "affected_functions": ["Risk", "IT", "Operations", "Legal", "Compliance", "etc"],
  "summary": "A 2-sentence summary of the circular",
  "priority": "Critical, High, Medium, or Low",
  "penalty_risk": "Estimation of financial/regulatory penalty if ignored (e.g. '₹1 Crore Fine' or 'None')"
}}

CIRCULAR TEXT:
{text}
"""

def clean_json_response(response: str) -> dict:
    """Attempts to clean up LLM output if it wraps JSON in markdown blocks."""
    # Try to find anything that looks like a JSON object
    print("--- RAW LLM RESPONSE ---")
    print(response)
    print("------------------------")
    match = re.search(r'\{[\s\S]*\}', response)
    # Remove markdown formatting if present
    cleaned = re.sub(r'```json\s*', '', response)
    cleaned = re.sub(r'```', '', cleaned)
    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError as e:
        print(f"JSON Parse Error: {e}")
        # Fallback empty structure
        return {
            "obligations": [],
            "regulation_reference": "Unknown",
            "deadline": "None",
            "affected_functions": [],
            "summary": "Failed to parse properly.",
            "priority": "Medium",
            "penalty_risk": "Unknown"
        }

def parser_agent_node(state: dict) -> dict:
    """
    LangGraph Node: The Parser Agent.
    Converts unstructured circular text into structured JSON compliance facts.
    """
    print("--- [Parser Agent] Extracting structured facts ---")
    extracted_text = state.get("extracted_text", "")
    
    if not extracted_text or len(extracted_text) < 10:
        return {"current_step": "parser_agent"}
        
    llm = get_llm()
    prompt = PromptTemplate.from_template(PARSER_PROMPT)
    
    chain = prompt | llm
    
    try:
        # For a hackathon, we might want to truncate text if it's too long for mistral context window
        truncated_text = extracted_text[:4000] 
        response = chain.invoke({"text": truncated_text})
        parsed_data = clean_json_response(response)
        
        return {
            "obligations": parsed_data.get("obligations", []),
            "regulation_reference": parsed_data.get("regulation_reference", "Unknown"),
            "deadline": parsed_data.get("deadline", "None"),
            "affected_functions": parsed_data.get("affected_functions", []),
            "summary": parsed_data.get("summary", ""),
            "priority": parsed_data.get("priority", "Medium"),
            "penalty_risk": parsed_data.get("penalty_risk", "Unknown"),
            "current_step": "parser_agent"
        }
    except Exception as e:
        print(f"Parser Agent Error: {e}")
        return {"current_step": "parser_agent_error"}
