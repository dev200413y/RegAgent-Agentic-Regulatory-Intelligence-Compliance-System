from langgraph.graph import StateGraph, END
from agents.state import RegAgentState
from agents.pdf_extractor import monitor_agent_node
from agents.parser_agent import parser_agent_node
from agents.map_generator import map_generator_node
from agents.assignment_engine import assignment_engine_node

def create_workflow():
    """Creates and compiles the LangGraph pipeline for circular processing."""
    # Define a new graph
    workflow = StateGraph(RegAgentState)

    # Define the nodes (agents)
    workflow.add_node("monitor", monitor_agent_node)
    workflow.add_node("parser", parser_agent_node)
    workflow.add_node("map_generator", map_generator_node)
    workflow.add_node("assignment", assignment_engine_node)

    # Define the edges (flow of data)
    workflow.set_entry_point("monitor")
    workflow.add_edge("monitor", "parser")
    workflow.add_edge("parser", "map_generator")
    workflow.add_edge("map_generator", "assignment")
    workflow.add_edge("assignment", END)

    # Compile the graph
    app = workflow.compile()
    return app

# Initialize the global workflow application
app = create_workflow()
