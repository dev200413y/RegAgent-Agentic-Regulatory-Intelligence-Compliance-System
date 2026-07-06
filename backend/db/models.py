from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class Circular(Base):
    __tablename__ = "circulars"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    extracted_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    status = Column(String, default="Processing")  # Processing, Parsed, MAP_Generated, Assigned
    priority = Column(String, default="Medium")
    penalty_risk = Column(String, default="None")
    
    maps = relationship("MapItem", back_populates="circular")

class Employee(Base):
    """Bank Employees available for task assignment"""
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    department = Column(String)  # IT, Risk, Legal, Operations, Compliance
    level = Column(String)       # e.g., Head, Manager, Analyst
    email = Column(String)

class MapItem(Base):
    """Measurable Action Point"""
    __tablename__ = "map_items"
    id = Column(Integer, primary_key=True, index=True)
    circular_id = Column(Integer, ForeignKey("circulars.id"))
    title = Column(String)
    kpi = Column(String)
    deadline = Column(String)
    department = Column(String)
    evidence_required = Column(String)
    status = Column(String, default="Pending") # Pending, Evidence_Submitted, Validated_Pass, Validated_Fail
    priority = Column(String, default="Medium")
    assignee_role = Column(String, nullable=True)
    assignee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    estimated_effort_hours = Column(String, nullable=True)
    risk_category = Column(String, nullable=True)
    regulatory_fine_potential = Column(String, nullable=True)
    budget_required = Column(String, nullable=True)
    gap_status = Column(String, nullable=True)  # ALREADY_COMPLIANT, NEEDS_MODIFICATION, NEW_REQUIREMENT
    matched_document = Column(String, nullable=True)
    gap_detail = Column(Text, nullable=True)
    
    circular = relationship("Circular", back_populates="maps")
    audit_logs = relationship("AuditLog", back_populates="map_item")
    assignee = relationship("Employee")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    map_id = Column(Integer, ForeignKey("map_items.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    action = Column(String)
    result = Column(String, nullable=True)
    reasoning = Column(Text, nullable=True)
    
    map_item = relationship("MapItem", back_populates="audit_logs")

class WorkingDocument(Base):
    """Bank's existing policies, SOPs, committee minutes, audit reports — the Knowledge Base."""
    __tablename__ = "working_documents"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    department = Column(String)           # IT, Risk, Legal, Operations, Compliance
    category = Column(String)             # Policy, SOP, Committee Minutes, Audit Report, Certificate
    content = Column(Text, nullable=True) # Extracted text from uploaded file
    ai_summary = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    file_path = Column(String, nullable=True)
