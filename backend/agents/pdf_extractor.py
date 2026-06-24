import fitz  # PyMuPDF
import os

def extract_text_from_pdf(filepath: str) -> str:
    """Extracts text from a PDF file."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    
    text = ""
    try:
        doc = fitz.open(filepath)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text += page.get_text()
        doc.close()
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""
    
    return text.strip()

def extract_text(filepath: str) -> str:
    """Extracts text from PDF or TXT files."""
    if filepath.endswith(".pdf"):
        return extract_text_from_pdf(filepath)
    else:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return "Unsupported file format or file error."

def monitor_agent_node(state: dict) -> dict:
    """
    LangGraph Node: The Monitor Agent / Extractor.
    In a real scenario, this would watch a folder or website.
    Here it just extracts text from the provided filename.
    """
    filename = state.get("filename", "")
    print(f"--- [Monitor Agent] Extracting text from {filename} ---")
    
    if filename.endswith(".pdf"):
        extracted_text = extract_text_from_pdf(filename)
    else:
        # Fallback for txt files or unsupported formats during hackathon
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                extracted_text = f.read()
        except Exception:
            extracted_text = "Unsupported file format or file error."
            
    return {"extracted_text": extracted_text, "current_step": "monitor_agent"}
