import json
from langchain_core.prompts import PromptTemplate
from agents.parser_agent import get_llm, clean_json_response

COMPLAINT_PROMPT = """
You are an AI Compliance Investigator at an Indian Bank.
A customer or internal whistleblower has filed a complaint. 
You must analyze the complaint text and identify if it violates any of the recent regulatory circulars provided in the context.

AVAILABLE CIRCULARS (Context):
{circular_context}

COMPLAINT TEXT:
{complaint_text}

Analyze the complaint and return ONLY a JSON object with this exact structure:
{{
    "is_violation": true/false,
    "violates_circular_id": integer or null (if it doesn't match any),
    "reasoning": "Explain why this complaint violates the circular, or why it doesn't.",
    "severity": "Critical, High, Medium, or Low"
}}
"""

def analyze_complaint(complaint_text: str, circulars_data: list) -> dict:
    llm = get_llm()
    prompt = PromptTemplate.from_template(COMPLAINT_PROMPT)
    chain = prompt | llm
    
    # Format the context
    context_str = ""
    for c in circulars_data:
        context_str += f"ID {c['id']} - Priority: {c['priority']} - File: {c['filename']}\nSummary: {c['summary']}\n\n"
        
    try:
        response = chain.invoke({"circular_context": context_str, "complaint_text": complaint_text})
        cleaned_json = clean_json_response(response)
        parsed_data = json.loads(cleaned_json)
        return {
            "is_violation": parsed_data.get("is_violation", False),
            "violates_circular_id": parsed_data.get("violates_circular_id"),
            "reasoning": parsed_data.get("reasoning", "Analysis failed."),
            "severity": parsed_data.get("severity", "Medium")
        }
    except Exception as e:
        print(f"Complaint Analysis Error: {e}")
        return {
            "is_violation": False,
            "violates_circular_id": None,
            "reasoning": "Failed to parse complaint securely.",
            "severity": "Low"
        }
