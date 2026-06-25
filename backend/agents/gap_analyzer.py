import json
import re
from langchain_core.prompts import PromptTemplate
from llm import get_llm

GAP_ANALYSIS_PROMPT = """
You are an expert regulatory compliance gap analyzer for a bank.

You are given:
1. A list of OBLIGATIONS from a new regulatory circular
2. A list of EXISTING DOCUMENTS the bank already has (policies, SOPs, committee minutes, etc.)

Your job is to determine, for EACH obligation, whether the bank is:
- "ALREADY_COMPLIANT": The existing documents fully satisfy this obligation. No action needed.
- "NEEDS_MODIFICATION": The bank has relevant documents but they need updates to fully comply.
- "NEW_REQUIREMENT": The bank has nothing related. A completely new policy/action is needed.

OBLIGATIONS:
{obligations}

EXISTING BANK DOCUMENTS:
{existing_docs}

Return a JSON array. For each obligation, return:
{{
  "obligation": "the obligation text",
  "status": "ALREADY_COMPLIANT" or "NEEDS_MODIFICATION" or "NEW_REQUIREMENT",
  "matched_document": "title of the matching document, or 'None'",
  "gap_detail": "What exactly is missing or needs changing",
  "action_needed": "Specific action to close the gap, or 'No action needed'"
}}

Return ONLY the JSON array, no other text.
"""

def clean_json_response(response: str) -> list:
    """Parse the LLM response into a list of gap analysis results."""
    cleaned = re.sub(r'```json\s*', '', response)
    cleaned = re.sub(r'```', '', cleaned)
    try:
        result = json.loads(cleaned.strip())
        if isinstance(result, list):
            return result
        return [result]
    except json.JSONDecodeError as e:
        print(f"Gap Analyzer JSON Parse Error: {e}")
        return []

def run_gap_analysis(obligations: list, working_docs: list) -> list:
    """
    Compares circular obligations against existing bank documents.
    
    Args:
        obligations: List of obligation strings from the parser agent
        working_docs: List of dicts with keys: title, department, category, content/ai_summary
    
    Returns:
        List of gap analysis results
    """
    if not obligations:
        return []
    
    # Format existing docs for the prompt
    docs_text = ""
    if not working_docs:
        docs_text = "NO EXISTING DOCUMENTS FOUND. All obligations are new requirements."
    else:
        for i, doc in enumerate(working_docs, 1):
            summary = doc.get("ai_summary") or doc.get("content", "")[:500]
            docs_text += f"\n{i}. [{doc['department']}] {doc['title']} ({doc['category']})\n   Summary: {summary}\n"
    
    obligations_text = "\n".join([f"- {ob}" for ob in obligations])
    
    llm = get_llm()
    prompt = PromptTemplate.from_template(GAP_ANALYSIS_PROMPT)
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "obligations": obligations_text,
            "existing_docs": docs_text
        })
        results = clean_json_response(response)
        
        # Ensure every obligation has a result
        covered_obligations = {r.get("obligation", "").lower() for r in results}
        for ob in obligations:
            if ob.lower() not in covered_obligations:
                results.append({
                    "obligation": ob,
                    "status": "NEW_REQUIREMENT" if not working_docs else "NEEDS_MODIFICATION",
                    "matched_document": "None",
                    "gap_detail": "Not analyzed by LLM",
                    "action_needed": "Manual review required"
                })
        
        return results
    except Exception as e:
        print(f"Gap Analyzer Error: {e}")
        # Fallback: treat everything as new
        return [{
            "obligation": ob,
            "status": "NEW_REQUIREMENT",
            "matched_document": "None",
            "gap_detail": "Gap analysis failed — treating as new requirement",
            "action_needed": "Full implementation required"
        } for ob in obligations]
