from agents.workflow import app as langgraph_app
import json
import time

def run_test():
    print("🚀 Starting RegAgent Pipeline Test...\n")
    
    filepath = "circulars/sample-circulars/rbi_it_governance_2023.txt"
    
    initial_state = {
        "filename": filepath,
        "extracted_text": "",
        "obligations": [],
        "regulation_reference": "",
        "deadline": "",
        "affected_functions": [],
        "summary": "",
        "maps": [],
        "current_step": "init",
        "errors": []
    }
    
    print(f"[1] Triggering LangGraph Workflow for: {filepath}")
    start_time = time.time()
    
    try:
        final_state = langgraph_app.invoke(initial_state)
        
        print("\n✅ Pipeline Completed Successfully!")
        print("-" * 40)
        print(f"Regulation Ref: {final_state.get('regulation_reference')}")
        print(f"Summary: {final_state.get('summary')}")
        print(f"Deadline: {final_state.get('deadline')}")
        
        maps = final_state.get('maps', [])
        print(f"\n🎯 Generated MAPs ({len(maps)}):")
        for i, m in enumerate(maps, 1):
            print(f"\n  MAP {i}: {m.get('title')}")
            print(f"  Department: {m.get('department')}")
            print(f"  KPI: {m.get('kpi')}")
            
        print("-" * 40)
        print(f"⏱️ Time taken: {round(time.time() - start_time, 2)} seconds")
        
    except Exception as e:
        print(f"\n❌ Pipeline Failed!")
        print(f"Error: {e}")
        print("\nMake sure 'ollama serve' is running and 'mistral' model is pulled.")

if __name__ == "__main__":
    run_test()
