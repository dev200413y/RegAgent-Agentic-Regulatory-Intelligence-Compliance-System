import json
import re
from langchain_core.prompts import PromptTemplate
from llm import get_llm

VALIDATOR_PROMPT = """
You are an autonomous compliance validator. Your job is to verify if the submitted evidence satisfies the Measurable Action Point (MAP) criteria.

MAP Details:
Title: {title}
KPI: {kpi}
Required Evidence: {evidence_required}

Submitted Evidence Content:
{evidence_content}

Assess if the evidence satisfies the requirement. Return your judgment exactly as this JSON object, nothing else:
{{
  "result": "pass" or "fail",
  "reasoning": "A short explanation of why it passes or fails based on the evidence text",
  "confidence": "high" or "low"
}}
"""

def clean_json_response(response: str) -> dict:
    cleaned = re.sub(r'```json\s*', '', response)
    cleaned = re.sub(r'```', '', cleaned)
    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        return {
            "result": "fail",
            "reasoning": "Failed to parse validator LLM output.",
            "confidence": "low"
        }

def validate_evidence(map_data: dict, evidence_content: str) -> dict:
    """Standalone function to validate a specific MAP against evidence."""
    llm = get_llm()
    prompt = PromptTemplate.from_template(VALIDATOR_PROMPT)
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "title": map_data.get("title", ""),
            "kpi": map_data.get("kpi", ""),
            "evidence_required": map_data.get("evidence_required", ""),
            "evidence_content": evidence_content[:2000] # Truncate for local LLM limits
        })
        return clean_json_response(response)
    except Exception as e:
        print(f"Validator Error: {e}")
        return {"result": "fail", "reasoning": str(e), "confidence": "low"}
