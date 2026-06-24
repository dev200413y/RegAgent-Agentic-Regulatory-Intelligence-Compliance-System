import os
import sys

# Ensure backend path is set
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.llm import get_llm
# removed import

state = {
    "extracted_text": """
    RESERVE BANK OF INDIA
    Master Direction on Information Technology Governance
    Ref: RBI/2023-24/107
    Date: November 7, 2023
    Deadline for compliance: April 1, 2024.
    1. Establish a Board-level IT Strategy Committee.
    """
}

# Instead of running the node, let's see exactly what the LLM outputs
from langchain_core.prompts import PromptTemplate

prompt_template = """
You are an expert regulatory compliance parser. Your job is to read a regulatory circular from RBI/SEBI/IRDAI and extract key compliance facts.
Extract the information into the following JSON structure exactly, and nothing else. Do not output markdown code blocks.

{{
  "obligations": ["List of specific actions the bank must take"],
  "regulation_reference": "The circular reference number or title",
  "deadline": "YYYY-MM-DD or 'None'",
  "affected_functions": ["Risk", "IT", "Operations", "Legal", "Compliance", "etc"],
  "summary": "A 2-sentence summary of the circular"
}}

CIRCULAR TEXT:
{text}
"""
prompt = PromptTemplate(template=prompt_template, input_variables=["text"])
llm = get_llm()
chain = prompt | llm

print("Sending request to LLM...")
response = chain.invoke({"text": state["extracted_text"]})
print("\nRAW LLM OUTPUT:")
print("---")
print(response)
print("---")
