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
    status = Column(String, default="Processing")  # Processing, Parsed, MAP_Generated, Assigned
    priority = Column(String, default="Medium")
    penalty_risk = Column(String, default="None")
    
    maps = relationship("MapItem", back_populates="circular")

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
    
    circular = relationship("Circular", back_populates="maps")
    audit_logs = relationship("AuditLog", back_populates="map_item")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    map_id = Column(Integer, ForeignKey("map_items.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    action = Column(String) # e.g. "Evidence Submitted", "Validation Pass"
    reasoning = Column(Text, nullable=True) # Validator agent's reasoning
    
    map_item = relationship("MapItem", back_populates="audit_logs")
