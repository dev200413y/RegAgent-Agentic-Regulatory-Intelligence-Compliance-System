from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

# Configure local Ollama model
# Ensure Ollama is running locally (e.g. `ollama serve` and `ollama run mistral:7b`)
MODEL_NAME = "llama3.2" # Use mistral or phi3 depending on local setup
BASE_URL = "http://localhost:11434"

def get_llm():
    """Returns an instance of the local Ollama LLM."""
    return Ollama(
        model=MODEL_NAME,
        base_url=BASE_URL,
        temperature=0.0, # Low temperature for consistent JSON output
    )

def test_llm_connection():
    """Simple test to verify Ollama is responding."""
    try:
        llm = get_llm()
        response = llm.invoke("Say 'Ollama is connected' if you can read this.")
        return {"status": "success", "message": response}
    except Exception as e:
        return {"status": "error", "message": str(e)}
