import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  CheckCircle, ShieldCheck, Activity, Search, Bell, Shield, User, 
  UploadCloud, FileText, Settings, History, LayoutDashboard,
  Check, RefreshCw, Zap, Database, BookOpen, MessageSquare, 
  Send, Trash2, X, Plus, FolderOpen, ClipboardList, Clock, 
  ChevronDown, ChevronUp, Calendar, DollarSign, Users, AlertTriangle,
  Eye, ArrowRight
} from 'lucide-react';
import './index.css';

const App = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Pipeline
  const [pipelineActive, setPipelineActive] = useState(false);
  const [activeNode, setActiveNode] = useState(-1);
  const pipelineNodes = [
    { id: 0, label: "MONITOR_NODE" },
    { id: 1, label: "PARSER_ENG" },
    { id: 2, label: "GAP_ANALYZER" },
    { id: 3, label: "MAP_GEN" },
    { id: 4, label: "ASSIGN_Q" },
  ];

  const [stats, setStats] = useState({ total_circulars: 0, pending_maps: 0, validated_maps: 0, kb_docs: 0, department_workload: [] });
  const [circularsList, setCircularsList] = useState([]);
  
  const fileInputRef = useRef(null);
  const [validationResults, setValidationResults] = useState({});
  const validateFileRef = useRef(null);
  const [validatingMapId, setValidatingMapId] = useState(null);

  const [penaltyTickerVal, setPenaltyTickerVal] = useState(0);
  const [agentLogs, setAgentLogs] = useState([
    { ts: new Date().toLocaleTimeString(), tag: 'SYNC', msg: 'System initialized. Awaiting directives.' }
  ]);

  // Knowledge Base state
  const [kbDocs, setKbDocs] = useState([]);
  const [kbUploadOpen, setKbUploadOpen] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbDept, setKbDept] = useState('IT');
  const [kbDeptCustom, setKbDeptCustom] = useState('');
  const [kbCategory, setKbCategory] = useState('SOP');
  const [kbCatCustom, setKbCategoryCustom] = useState('');
  
  const [kbSelectMapId, setKbSelectMapId] = useState(null);
  const kbFileRef = useRef(null);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbAskDocId, setKbAskDocId] = useState(null);
  const [kbQuestion, setKbQuestion] = useState('');
  const [kbAnswer, setKbAnswer] = useState('');
  const [kbAsking, setKbAsking] = useState(false);

  // Team & Employees state
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: '', department: 'IT', level: 'Head', email: '' });
  const [isCustomSubTeam, setIsCustomSubTeam] = useState(false);
  const [kbSelectedFile, setKbSelectedFile] = useState(null);
  const [kbReadContent, setKbReadContent] = useState(null);
  const [kbReadTitle, setKbReadTitle] = useState('');
  const [kbReading, setKbReading] = useState(false);
  const [kbReadModalOpen, setKbReadModalOpen] = useState(false);

  const [docExpanded, setDocExpanded] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);

  // Task Board state
  const [allTasks, setAllTasks] = useState([]);
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendMapId, setExtendMapId] = useState(null);
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');

  // Audit Logs & Settings
  const [auditLogsData, setAuditLogsData] = useState([]);
  
  // Cost modal state
  const [costModalOpen, setCostModalOpen] = useState(false);

  const addLog = (tag, msg) => {
    setAgentLogs(prev => [...prev.slice(-50), { ts: new Date().toLocaleTimeString(), tag, msg }]);
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get('http://localhost:8000/employees');
      setEmployees(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:8000/employees', newEmployee);
      setEmployees([...employees, res.data]);
      setNewEmployee({ name: '', department: 'IT', level: 'Head', email: '' });
      addLog('TEAM', `New employee created: ${res.data.name} (${res.data.department})`);
    } catch (err) {
      console.error(err);
      alert('Failed to create employee');
    }
  };

  const handleAssignEmployee = async (mapId, assigneeValue) => {
    if (!assigneeValue) return;
    try {
      let payload = {};
      if (assigneeValue.startsWith('custom:')) {
        payload = { custom_role: assigneeValue.split('custom:')[1] };
      } else {
        payload = { assignee_id: parseInt(assigneeValue) };
      }
      
      const res = await axios.put(`http://localhost:8000/maps/${mapId}/assign`, payload);
      // Update local state to reflect new assignee
      if (result && result.generated_maps) {
        const updatedMaps = result.generated_maps.map(m => 
          m.id === mapId ? { ...m, assignee_role: res.data.assignee_role, assignee_id: res.data.assignee_id } : m
        );
        setResult({ ...result, generated_maps: updatedMaps });
      }
      
      setAllTasks(prev => prev.map(m => 
        m.id === mapId ? { ...m, assignee_role: res.data.assignee_role, assignee_id: res.data.assignee_id } : m
      ));
      
      addLog('ASSIGN', `Manually reassigned task to ${res.data.assignee_role}`);
    } catch (err) {
      console.error(err);
      alert('Failed to assign employee');
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCirculars();
    fetchKbDocs();
    fetchEmployees();
  }, []);

  // Dynamic penalty from MAPs
  useEffect(() => {
    if (result && result.generated_maps) {
      let total = 0;
      result.generated_maps.forEach(m => {
        if (m.status === 'Validated_Pass' || m.status === 'Already_Compliant') return;
        let valStr = String(m.regulatory_fine_potential || "0").toLowerCase();
        let match = valStr.match(/(\d+(?:\.\d+)?)/);
        let num = match ? parseFloat(match[1]) : 0;
        if (num < 1000) {
            if (valStr.includes('m') || valStr.includes('million')) num *= 1000000;
            else if (valStr.includes('k')) num *= 1000;
            else if (valStr.includes('cr') || valStr.includes('crore')) num *= 10000000;
            else if (valStr.includes('lakh') || valStr.includes('l')) num *= 100000;
        }
        total += (isNaN(num) ? 0 : num);
      });
      setPenaltyTickerVal(total);
    } else {
      setPenaltyTickerVal(0);
    }
  }, [result, validationResults]);

  const fetchStats = async () => {
    try { const res = await axios.get('http://localhost:8000/stats'); setStats(res.data); } catch (e) { console.error("Failed to fetch stats", e); }
  };
  const fetchCirculars = async () => {
    try { const res = await axios.get('http://localhost:8000/circulars'); setCircularsList(res.data); } catch (e) { console.error("Failed to fetch circulars", e); }
  };
  const fetchKbDocs = async () => {
    try { const res = await axios.get('http://localhost:8000/working-docs'); setKbDocs(res.data); } catch (e) { console.error("Failed to fetch KB docs", e); }
  };
  const fetchAuditLogs = async () => {
    try { const res = await axios.get('http://localhost:8000/audit-logs'); setAuditLogsData(res.data); } catch (e) { console.error("Failed to fetch audit logs", e); }
  };
  const fetchTasks = async () => {
    try { const res = await axios.get('http://localhost:8000/tasks'); setAllTasks(res.data); } catch (e) { console.error("Failed to fetch tasks", e); }
  };
  const handleDemoReset = async () => {
    if(!window.confirm("Wipe all data?")) return;
    try { await axios.post('http://localhost:8000/demo/reset'); fetchStats(); fetchCirculars(); fetchKbDocs(); setResult(null); alert("Database wiped!"); } catch (e) { console.error(e); }
  };
  const handleDemoPopulate = async () => {
    try { await axios.post('http://localhost:8000/demo/populate'); fetchStats(); fetchCirculars(); fetchKbDocs(); alert("Database populated!"); } catch (e) { console.error(e); }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleProcessFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setCurrentView('dashboard');
    setPipelineActive(true);
    let step = 0;
    setActiveNode(0);
    addLog('SYNC', `Ingesting file: ${file.name}`);
    
    const interval = setInterval(() => {
      step++;
      if (step > 4) { clearInterval(interval); setTimeout(() => setPipelineActive(false), 2000); }
      else {
        setActiveNode(step);
        if(step === 1) addLog('PARSER', 'Extracting regulatory facts and dates.');
        if(step === 2) addLog('GAP_ANLZ', `Cross-referencing against ${kbDocs.length} Knowledge Base documents...`);
        if(step === 3) addLog('MAP_GEN', 'Generating MAPs for identified gaps only.');
        if(step === 4) addLog('ASSIGN_Q', 'Dispatching MAPs to department queues.');
      }
    }, 1500);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post('http://localhost:8000/upload', formData);
      const { filepath, circular_id } = uploadRes.data;
      const processRes = await axios.post('http://localhost:8000/process', { filepath, circular_id });
      
      setTimeout(() => {
        setResult({ ...processRes.data, circular_id });
        if (processRes.data.gap_analysis) {
          const compliant = processRes.data.gap_analysis.filter(g => g.status === 'ALREADY_COMPLIANT').length;
          const needsMod = processRes.data.gap_analysis.filter(g => g.status === 'NEEDS_MODIFICATION').length;
          const newReq = processRes.data.gap_analysis.filter(g => g.status === 'NEW_REQUIREMENT').length;
          addLog('GAP_ANLZ', `Analysis complete: ${compliant} compliant, ${needsMod} need changes, ${newReq} new requirements.`);
        }
        fetchStats();
        fetchCirculars();
        setLoading(false);
      }, 7500);
    } catch (error) {
      console.error("API Error", error);
      addLog('RISK', `ERR: Pipeline failed - ${error.message}`);
      setLoading(false);
    }
  };

  const handleSelectCircular = async (circularId) => {
    setLoading(true);
    setResult(null);
    setCurrentView('dashboard');
    addLog('SYNC', `Loading directive ID: ${circularId}`);
    try {
      const res = await axios.get(`http://localhost:8000/circular/${circularId}`);
      setResult(res.data);
      addLog('SYNC', `Loaded. ${res.data.generated_maps?.length || 0} MAPs found.`);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const triggerDocumentValidation = (mapId) => {
    setValidatingMapId(mapId);
    validateFileRef.current.click();
  };

  const handleEvidenceUpload = async (e) => {
    if (!e.target.files || !e.target.files[0] || !validatingMapId) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('map_id', validatingMapId);
    const mId = validatingMapId;
    setValidationResults(prev => ({ ...prev, [mId]: { loading: true } }));
    addLog('VALIDATOR', `Evidence received for MAP #${mId}: ${file.name}`);
    try {
      const res = await axios.post('http://localhost:8000/validate-doc', formData);
      setValidationResults(prev => ({ ...prev, [mId]: res.data }));
      fetchStats();
      if(res.data.result === 'pass') addLog('VALIDATOR', `✓ PASSED block #${mId}.`);
      else addLog('RISK', `✗ FAILED block #${mId}. Evidence insufficient.`);
    } catch (error) {
      setValidationResults(prev => ({ ...prev, [mId]: null }));
      addLog('RISK', `ERR: Validation aborted for block #${mId}.`);
    } finally { setValidatingMapId(null); }
  };

  const handleKbValidation = async (mapId, docId) => {
    setKbSelectMapId(null);
    const mId = mapId;
    setValidationResults(prev => ({ ...prev, [mId]: { loading: true } }));
    const docName = kbDocs.find(d => d.id === parseInt(docId))?.title || `Doc #${docId}`;
    addLog('VALIDATOR', `Validating MAP #${mId} against KB doc: ${docName}`);
    try {
      const res = await axios.post('http://localhost:8000/validate-kb-doc', { map_id: mId, doc_id: parseInt(docId) });
      setValidationResults(prev => ({ ...prev, [mId]: res.data }));
      fetchStats();
      if(res.data.result === 'pass') addLog('VALIDATOR', `✓ PASSED block #${mId}.`);
      else addLog('RISK', `✗ FAILED block #${mId}. Evidence insufficient.`);
    } catch (error) {
      setValidationResults(prev => ({ ...prev, [mId]: null }));
      addLog('RISK', `ERR: KB Validation aborted for block #${mId}.`);
    }
  };

  // Knowledge Base upload
  const handleKbUpload = async () => {
    if (!kbFileRef.current?.files[0] || !kbTitle) return;
    setKbUploading(true);
    addLog('KB', `Uploading document: ${kbTitle}`);
    const formData = new FormData();
    formData.append('file', kbFileRef.current.files[0]);
    formData.append('title', kbTitle);
    formData.append('department', kbDept === '__other__' ? kbDeptCustom : kbDept);
    formData.append('category', kbCategory === '__other__' ? kbCatCustom : kbCategory);
    try {
      const res = await axios.post('http://localhost:8000/working-docs', formData);
      addLog('KB', `✓ "${res.data.title}" indexed. AI summary generated.`);
      fetchKbDocs();
      fetchStats();
      setKbUploadOpen(false);
      setKbTitle('');
      setKbSelectedFile(null);
    } catch(e) { addLog('RISK', `KB upload failed: ${e.message}`); }
    finally { setKbUploading(false); }
  };

  const handleKbDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/working-docs/${id}`);
      addLog('KB', `Document removed from Knowledge Base.`);
      fetchKbDocs();
      fetchStats();
    } catch(e) { console.error(e); }
  };

  const handleKbAsk = async () => {
    if (!kbQuestion.trim() || !kbAskDocId) return;
    setKbAsking(true);
    setKbAnswer('');
    try {
      const res = await axios.post(`http://localhost:8000/working-docs/${kbAskDocId}/ask`, { question: kbQuestion });
      setKbAnswer(res.data.answer);
    } catch(e) { setKbAnswer('Error: ' + e.message); }
    finally { setKbAsking(false); }
  };

  const handleKbRead = async (id, title) => {
    setKbReading(true);
    setKbReadTitle(title);
    setKbReadContent(null);
    setKbReadModalOpen(true);
    try {
      const res = await axios.get(`http://localhost:8000/working-docs/${id}`);
      setKbReadContent(res.data.content || "No content extracted.");
    } catch(e) {
      setKbReadContent("Error loading document.");
    } finally {
      setKbReading(false);
    }
  };

  // Extension request
  const handleExtend = async () => {
    if (!extendDate || !extendReason || !extendMapId) return;
    try {
      await axios.post(`http://localhost:8000/tasks/${extendMapId}/extend`, { new_deadline: extendDate, reason: extendReason });
      addLog('SYNC', `Extension granted for task #${extendMapId} → ${extendDate}`);
      fetchTasks();
      setExtendModalOpen(false);
      setExtendDate('');
      setExtendReason('');
      setExtendMapId(null);
    } catch(e) { console.error(e); }
  };

  const formatCurrencyCompact = (val) => {
    if(val >= 10000000) return '₹' + (val / 10000000).toFixed(1) + ' Cr';
    if(val >= 100000) return '₹' + (val / 100000).toFixed(1) + ' L';
    if(val >= 1000) return '₹' + (val / 1000).toFixed(0) + 'K';
    if(val === 0) return '₹0';
    return '₹' + val.toLocaleString();
  };

  // Readiness
  const totalMaps = (stats.pending_maps || 0) + (stats.validated_maps || 0);
  const readiness = totalMaps === 0 ? 100 : Math.round((stats.validated_maps / totalMaps) * 100);
  const ringOffset = 377 - ((377 * readiness) / 100);

  // Categorize maps for deep-dive
  const maps = result?.generated_maps || [];
  const alreadyCompliant = maps.filter(m => m.status === 'Already_Compliant' || m.gap_status === 'ALREADY_COMPLIANT');
  const needsModification = maps.filter(m => m.gap_status === 'NEEDS_MODIFICATION' && m.status !== 'Already_Compliant');
  const newRequirement = maps.filter(m => (m.gap_status === 'NEW_REQUIREMENT' || (!m.gap_status && m.status !== 'Already_Compliant')) && !needsModification.includes(m));

  const deptColors = {
    IT: '#6366f1', Risk: '#ef4444', Operations: '#eab308', Legal: '#22c55e', Compliance: '#06b6d4',
    Treasury: '#f97316', Finance: '#a855f7', Credit: '#ec4899', 'Retail Banking': '#14b8a6', 'Corporate Banking': '#8b5cf6',
    'Wealth Management': '#d946ef', HR: '#64748b', 'Internal Audit': '#f43f5e', CISO: '#0ea5e9', 'AML/KYC': '#fbbf24',
    'Customer Service': '#34d399', Board: '#facc15'
  };

  // Task board computed
  const filteredTasks = allTasks.filter(t => {
    if (taskFilter !== 'all' && t.department !== taskFilter) return false;
    if (taskStatusFilter === 'pending' && t.status !== 'Pending') return false;
    if (taskStatusFilter === 'validated' && !t.status.includes('Validated')) return false;
    if (taskStatusFilter === 'compliant' && t.status !== 'Already_Compliant') return false;
    return true;
  });
  const totalCost = allTasks.reduce((s, t) => s + (t.cost_estimate || 0), 0);
  const pendingTasks = allTasks.filter(t => t.status === 'Pending').length;
  const uniqueDepts = [...new Set(allTasks.map(t => t.department))];

  // Render action card (used in action blocks)
  const renderActionCard = (m) => {
    const v = validationResults[m.id];
    const isValidating = v?.loading;
    const isValidated = v && !v.loading;
    return (
      <div key={m.id} className="action-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.25rem'}}>
          <span style={{fontFamily:'var(--font-data)', fontSize:'0.65rem', color:'var(--text-muted)'}}>TSK-{String(m.id).padStart(3,'0')}</span>
          <span style={{fontFamily:'var(--font-data)', fontSize:'0.65rem', padding:'2px 6px', borderRadius:'2px', background:`${deptColors[m.department] || 'var(--primary-amber)'}22`, color: deptColors[m.department] || 'var(--primary-amber)'}}>{m.department}</span>
        </div>
        <div className="action-card-title">{m.title}</div>
        
        {/* Prominent Gap Display */}
        {m.gap_detail && (
          <div style={{marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', borderRadius: '0 4px 4px 0'}}>
            <div style={{fontSize: '0.65rem', color: '#fca5a5', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 'bold'}}>⚠ Required Changes (Auto-Identified)</div>
            <div style={{fontSize: '0.8rem', color: '#fee2e2', lineHeight: '1.4'}}>{m.gap_detail}</div>
            
            {/* If there was an auto-matched document that failed, show it here as context */}
            {(() => {
              const matchedTitle = m.matched_document || m.matchedDocument || '';
              if (matchedTitle && matchedTitle !== 'None') {
                return <div style={{marginTop: '0.5rem', fontSize: '0.7rem', color: '#fca5a5', opacity: 0.8}}>Based on analysis of: {matchedTitle}</div>;
              }
              return null;
            })()}
          </div>
        )}
        
        <div className="action-card-meta" style={{marginTop: '1rem'}}>
          <span className="action-card-meta-item" style={{display:'flex', alignItems:'center', gap:'4px'}}>
            👤 
            <select 
              value="" 
              onChange={e => {
                if (e.target.value === '__custom__') {
                  const customName = prompt("Enter custom assignee name/role:");
                  if (customName) handleAssignEmployee(m.id, 'custom:' + customName);
                } else {
                  handleAssignEmployee(m.id, e.target.value);
                }
              }}
              style={{background:'transparent', border:'none', color: m.assignee_role === 'Unassigned' ? '#fca5a5' : 'inherit', fontSize:'inherit', cursor:'pointer', outline:'none', fontFamily:'var(--font-data)', maxWidth: '300px', textOverflow: 'ellipsis'}}
            >
              <option value="" disabled style={{background: '#1a1f2e', color: '#fff'}}>
                {m.assignee_role === 'Unassigned' ? '⚠️ Unassigned (Need to create new team & notify CEO)' : m.assignee_role || 'TBD'}
              </option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id} style={{background: '#1a1f2e', color: '#fff'}}>{emp.name} ({emp.department})</option>
              ))}
              <option value="__custom__" style={{background: '#1a1f2e', color: '#3b82f6'}}>+ Add Custom...</option>
            </select>
          </span>
          <span className="action-card-meta-item">⏱ {m.estimated_effort_hours || '?'}hrs</span>
          <span className="action-card-meta-item">💰 {m.cost_estimate ? formatCurrencyCompact(m.cost_estimate) : 'TBD'}</span>
          {m.deadline && m.deadline !== 'None' && <span className="action-card-meta-item">📅 {m.deadline}</span>}
        </div>
        {isValidating && <div style={{marginTop:'0.5rem', color:'var(--primary-amber)', fontSize:'0.75rem'}}><RefreshCw className="spin" size={12} style={{display:'inline', marginRight:'4px'}}/> Validating Evidence...</div>}
        {isValidated && (
          <div style={{marginTop:'0.5rem', padding:'0.75rem', borderRadius:'4px', background: v.result === 'pass' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${v.result === 'pass' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize:'0.75rem', color: v.result === 'pass' ? 'var(--success-green)' : '#fca5a5'}}>
            <div style={{fontWeight: 'bold', marginBottom: '0.25rem'}}>{v.result === 'pass' ? '✓ EVIDENCE VERIFIED' : '✗ EVIDENCE REJECTED'}</div>
            {v.reasoning}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="avatar-ring">
            <img src="https://ui-avatars.com/api/?name=Admin&background=111417&color=eab308&rounded=true" alt="User" />
          </div>
          <div className="os-title">COMPLIANCE OS</div>
          <div className="os-version">V2.4.0-STABLE</div>
        </div>
        
        <nav className="sidebar-nav">
          <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
            <LayoutDashboard className="icon" size={18} /> Dashboard
          </div>
          <div className={`nav-item ${currentView === 'tasks' ? 'active' : ''}`} onClick={() => { setCurrentView('tasks'); fetchTasks(); }}>
            <ClipboardList className="icon" size={18} /> Task Board
            {stats.pending_maps > 0 && <span style={{marginLeft:'auto', fontSize:'0.7rem', background:'rgba(239,68,68,0.2)', padding:'2px 6px', borderRadius:'2px', color:'#fca5a5'}}>{stats.pending_maps}</span>}
          </div>
          <div className={`nav-item ${currentView === 'knowledgebase' ? 'active' : ''}`} onClick={() => { setCurrentView('knowledgebase'); fetchKbDocs(); }}>
            <BookOpen className="icon" size={18} /> Working Docs
            {stats.kb_docs > 0 && <span style={{marginLeft:'auto', fontSize:'0.7rem', background:'rgba(234,179,8,0.2)', padding:'2px 6px', borderRadius:'2px', color:'var(--primary-amber)'}}>{stats.kb_docs}</span>}
          </div>
          <div className={`nav-item ${currentView === 'team' ? 'active' : ''}`} onClick={() => { setCurrentView('team'); fetchEmployees(); }}>
            <Users className="icon" size={18} /> Team & Employees
            {employees.length > 0 && <span style={{marginLeft:'auto', fontSize:'0.7rem', background:'rgba(34,197,94,0.2)', padding:'2px 6px', borderRadius:'2px', color:'var(--success-green)'}}>{employees.length}</span>}
          </div>
          <div className={`nav-item ${currentView === 'auditlogs' ? 'active' : ''}`} onClick={() => { setCurrentView('auditlogs'); fetchAuditLogs(); }}>
            <History className="icon" size={18} /> Audit Logs
          </div>
          <div className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
            <Settings className="icon" size={18} /> Settings
          </div>
          
          {/* Circulars in sidebar */}
          <div style={{padding:'1.5rem 2rem 0.5rem', fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', borderTop:'1px solid var(--border-glass)', marginTop:'1rem'}}>
            Circular Repository
          </div>
          {circularsList.map(c => (
            <div key={c.id} className={`nav-item ${result?.circular_id === c.id ? 'active' : ''}`} onClick={() => handleSelectCircular(c.id)}
              style={{paddingLeft:'2.5rem', fontSize:'0.8rem'}}>
              <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={c.filename}>{c.filename}</div>
            </div>
          ))}
        </nav>

        <div className="sidebar-action">
          <button className="btn-initiate" onClick={() => fileInputRef.current.click()}>UPLOAD CIRCULAR</button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display:'none'}} accept=".pdf,.txt" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-area">
        <header className="topbar">
           <div className="topbar-title">SECURE ENCLAVE</div>
           <div className="topbar-search">
             <Search size={16} color="rgba(255,255,255,0.4)" />
             <input type="text" placeholder="Search entity or protocol" />
           </div>
           <div className="topbar-actions">
              <div className="heartbeat"><div className="dot"></div> HEARTBEAT: ACTIVE</div>
              <Bell size={20} style={{color:'var(--text-muted)', cursor:'pointer'}} />
              <Shield size={20} style={{color:'var(--text-muted)', cursor:'pointer'}} />
              <User size={20} style={{color:'var(--primary-amber)', cursor:'pointer'}} />
           </div>
        </header>

        <div className="dashboard-content">

          {/* Hidden file inputs */}
          <input type="file" ref={validateFileRef} style={{display:'none'}} onChange={handleEvidenceUpload} accept=".pdf,.txt" />

          {/* ═══ DASHBOARD VIEW ═══ */}
          {currentView === 'dashboard' && (
            <>
              {/* Top Widgets */}
              <div className="top-widgets">
                {/* Penalty Exposure */}
                <div className="widget-card clickable" onClick={() => setCostModalOpen(true)}>
                  <div className="widget-header"><span>Live Penalty Exposure</span><ShieldCheck size={16} color="#ff9d9d" /></div>
                  <div className="penalty-value" style={{color: penaltyTickerVal === 0 ? 'var(--success-green)' : '#ff9d9d'}}>
                    {penaltyTickerVal === 0 ? '₹0 ✓' : formatCurrencyCompact(penaltyTickerVal)}
                  </div>
                  <div className="penalty-trend"><Activity size={14} /> {penaltyTickerVal === 0 ? 'All compliant — no exposure' : 'Validate evidence to reduce exposure'}</div>
                  <div className="bar-chart">
                    {maps.map((m, i) => {
                      const isCompliant = m.status === 'Already_Compliant' || validationResults[m.id]?.result === 'pass';
                      return <div key={i} className="bar" style={{height: isCompliant ? '10%' : `${40 + i * 15}%`, background: isCompliant ? 'var(--success-green)' : '#ff9d9d', opacity: isCompliant ? 0.3 : 0.6}}></div>
                    })}
                    {maps.length === 0 && [20,35,25,40,30].map((h,i) => <div key={i} className="bar" style={{height:`${h}%`, opacity:0.2}}></div>)}
                  </div>
                  <div className="widget-footer"><span>MAPS: {maps.length}</span><span>GAPS: {needsModification.length + newRequirement.length}</span></div>
                </div>

                {/* Audit Readiness */}
                <div className="widget-card highlight clickable" onClick={() => { setCurrentView('tasks'); fetchTasks(); }}>
                  <div className="widget-header"><span style={{color:'var(--primary-amber)'}}>Audit Readiness</span><Settings size={16} color="var(--primary-amber)" /></div>
                  <div className="audit-ring-container">
                    <svg className="ring-svg">
                      <circle cx="70" cy="70" r="60" className="ring-bg" />
                      <circle cx="70" cy="70" r="60" className="ring-progress" style={{strokeDashoffset: ringOffset}} />
                    </svg>
                    <div className="ring-text">
                      <div className="ring-val">{readiness}<span>%</span></div>
                      <div className="ring-lbl">{readiness >= 80 ? 'OPTIMAL' : readiness >= 50 ? 'MODERATE' : 'AT RISK'}</div>
                    </div>
                  </div>
                  <div className="widget-footer"><span>KB: {stats.kb_docs || 0} docs</span><span>SYNC: OK</span></div>
                </div>

                {/* Task Workload & Effort (Replacing Pipeline Topology) */}
                <div className="widget-card clickable" onClick={() => { setCurrentView('tasks'); fetchTasks(); }}>
                  <div className="widget-header"><span>Task Workload</span><Activity size={16} color="var(--text-muted)" /></div>
                  <div className="workload-stats" style={{display:'flex', flexDirection:'column', gap:'1rem', marginTop:'1rem', flex:1}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-glass)', paddingBottom:'0.5rem'}}>
                      <span style={{color:'var(--text-muted)', fontSize:'0.85rem'}}>Total Tasks</span>
                      <span style={{color:'var(--text-primary)', fontSize:'1.1rem', fontFamily:'var(--font-data)'}}>{allTasks.length}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-glass)', paddingBottom:'0.5rem'}}>
                      <span style={{color:'var(--text-muted)', fontSize:'0.85rem'}}>Pending Actions</span>
                      <span style={{color:'var(--primary-amber)', fontSize:'1.1rem', fontFamily:'var(--font-data)'}}>{pendingTasks}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{color:'var(--text-muted)', fontSize:'0.85rem'}}>Estimated Effort</span>
                      <span style={{color:'#a5b4fc', fontSize:'1.1rem', fontFamily:'var(--font-data)'}}>{allTasks.reduce((s, t) => s + (t.estimated_effort_hours || 0), 0)} hrs</span>
                    </div>
                  </div>
                  <div className="widget-footer" style={{marginTop:'auto'}}><span>TEAM CAPACITY: ACTIVE</span><span>{uniqueDepts.length} DEPTS</span></div>
                </div>
              </div>

              {loading && (
                <div style={{padding:'2rem', textAlign:'center', color:'var(--primary-amber)'}}>
                  <RefreshCw className="spin" size={32} style={{margin:'0 auto 1rem'}} />
                  <p style={{fontFamily:'var(--font-data)'}}>PIPELINE ACTIVE — GAP ANALYSIS IN PROGRESS...</p>
                </div>
              )}

              {!loading && (
                <div className="bottom-split">
                  {/* ═══ SECTION A: Document Viewer ═══ */}
                  {result && (
                    <div className="doc-viewer">
                      <div className="doc-viewer-header">
                        <div style={{flex:1}}>
                          <h3 style={{fontSize:'1.1rem', marginBottom:'0.25rem'}}>{result.filename || result.regulation}</h3>
                          <div className="doc-meta">
                            <span className="doc-meta-badge" style={{color:'var(--primary-amber)', background:'rgba(234,179,8,0.1)', borderColor:'rgba(234,179,8,0.2)'}}>
                              {result.priority || 'Medium'} PRIORITY
                            </span>
                            {result.penalty_risk && result.penalty_risk !== 'None' && (
                              <span className="doc-meta-badge" style={{color:'#fca5a5', background:'rgba(239,68,68,0.1)', borderColor:'rgba(239,68,68,0.2)'}}>
                                ⚠ Penalty: {result.penalty_risk}
                              </span>
                            )}
                            <span className="doc-meta-badge" style={{color:'var(--text-muted)'}}>
                              {maps.length} MAPs Generated
                            </span>
                            <span className="doc-meta-badge" style={{color:'var(--success-green)', background:'rgba(34,197,94,0.1)', borderColor:'rgba(34,197,94,0.2)'}}>
                              ✓ {alreadyCompliant.length} Compliant
                            </span>
                            <span className="doc-meta-badge" style={{color:'#fca5a5', background:'rgba(239,68,68,0.1)', borderColor:'rgba(239,68,68,0.2)'}}>
                              ⚠ {needsModification.length + newRequirement.length} Gaps
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div style={{fontSize:'0.75rem', textTransform:'uppercase', color:'var(--text-muted)', letterSpacing:'0.1em', marginBottom:'0.5rem', marginTop: '1rem', fontWeight: 'bold'}}>
                        📄 ORIGINAL DOCUMENT VIEWER
                      </div>
                      <div className="doc-full-text" style={{marginBottom:'1.5rem', height: '500px', padding: 0, overflow: 'hidden', resize: 'vertical'}}>
                        <iframe 
                          src={`http://localhost:8000/files/${result.filename || result.regulation}`}
                          style={{width: '100%', height: '100%', border: 'none', background: 'white'}}
                          title="Original Document"
                        />
                      </div>
                      
                      <div style={{fontSize:'0.75rem', textTransform:'uppercase', color:'var(--primary-amber)', letterSpacing:'0.1em', marginBottom:'0.5rem', fontWeight: 'bold'}}>
                        🧠 AI EXECUTIVE SUMMARY & REQUIRED ACTIONS
                      </div>
                      <div className="doc-summary" style={{background:'rgba(234,179,8,0.05)', padding:'1rem', borderRadius:'4px', borderLeft:'2px solid var(--primary-amber)', whiteSpace:'pre-wrap', color:'var(--text-primary)', lineHeight:1.6, fontSize:'0.85rem'}}>
                        {result.summary || 'No summary available.'}
                      </div>
                    </div>
                  )}

                  {/* ═══ SECTION B: Gap Analysis — Before vs After ═══ */}
                  {result && maps.length > 0 && (
                    <div className="gap-table-container">
                      <div className="gap-table-header">
                        <span>📊 Impact Analysis — What Changed?</span>
                        <div style={{display:'flex', gap:'0.5rem'}}>
                          <span className="gap-badge compliant">✓ {alreadyCompliant.length}</span>
                          <span className="gap-badge modify">⚠ {needsModification.length}</span>
                          <span className="gap-badge new-req">🔴 {newRequirement.length}</span>
                        </div>
                      </div>
                      <div style={{overflowX:'auto'}}>
                        <table className="gap-table">
                          <thead>
                            <tr>
                              <th style={{width:'30%'}}>Obligation / Task</th>
                              <th style={{width:'15%'}}>Status</th>
                              <th style={{width:'20%'}}>Current State (Bank Has)</th>
                              <th style={{width:'20%'}}>Required (Circular Demands)</th>
                              <th style={{width:'15%'}}>Department</th>
                            </tr>
                          </thead>
                          <tbody>
                            {maps.map(m => {
                              const gapStatus = m.gap_status || (m.status === 'Already_Compliant' ? 'ALREADY_COMPLIANT' : 'NEW_REQUIREMENT');
                              return (
                                <tr key={m.id}>
                                  <td style={{fontWeight:500}}>{m.title}</td>
                                  <td>
                                    <span className={`gap-badge ${gapStatus === 'ALREADY_COMPLIANT' ? 'compliant' : gapStatus === 'NEEDS_MODIFICATION' ? 'modify' : 'new-req'}`}>
                                      {gapStatus === 'ALREADY_COMPLIANT' ? '✅ COMPLIANT' : gapStatus === 'NEEDS_MODIFICATION' ? '⚠ MODIFY' : '🔴 NEW REQ'}
                                    </span>
                                  </td>
                                  <td style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>
                                    {gapStatus === 'ALREADY_COMPLIANT' 
                                      ? (m.matched_document && m.matched_document !== 'None' ? `✓ ${m.matched_document}` : 'Existing policy covers this')
                                      : gapStatus === 'NEEDS_MODIFICATION'
                                        ? 'Partial coverage — needs update'
                                        : 'No existing policy found'
                                    }
                                  </td>
                                  <td style={{fontSize:'0.8rem'}}>
                                    {m.evidence_required || m.kpi || 'As per circular'}
                                  </td>
                                  <td>
                                    <span style={{fontFamily:'var(--font-data)', fontSize:'0.7rem', padding:'2px 6px', borderRadius:'2px', background:`${deptColors[m.department] || 'var(--primary-amber)'}22`, color: deptColors[m.department] || 'var(--primary-amber)'}}>
                                      {m.department}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ═══ SECTION C: Three Action Category Blocks ═══ */}
                  {result && maps.length > 0 && (
                    <div className="action-blocks">
                      {/* Block 1: Modify Existing */}
                      <div className="action-block modify">
                        <div className="action-block-header" style={{color:'var(--primary-amber)'}}>
                          <span>⚠ IDENTIFIED GAPS</span>
                          <span className="count">{needsModification.length}</span>
                        </div>
                        <div className="action-block-body">
                          {needsModification.length === 0 && <div style={{color:'var(--text-muted)', fontSize:'0.8rem', textAlign:'center', padding:'1rem'}}>No modifications needed</div>}
                          {needsModification.map(m => renderActionCard(m))}
                        </div>
                      </div>

                      {/* Block 2: New Implementation */}
                      <div className="action-block new-impl">
                        <div className="action-block-header" style={{color:'#fca5a5'}}>
                          <span>🔴 NEW REQUIREMENTS</span>
                          <span className="count">{newRequirement.length}</span>
                        </div>
                        <div className="action-block-body">
                          {newRequirement.length === 0 && <div style={{color:'var(--text-muted)', fontSize:'0.8rem', textAlign:'center', padding:'1rem'}}>No new requirements</div>}
                          {newRequirement.map(m => renderActionCard(m))}
                        </div>
                      </div>

                      {/* Block 3: Already Compliant */}
                      <div className="action-block compliant">
                        <div className="action-block-header" style={{color:'var(--success-green)'}}>
                          <span>✅ Already Compliant</span>
                          <span className="count">{alreadyCompliant.length}</span>
                        </div>
                        <div className="action-block-body">
                          {alreadyCompliant.length === 0 && <div style={{color:'var(--text-muted)', fontSize:'0.8rem', textAlign:'center', padding:'1rem'}}>None matched</div>}
                          {alreadyCompliant.map(m => (
                            <div key={m.id} className="action-card" style={{borderLeft:'2px solid var(--success-green)'}}>
                              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.25rem'}}>
                                <span style={{fontFamily:'var(--font-data)', fontSize:'0.65rem', color:'var(--text-muted)'}}>TSK-{String(m.id).padStart(3,'0')}</span>
                                <span className="gap-badge compliant">NO ACTION</span>
                              </div>
                              <div className="action-card-title" style={{opacity:0.7}}>{m.title}</div>
                              {m.matched_document && m.matched_document !== 'None' && (
                                <div style={{fontSize:'0.75rem', color:'var(--success-green)', marginTop:'0.25rem'}}>✓ Matched: {m.matched_document}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══ SECTION D: MAP Measurable Action Plan ═══ */}
                  {result && maps.length > 0 && (
                    <div className="gap-table-container" style={{marginTop: '2rem'}}>
                      <div className="gap-table-header" style={{background: 'rgba(234, 179, 8, 0.1)', borderBottom: '1px solid var(--primary-amber)'}}>
                        <span style={{color: 'var(--primary-amber)'}}>📋 MAP: MEASURABLE ACTION PLAN</span>
                      </div>
                      <div style={{overflowX:'auto'}}>
                        <table className="gap-table">
                          <thead>
                            <tr>
                              <th style={{width:'8%'}}>Task ID</th>
                              <th style={{width:'35%'}}>Action Item</th>
                              <th style={{width:'17%'}}>Department & Assignee</th>
                              <th style={{width:'25%'}}>KPI / Deliverable</th>
                              <th style={{width:'15%'}}>Deadline & Effort</th>
                            </tr>
                          </thead>
                          <tbody>
                            {maps.map(m => (
                              <tr key={m.id}>
                                <td style={{fontFamily:'var(--font-data)', color:'var(--text-muted)'}}>TSK-{String(m.id).padStart(3,'0')}</td>
                                <td style={{fontWeight:500, color:'var(--text-primary)'}}>{m.title}</td>
                                <td>
                                  <div style={{fontFamily:'var(--font-data)', fontSize:'0.7rem', padding:'2px 6px', borderRadius:'2px', background:`${deptColors[m.department] || 'var(--primary-amber)'}22`, color: deptColors[m.department] || 'var(--primary-amber)', display:'inline-block', marginBottom:'4px'}}>
                                    {m.department}
                                  </div>
                                  <div style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px', color: m.assignee_role === 'Unassigned' ? '#fca5a5' : 'inherit'}}>
                                    {m.assignee_role === 'Unassigned' ? '⚠️ ' : '👤 '}
                                    <select 
                                      value="" 
                                      onChange={e => {
                                        if (e.target.value === '__custom__') {
                                          const customName = prompt("Enter custom assignee name/role:");
                                          if (customName) handleAssignEmployee(m.id, 'custom:' + customName);
                                        } else {
                                          handleAssignEmployee(m.id, e.target.value);
                                        }
                                      }}
                                      style={{background:'transparent', border:'none', color: m.assignee_role === 'Unassigned' ? '#fca5a5' : 'inherit', fontSize:'inherit', cursor:'pointer', outline:'none', fontFamily:'var(--font-data)', maxWidth: '200px', textOverflow: 'ellipsis'}}
                                    >
                                      <option value="" disabled style={{background: '#1a1f2e', color: '#fff'}}>
                                        {m.assignee_role === 'Unassigned' ? 'Unassigned (Need new team & Notify CEO)' : m.assignee_role || 'TBD'}
                                      </option>
                                      {employees.map(emp => (
                                        <option key={emp.id} value={emp.id} style={{background: '#1a1f2e', color: '#fff'}}>{emp.name} ({emp.department})</option>
                                      ))}
                                      <option value="__custom__" style={{background: '#1a1f2e', color: '#3b82f6'}}>+ Add Custom...</option>
                                    </select>
                                  </div>
                                </td>
                                <td style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>
                                  {m.evidence_required || m.kpi || 'See circular'}
                                </td>
                                <td>
                                  <div style={{fontSize:'0.85rem'}}>📅 {m.deadline && m.deadline !== 'None' ? m.deadline : 'Immediate'}</div>
                                  <div style={{fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'4px'}}>⏱ {m.estimated_effort_hours || '?'} hrs</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* No circular selected */}
                  {!result && (
                    <div style={{textAlign:'center', padding:'4rem 2rem', color:'var(--text-muted)'}}>
                      <FileText size={48} style={{margin:'0 auto 1rem', opacity:0.3}} />
                      <h3 style={{marginBottom:'0.5rem', fontSize:'1.5rem', color:'var(--text-primary)'}}>No Circular Selected</h3>
                      <p style={{fontSize:'0.9rem', marginBottom:'2rem'}}>Upload a new regulatory document to begin gap analysis.</p>
                      <button className="btn-initiate" style={{padding:'1rem 3rem', fontSize:'1rem', width:'auto', margin:'0 auto'}} onClick={() => fileInputRef.current.click()}>
                        <UploadCloud size={20} style={{display:'inline', marginRight:'8px', verticalAlign:'middle'}} />
                        UPLOAD NEW CIRCULAR
                      </button>
                    </div>
                  )}

                  {/* Agent Logs */}
                  <div className={`terminal-card ${logsExpanded ? 'expanded' : 'collapsed'}`}>
                    <div className="term-header" onClick={() => setLogsExpanded(!logsExpanded)}>
                      <span>AGENT LOGS</span>
                      <span>{logsExpanded ? '▼' : '▲'}</span>
                    </div>
                    {logsExpanded && (
                      <div className="term-body" ref={el => { if(el) el.scrollTop = el.scrollHeight; }}>
                        {agentLogs.map((log, i) => (
                          <div key={i} className="log-line">
                            <span className="log-ts">[{log.ts}]</span>
                            <span className={`log-tag tag-${log.tag.toLowerCase()}`}>[{log.tag}]</span>
                            <span className="log-msg">{log.msg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ TASK BOARD VIEW ═══ */}
          {currentView === 'tasks' && (
            <div className="task-board">
              <div>
                <h2 style={{fontSize:'1.5rem', color:'var(--primary-amber)', fontFamily:'var(--font-data)', letterSpacing:'0.05em'}}>TASK ALLOCATION BOARD</h2>
                <p style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.25rem'}}>
                  All action items across circulars — assigned, tracked, and costed.
                </p>
              </div>

              {/* Summary chips */}
              <div className="task-summary-bar">
                <div className="task-stat-chip">
                  <span className="label">Total Tasks</span>
                  <span className="value" style={{color:'var(--text-primary)'}}>{allTasks.length}</span>
                </div>
                <div className="task-stat-chip">
                  <span className="label">Pending</span>
                  <span className="value" style={{color:'var(--primary-amber)'}}>{pendingTasks}</span>
                </div>
                <div className="task-stat-chip">
                  <span className="label">Departments</span>
                  <span className="value" style={{color:'var(--deep-indigo)'}}>{uniqueDepts.length}</span>
                </div>
                <div className="task-stat-chip">
                  <span className="label">Total Est. Cost</span>
                  <span className="value" style={{color:'#fca5a5'}}>{formatCurrencyCompact(totalCost)}</span>
                </div>
                <div className="task-stat-chip">
                  <span className="label">Cost Rate</span>
                  <span className="value" style={{color:'var(--text-muted)', fontSize:'1rem'}}>₹2,500/hr</span>
                </div>
              </div>

              {/* Filters */}
              <div className="task-filters">
                <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} style={{background:'rgba(0,0,0,0.5)', color:'white', border:'1px solid rgba(255,255,255,0.1)', padding:'0.2rem 0.5rem', borderRadius:'4px'}}>
                  <option value="all" style={{background: '#1a1f2e', color: '#fff'}}>All Departments</option>
                  {uniqueDepts.map(d => <option key={d} value={d} style={{background: '#1a1f2e', color: '#fff'}}>{d}</option>)}
                </select>
                <select value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)} style={{background:'rgba(0,0,0,0.5)', color:'white', border:'1px solid rgba(255,255,255,0.1)', padding:'0.2rem 0.5rem', borderRadius:'4px'}}>
                  <option value="all" style={{background: '#1a1f2e', color: '#fff'}}>All Statuses</option>
                  <option value="pending" style={{background: '#1a1f2e', color: '#fff'}}>Pending</option>
                  <option value="validated" style={{background: '#1a1f2e', color: '#fff'}}>Validated</option>
                  <option value="compliant" style={{background: '#1a1f2e', color: '#fff'}}>Already Compliant</option>
                </select>
                <span style={{marginLeft:'auto', fontFamily:'var(--font-data)', fontSize:'0.75rem', color:'var(--text-muted)'}}>
                  Showing {filteredTasks.length} of {allTasks.length}
                </span>
              </div>

              {/* Task Table */}
              <div className="task-table-container">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Task</th>
                      <th>Department</th>
                      <th>Assigned To</th>
                      <th>Deadline</th>
                      <th>Effort</th>
                      <th>Cost</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(t => (
                      <tr key={t.id} style={{cursor:'pointer'}} onClick={() => setSelectedTask(selectedTask?.id === t.id ? null : t)}>
                        <td style={{fontFamily:'var(--font-data)', fontSize:'0.75rem', color:'var(--text-muted)'}}>TSK-{String(t.id).padStart(3,'0')}</td>
                        <td>
                          <div style={{fontWeight:500, marginBottom:'0.15rem'}}>{t.title}</div>
                          <div style={{fontFamily:'var(--font-data)', fontSize:'0.65rem', color:'var(--text-muted)'}}>{t.circular_filename}</div>
                        </td>
                        <td>
                          <span style={{fontFamily:'var(--font-data)', fontSize:'0.7rem', padding:'2px 6px', borderRadius:'2px', background:`${deptColors[t.department] || '#eab308'}22`, color: deptColors[t.department] || '#eab308'}}>
                            {t.department}
                          </span>
                        </td>
                        <td style={{fontSize:'0.85rem'}}>{t.assignee_role || 'Unassigned'}</td>
                        <td>
                          <div style={{fontSize:'0.85rem'}}>{t.deadline && t.deadline !== 'None' ? t.deadline : '—'}</div>
                          {t.days_left !== null && t.days_left !== undefined && (
                            <div className={`deadline-countdown ${t.days_left < 7 ? 'urgent' : t.days_left < 30 ? 'normal' : 'safe'}`}>
                              {t.days_left < 0 ? `${Math.abs(t.days_left)}d overdue` : `${t.days_left}d left`}
                            </div>
                          )}
                        </td>
                        <td style={{fontFamily:'var(--font-data)', fontSize:'0.8rem'}}>{t.estimated_effort_hours || '—'}hrs</td>
                        <td style={{fontFamily:'var(--font-data)', fontSize:'0.8rem', color:'var(--primary-amber)'}}>{t.cost_estimate ? formatCurrencyCompact(t.cost_estimate) : '—'}</td>
                        <td>
                          <span className={`task-status-badge ${t.status === 'Pending' ? 'pending' : t.status === 'Already_Compliant' ? 'compliant' : t.status.includes('Pass') ? 'validated' : t.status.includes('Fail') ? 'failed' : 'pending'}`}>
                            {t.status === 'Already_Compliant' ? 'COMPLIANT' : t.status === 'Validated_Pass' ? 'VERIFIED' : t.status === 'Validated_Fail' ? 'FAILED' : 'PENDING'}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{display:'flex', gap:'0.5rem'}}>
                            <button className="btn-sm extend" onClick={() => { setExtendMapId(t.id); setExtendModalOpen(true); }}>
                              <Clock size={10} style={{marginRight:'3px'}}/> Extend
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredTasks.length === 0 && (
                      <tr><td colSpan="9" style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>No tasks found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Selected task detail */}
              {selectedTask && (
                <div className="task-detail-panel">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
                    <h3 style={{fontSize:'1rem'}}>TSK-{String(selectedTask.id).padStart(3,'0')}: {selectedTask.title}</h3>
                    <button className="btn-sm" onClick={() => setSelectedTask(null)}><X size={12}/></button>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'1rem'}}>
                    <div className="task-detail-section">
                      <div className="task-detail-label">KPI / Success Criteria</div>
                      <div style={{fontSize:'0.85rem'}}>{selectedTask.kpi || 'Not specified'}</div>
                    </div>
                    <div className="task-detail-section">
                      <div className="task-detail-label">Evidence Required</div>
                      <div style={{fontSize:'0.85rem'}}>{selectedTask.evidence_required || 'Not specified'}</div>
                    </div>
                    <div className="task-detail-section">
                      <div className="task-detail-label">Risk Category</div>
                      <div style={{fontSize:'0.85rem'}}>{selectedTask.risk_category || 'Unknown'}</div>
                    </div>
                    <div className="task-detail-section">
                      <div className="task-detail-label">Working Plan</div>
                      <div style={{fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.5}}>
                        1. Review current policy against requirement<br/>
                        2. Identify specific gaps in existing SOP<br/>
                        3. Draft updated document / new policy<br/>
                        4. Get departmental sign-off<br/>
                        5. Submit evidence for AI validation
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ KNOWLEDGE BASE VIEW ═══ */}
          {currentView === 'team' && (
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', height:'100%', paddingBottom: '2rem'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <h2 style={{fontSize:'1.8rem', color:'var(--text-primary)', fontWeight:'bold', letterSpacing:'0.02em'}}>Organization <span style={{color:'var(--primary-blue)'}}>Directory</span></h2>
                  <p style={{color:'var(--text-muted)', fontSize:'0.9rem', marginTop:'0.25rem'}}>Manage bank personnel, department assignment routing, and access control.</p>
                </div>
              </div>
              
              <div className="card" style={{padding:'2rem', background: 'linear-gradient(145deg, rgba(16,20,30,1) 0%, rgba(20,25,35,1) 100%)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>
                <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.5rem'}}>
                  <User size={20} color="var(--primary-blue)"/>
                  <h3 style={{fontSize:'1.1rem', color:'var(--text-primary)', fontWeight: '600'}}>Onboard New Employee</h3>
                </div>
                
                <form onSubmit={handleCreateEmployee} style={{display:'flex', flexWrap: 'wrap', gap:'1.5rem', alignItems:'flex-end'}}>
                  <div style={{flex: '2 1 200px'}}>
                    <label style={{display:'block', fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'600'}}>Full Name</label>
                    <input type="text" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="e.g. Jane Doe" required style={{width:'100%', padding:'0.75rem 1rem', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'var(--text-primary)', outline:'none'}} />
                  </div>
                  <div style={{flex: '1 1 150px'}}>
                    <label style={{display:'block', fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'600'}}>Department (Team)</label>
                    <select value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} style={{width:'100%', padding:'0.75rem 1rem', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'var(--text-primary)', outline:'none', cursor:'pointer', appearance: 'auto'}}>
                      <option value="IT" style={{background: '#1a1f2e', color: '#fff'}}>IT</option>
                      <option value="Risk" style={{background: '#1a1f2e', color: '#fff'}}>Risk</option>
                      <option value="Compliance" style={{background: '#1a1f2e', color: '#fff'}}>Compliance</option>
                      <option value="Legal" style={{background: '#1a1f2e', color: '#fff'}}>Legal</option>
                      <option value="Operations" style={{background: '#1a1f2e', color: '#fff'}}>Operations</option>
                    </select>
                  </div>
                  <div style={{flex: '1 1 150px'}}>
                    <label style={{display:'block', fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'600'}}>Sub-Team</label>
                    {!isCustomSubTeam ? (
                      <select 
                        value={newEmployee.email} 
                        onChange={e => {
                          if(e.target.value === '__custom__') {
                            setIsCustomSubTeam(true);
                            setNewEmployee({...newEmployee, email: ''});
                          } else {
                            setNewEmployee({...newEmployee, email: e.target.value});
                          }
                        }} 
                        style={{width:'100%', padding:'0.75rem 1rem', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'var(--text-primary)', outline:'none', cursor:'pointer', appearance: 'auto'}}
                      >
                        <option value="" style={{background: '#1a1f2e', color: '#fff'}}>General</option>
                        <option value="Cybersecurity" style={{background: '#1a1f2e', color: '#fff'}}>Cybersecurity</option>
                        <option value="Data Privacy" style={{background: '#1a1f2e', color: '#fff'}}>Data Privacy</option>
                        <option value="Audit" style={{background: '#1a1f2e', color: '#fff'}}>Audit</option>
                        <option value="KYC/AML" style={{background: '#1a1f2e', color: '#fff'}}>KYC/AML</option>
                        <option value="__custom__" style={{background: '#1a1f2e', color: '#3b82f6', fontWeight:'bold'}}>+ Add Custom...</option>
                      </select>
                    ) : (
                      <div style={{display:'flex', gap:'0.5rem'}}>
                        <input 
                          type="text" 
                          value={newEmployee.email} 
                          onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} 
                          placeholder="Custom Sub-Team" 
                          autoFocus
                          style={{flex: 1, padding:'0.75rem 1rem', background:'rgba(0,0,0,0.3)', border:'1px solid var(--primary-blue)', borderRadius:'6px', color:'var(--text-primary)', outline:'none'}} 
                        />
                        <button 
                          type="button" 
                          onClick={() => { setIsCustomSubTeam(false); setNewEmployee({...newEmployee, email: ''}); }}
                          style={{background:'rgba(239,68,68,0.2)', border:'none', color:'#fca5a5', borderRadius:'6px', padding:'0 0.75rem', cursor:'pointer'}}
                        >
                          <X size={16}/>
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{flex: '1 1 150px'}}>
                    <label style={{display:'block', fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'600'}}>Role / Level</label>
                    <select value={newEmployee.level} onChange={e => setNewEmployee({...newEmployee, level: e.target.value})} style={{width:'100%', padding:'0.75rem 1rem', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'var(--text-primary)', outline:'none', cursor:'pointer', appearance: 'auto'}}>
                      <option value="Head" style={{background: '#1a1f2e', color: '#fff'}}>Head</option>
                      <option value="Manager" style={{background: '#1a1f2e', color: '#fff'}}>Manager</option>
                      <option value="Analyst" style={{background: '#1a1f2e', color: '#fff'}}>Analyst</option>
                    </select>
                  </div>
                  <button type="submit" className="btn" style={{padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'0.5rem', fontWeight:'600', height:'43px', minWidth: '120px', justifyContent:'center'}}>
                    <Plus size={16}/> Add User
                  </button>
                </form>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1.5rem', marginTop: '1rem', overflowY: 'auto', paddingBottom: '1rem'}}>
                {employees.map(emp => (
                  <div key={emp.id} className="card" style={{padding:'1.5rem', display:'flex', alignItems:'center', gap:'1.25rem', borderLeft: `4px solid ${deptColors[emp.department] || 'var(--primary-blue)'}`, transition:'transform 0.2s', cursor:'default'}} onMouseOver={e => e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform='translateY(0)'}>
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random&rounded=true&size=64`} alt={emp.name} style={{width:'56px', height:'56px', borderRadius:'50%', border:'2px solid rgba(255,255,255,0.1)'}} />
                    <div style={{flex: 1}}>
                      <h4 style={{fontSize:'1.1rem', color:'var(--text-primary)', marginBottom:'0.25rem', fontWeight:'600'}}>{emp.name}</h4>
                      <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem'}}>
                        <span style={{fontSize:'0.75rem', padding:'2px 8px', borderRadius:'12px', background:'rgba(255,255,255,0.1)', color:'var(--text-secondary)'}}>{emp.level}</span>
                        <span style={{fontSize:'0.75rem', padding:'2px 8px', borderRadius:'12px', background:`${deptColors[emp.department] || 'var(--primary-amber)'}22`, color: deptColors[emp.department] || 'var(--primary-amber)'}}>{emp.department}</span>
                      </div>
                      <div style={{fontSize:'0.8rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'0.4rem', marginTop: '0.5rem'}}>
                        <Users size={12} style={{opacity: 0.7}}/> {emp.email && !emp.email.includes('@') ? emp.email : 'General Sub-Team'}
                      </div>
                    </div>
                  </div>
                ))}
                {employees.length === 0 && (
                  <div style={{gridColumn: '1 / -1', padding:'3rem', textAlign:'center', color:'var(--text-muted)', background:'rgba(0,0,0,0.2)', borderRadius:'8px', border:'1px dashed rgba(255,255,255,0.1)'}}>
                    <Users size={32} style={{margin:'0 auto 1rem auto', opacity:0.5}}/>
                    <p>No personnel found in the directory.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'knowledgebase' && (
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', height:'100%'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <h2 style={{fontSize:'1.5rem', color:'var(--primary-amber)', fontFamily:'var(--font-data)', letterSpacing:'0.05em'}}>WORKING DOCS</h2>
                  <p style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.25rem'}}>
                    Bank's existing policies, SOPs, and evidence. Auto-matched against incoming circulars.
                  </p>
                </div>
                <button className="btn-initiate" style={{width:'auto', padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'0.5rem'}} onClick={() => setKbUploadOpen(true)}>
                  <Plus size={16} /> ADD DOCUMENT
                </button>
              </div>

              {/* Upload Modal */}
              {kbUploadOpen && (
                <div className="upload-overlay" onClick={() => setKbUploadOpen(false)}>
                  <div className="upload-modal" onClick={e => e.stopPropagation()}>
                    <h2>Add Working Document</h2>
                    <p>Upload existing bank documents so the Gap Analyzer can auto-match them.</p>
                    <div style={{display:'flex', flexDirection:'column', gap:'1rem', textAlign:'left'}}>
                      <div>
                        <label style={{fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em'}}>Document Title</label>
                        <input type="text" value={kbTitle} onChange={e => setKbTitle(e.target.value)} placeholder="e.g. IT Governance SOP v3.2"
                          style={{width:'100%', padding:'0.75rem', background:'rgba(0,0,0,0.5)', border:'1px solid var(--border-glass)', borderRadius:'2px', color:'white', fontFamily:'var(--font-data)', marginTop:'0.25rem'}} />
                      </div>
                      <div style={{display:'flex', gap:'1rem'}}>
                        <div style={{flex:1}}>
                          <label style={{fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em'}}>Department</label>
                          <select value={kbDept} onChange={e => setKbDept(e.target.value)}
                            style={{width:'100%', padding:'0.75rem', background:'rgba(0,0,0,0.5)', border:'1px solid var(--border-glass)', borderRadius:'2px', color:'white', fontFamily:'var(--font-data)', marginTop:'0.25rem'}}>
                            <option value="IT" style={{background: '#1a1f2e', color: '#fff'}}>IT / Technology</option>
                            <option value="Risk" style={{background: '#1a1f2e', color: '#fff'}}>Risk Management</option>
                            <option value="Operations" style={{background: '#1a1f2e', color: '#fff'}}>Operations</option>
                            <option value="Legal" style={{background: '#1a1f2e', color: '#fff'}}>Legal</option>
                            <option value="Compliance" style={{background: '#1a1f2e', color: '#fff'}}>Compliance</option>
                            <option value="Treasury" style={{background: '#1a1f2e', color: '#fff'}}>Treasury</option>
                            <option value="Finance" style={{background: '#1a1f2e', color: '#fff'}}>Finance & Accounts</option>
                            <option value="CISO" style={{background: '#1a1f2e', color: '#fff'}}>CISO / InfoSec</option>
                            <option value="__other__" style={{background: '#1a1f2e', color: '#3b82f6'}}>✏️ Other</option>
                          </select>
                          {kbDept === '__other__' && <input type="text" value={kbDeptCustom} onChange={e => setKbDeptCustom(e.target.value)} placeholder="Custom department..." style={{width:'100%', padding:'0.5rem', background:'rgba(234,179,8,0.05)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:'2px', color:'var(--primary-amber)', fontFamily:'var(--font-data)', marginTop:'0.5rem', fontSize:'0.8rem'}} />}
                        </div>
                        <div style={{flex:1}}>
                          <label style={{fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em'}}>Category</label>
                          <select value={kbCategory} onChange={e => setKbCategory(e.target.value)}
                            style={{width:'100%', padding:'0.75rem', background:'rgba(0,0,0,0.5)', border:'1px solid var(--border-glass)', borderRadius:'2px', color:'white', fontFamily:'var(--font-data)', marginTop:'0.25rem'}}>
                            <option value="Policy" style={{background: '#1a1f2e', color: '#fff'}}>Policy Document</option>
                            <option value="SOP" style={{background: '#1a1f2e', color: '#fff'}}>SOP / Procedure</option>
                            <option value="Circular" style={{background: '#1a1f2e', color: '#fff'}}>Internal Circular</option>
                            <option value="Guidelines" style={{background: '#1a1f2e', color: '#fff'}}>Guidelines / Manual</option>
                            <option value="Committee Minutes" style={{background: '#1a1f2e', color: '#fff'}}>Committee Minutes</option>
                            <option value="Audit Report" style={{background: '#1a1f2e', color: '#fff'}}>Audit Report</option>
                            <option value="Certificate" style={{background: '#1a1f2e', color: '#fff'}}>Certificate / License</option>
                            <option value="__other__" style={{background: '#1a1f2e', color: '#3b82f6'}}>✏️ Other</option>
                          </select>
                          {kbCategory === '__other__' && <input type="text" value={kbCatCustom} onChange={e => setKbCategoryCustom(e.target.value)} placeholder="Custom category..." style={{width:'100%', padding:'0.5rem', background:'rgba(234,179,8,0.05)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:'2px', color:'var(--primary-amber)', fontFamily:'var(--font-data)', marginTop:'0.5rem', fontSize:'0.8rem'}} />}
                        </div>
                      </div>
                      <div className="dz-box" onClick={() => kbFileRef.current.click()}>
                        <UploadCloud size={32} style={{color:'var(--primary-amber)', marginBottom:'0.5rem'}} />
                        <p style={{color:'var(--text-muted)'}}>
                          {kbSelectedFile ? kbSelectedFile.name : "Click to select file (PDF, TXT)"}
                        </p>
                        <input type="file" ref={kbFileRef} style={{display:'none'}} accept=".pdf,.txt" onChange={(e) => setKbSelectedFile(e.target.files[0])} />
                      </div>
                      <div style={{display:'flex', gap:'1rem', justifyContent:'flex-end'}}>
                        <button className="btn-close" onClick={() => setKbUploadOpen(false)}>Cancel</button>
                        <button className="btn-initiate" style={{width:'auto', padding:'0.75rem 2rem'}} onClick={handleKbUpload} disabled={kbUploading}>
                          {kbUploading ? <><RefreshCw className="spin" size={14} /> INDEXING...</> : 'UPLOAD & INDEX'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Grid */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1rem', overflowY:'auto', flex:1}}>
                {kbDocs.map(doc => (
                  <div key={doc.id} className="widget-card" style={{height:'auto', cursor:'default'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem'}}>
                      <div>
                        <div style={{fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color: deptColors[doc.department] || 'var(--primary-amber)', fontFamily:'var(--font-data)', fontWeight:700, marginBottom:'0.25rem'}}>{doc.department}</div>
                        <h4 style={{fontSize:'0.95rem', fontWeight:600}}>{doc.title}</h4>
                      </div>
                      <button onClick={() => handleKbDelete(doc.id)} style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px'}}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{fontSize:'0.7rem', padding:'2px 6px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', display:'inline-block', color:'var(--text-muted)', fontFamily:'var(--font-data)', marginBottom:'0.75rem'}}>{doc.category}</div>
                    <p style={{fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.5, marginBottom:'1rem'}}>{doc.ai_summary}</p>
                    
                    {kbAskDocId === doc.id ? (
                      <div style={{borderTop:'1px solid var(--border-glass)', paddingTop:'0.75rem'}}>
                        <div style={{display:'flex', gap:'0.5rem', marginBottom:'0.5rem'}}>
                          <input type="text" value={kbQuestion} onChange={e => setKbQuestion(e.target.value)} placeholder="Ask about this document..."
                            onKeyDown={e => e.key === 'Enter' && handleKbAsk()}
                            style={{flex:1, background:'rgba(0,0,0,0.4)', border:'1px solid var(--border-glass)', borderRadius:'2px', padding:'0.4rem 0.75rem', color:'white', fontFamily:'var(--font-data)', fontSize:'0.75rem'}} />
                          <button onClick={handleKbAsk} style={{background:'var(--primary-amber)', border:'none', borderRadius:'2px', width:'32px', height:'32px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                            {kbAsking ? <RefreshCw className="spin" size={12} color="#000" /> : <Send size={12} color="#000" />}
                          </button>
                          <button onClick={() => { setKbAskDocId(null); setKbAnswer(''); }} style={{background:'transparent', border:'1px solid var(--border-glass)', borderRadius:'2px', width:'32px', height:'32px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <X size={12} color="white" />
                          </button>
                        </div>
                        {kbAnswer && <div style={{fontSize:'0.8rem', color:'var(--primary-amber)', background:'rgba(234,179,8,0.05)', padding:'0.75rem', borderRadius:'2px', lineHeight:1.5, border:'1px solid rgba(234,179,8,0.2)'}}>{kbAnswer}</div>}
                      </div>
                    ) : (
                      <div style={{display:'flex', gap:'0.5rem'}}>
                        <button onClick={() => { setKbAskDocId(doc.id); setKbQuestion(''); setKbAnswer(''); }}
                          style={{flex:1, background:'rgba(255,255,255,0.03)', border:'1px dashed var(--border-glass)', color:'var(--text-muted)', padding:'0.5rem', borderRadius:'2px', cursor:'pointer', fontFamily:'var(--font-data)', fontSize:'0.7rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem'}}>
                          <MessageSquare size={12} /> ASK AI
                        </button>
                        <button onClick={() => handleKbRead(doc.id, doc.title)}
                          style={{flex:1, background:'rgba(255,255,255,0.03)', border:'1px dashed var(--border-glass)', color:'var(--text-muted)', padding:'0.5rem', borderRadius:'2px', cursor:'pointer', fontFamily:'var(--font-data)', fontSize:'0.7rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem'}}>
                          {kbReading && kbReadTitle === doc.title ? <RefreshCw className="spin" size={12} /> : <FileText size={12} />} READ
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                {kbDocs.length === 0 && (
                  <div style={{gridColumn:'1 / -1', textAlign:'center', padding:'4rem 2rem', color:'var(--text-muted)'}}>
                    <FolderOpen size={48} style={{margin:'0 auto 1rem', opacity:0.3}} />
                    <h3 style={{marginBottom:'0.5rem'}}>No documents in Knowledge Base</h3>
                    <p style={{fontSize:'0.85rem'}}>Upload your bank's existing policies, SOPs, and evidence documents.</p>
                    <button className="btn-initiate" style={{width:'auto', padding:'0.75rem 2rem', margin:'1.5rem auto 0'}} onClick={() => setKbUploadOpen(true)}>
                      <Plus size={16} style={{display:'inline', marginRight:'4px'}} /> ADD FIRST DOCUMENT
                    </button>
                  </div>
                )}
              </div>

              {/* Read Document Modal */}
              {kbReadModalOpen && (
                <div className="upload-overlay" onClick={() => setKbReadModalOpen(false)}>
                  <div className="upload-modal" style={{maxWidth:'800px', width:'90%', height:'80vh', display:'flex', flexDirection:'column'}} onClick={e => e.stopPropagation()}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', paddingBottom:'1rem', borderBottom:'1px solid var(--border-glass)'}}>
                      <h2 style={{fontSize:'1.2rem'}}>{kbReadTitle}</h2>
                      <button onClick={() => setKbReadModalOpen(false)} style={{background:'transparent', border:'none', color:'white', cursor:'pointer'}}>
                        <X size={20} />
                      </button>
                    </div>
                    <div style={{flex:1, overflowY:'auto', background:'rgba(0,0,0,0.5)', padding:'1rem', borderRadius:'4px', border:'1px solid var(--border-glass)', fontFamily:'monospace', fontSize:'0.85rem', lineHeight:1.6, whiteSpace:'pre-wrap', color:'var(--text-muted)'}}>
                      {kbReading ? (
                        <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>
                          <RefreshCw className="spin" size={24} style={{color:'var(--primary-amber)'}} />
                        </div>
                      ) : (
                        kbReadContent
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ AUDIT LOGS VIEW ═══ */}
          {currentView === 'auditlogs' && (
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', height:'100%'}}>
              <div>
                <h2 style={{fontSize:'1.5rem', color:'var(--primary-amber)', fontFamily:'var(--font-data)', letterSpacing:'0.05em'}}>AUDIT LOGS</h2>
                <p style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.25rem'}}>
                  Immutable ledger of all validations and system actions.
                </p>
              </div>
              <div style={{flex:1, overflowY:'auto', background:'rgba(0,0,0,0.2)', border:'1px solid var(--border-glass)', borderRadius:'4px'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.8rem'}}>
                  <thead style={{background:'rgba(0,0,0,0.5)', textAlign:'left', borderBottom:'1px solid var(--border-glass)'}}>
                    <tr>
                      <th style={{padding:'1rem', color:'var(--text-muted)', fontWeight:'normal'}}>TIME</th>
                      <th style={{padding:'1rem', color:'var(--text-muted)', fontWeight:'normal'}}>MAP</th>
                      <th style={{padding:'1rem', color:'var(--text-muted)', fontWeight:'normal'}}>ACTION</th>
                      <th style={{padding:'1rem', color:'var(--text-muted)', fontWeight:'normal'}}>RESULT</th>
                      <th style={{padding:'1rem', color:'var(--text-muted)', fontWeight:'normal'}}>REASONING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogsData.map((log) => (
                      <tr key={log.id} style={{borderBottom:'1px solid var(--border-glass)'}}>
                        <td style={{padding:'1rem', color:'var(--text-muted)'}}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td style={{padding:'1rem'}}>{log.map_title}</td>
                        <td style={{padding:'1rem'}}>{log.action}</td>
                        <td style={{padding:'1rem'}}>
                          <span style={{padding:'2px 6px', borderRadius:'2px', background: log.result === 'pass' ? 'rgba(34,197,94,0.1)' : log.result === 'extended' ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.1)', color: log.result === 'pass' ? 'var(--success-green)' : log.result === 'extended' ? '#a5b4fc' : '#fca5a5'}}>
                            {log.result === 'pass' ? 'VERIFIED' : log.result === 'extended' ? 'EXTENDED' : log.result ? log.result.toUpperCase() : 'UNKNOWN'}
                          </span>
                        </td>
                        <td style={{padding:'1rem', color:'var(--text-muted)', maxWidth:'300px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={log.reasoning}>{log.reasoning}</td>
                      </tr>
                    ))}
                    {auditLogsData.length === 0 && (
                      <tr><td colSpan="5" style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>No audit logs found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ SETTINGS VIEW ═══ */}
          {currentView === 'settings' && (
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', height:'100%'}}>
              <div>
                <h2 style={{fontSize:'1.5rem', color:'var(--primary-amber)', fontFamily:'var(--font-data)', letterSpacing:'0.05em'}}>SYSTEM SETTINGS</h2>
                <p style={{color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.25rem'}}>
                  Manage demo data and configuration.
                </p>
              </div>
              <div style={{display:'flex', gap:'1rem'}}>
                <div className="widget-card" style={{flex:1, height:'auto'}}>
                  <div className="widget-header"><span>Demo Data Management</span></div>
                  <p style={{fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'1rem'}}>Populate the system with mock circulars, MAPs, and Knowledge Base policies.</p>
                  <button className="btn-initiate" style={{width:'auto', padding:'0.5rem 1rem', marginBottom:'0.5rem', display:'block'}} onClick={handleDemoPopulate}>
                    POPULATE DEMO DATA
                  </button>
                  <button className="btn-close" style={{width:'auto', padding:'0.5rem 1rem', display:'block', background:'rgba(239,68,68,0.1)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)'}} onClick={handleDemoReset}>
                    WIPE DATABASE
                  </button>
                </div>
                <div className="widget-card" style={{flex:1, height:'auto'}}>
                  <div className="widget-header"><span>AI Agent Configuration</span></div>
                  <p style={{fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'1rem'}}>Local LLM endpoint (Ollama).</p>
                  <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                    <label style={{fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Ollama URL</label>
                    <input type="text" value="http://localhost:11434" disabled style={{padding:'0.5rem', background:'rgba(0,0,0,0.5)', border:'1px solid var(--border-glass)', color:'white', borderRadius:'2px'}} />
                    <label style={{fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', marginTop:'0.5rem'}}>Primary Model</label>
                    <input type="text" value="llama3.2" disabled style={{padding:'0.5rem', background:'rgba(0,0,0,0.5)', border:'1px solid var(--border-glass)', color:'white', borderRadius:'2px'}} />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ═══ COST BREAKDOWN MODAL ═══ */}
      {costModalOpen && (
        <div className="upload-overlay" onClick={() => setCostModalOpen(false)}>
          <div className="upload-modal" style={{width:'600px', maxHeight:'80vh', display:'flex', flexDirection:'column'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', paddingBottom:'1rem', borderBottom:'1px solid var(--border-glass)'}}>
              <div>
                <h2 style={{fontSize:'1.2rem', color:'#ff9d9d'}}>Live Penalty & Cost Exposure</h2>
                <p style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>Potential regulatory fines vs. implementation cost.</p>
              </div>
              <button onClick={() => setCostModalOpen(false)} style={{background:'transparent', border:'none', color:'white', cursor:'pointer'}}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem'}}>
              <div style={{background:'rgba(255,157,157,0.1)', border:'1px solid rgba(255,157,157,0.2)', padding:'1rem', borderRadius:'4px'}}>
                <div style={{fontSize:'0.75rem', color:'#ff9d9d', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.5rem'}}>Potential Fines</div>
                <div style={{fontSize:'1.5rem', fontFamily:'var(--font-data)', color:'#ff9d9d'}}>{formatCurrencyCompact(penaltyTickerVal)}</div>
              </div>
              <div style={{background:'rgba(234,179,8,0.1)', border:'1px solid rgba(234,179,8,0.2)', padding:'1rem', borderRadius:'4px'}}>
                <div style={{fontSize:'0.75rem', color:'var(--primary-amber)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.5rem'}}>Est. Implementation Cost</div>
                <div style={{fontSize:'1.5rem', fontFamily:'var(--font-data)', color:'var(--primary-amber)'}}>{formatCurrencyCompact(totalCost)}</div>
              </div>
            </div>

            <div style={{flex:1, overflowY:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.8rem'}}>
                <thead style={{background:'rgba(0,0,0,0.5)', textAlign:'left', borderBottom:'1px solid var(--border-glass)'}}>
                  <tr>
                    <th style={{padding:'0.75rem', color:'var(--text-muted)', fontWeight:'normal'}}>Task ID</th>
                    <th style={{padding:'0.75rem', color:'var(--text-muted)', fontWeight:'normal'}}>Department</th>
                    <th style={{padding:'0.75rem', color:'var(--text-muted)', fontWeight:'normal'}}>Effort</th>
                    <th style={{padding:'0.75rem', color:'var(--text-muted)', fontWeight:'normal'}}>Cost (₹2,500/hr)</th>
                  </tr>
                </thead>
                <tbody>
                  {allTasks.filter(t => t.cost_estimate > 0).map((t) => (
                    <tr key={t.id} style={{borderBottom:'1px solid var(--border-glass)'}}>
                      <td style={{padding:'0.75rem', color:'var(--text-muted)', fontFamily:'var(--font-data)'}}>TSK-{String(t.id).padStart(3,'0')}</td>
                      <td style={{padding:'0.75rem'}}>
                        <span style={{fontFamily:'var(--font-data)', fontSize:'0.7rem', padding:'2px 6px', borderRadius:'2px', background:`${deptColors[t.department] || '#eab308'}22`, color: deptColors[t.department] || '#eab308'}}>
                          {t.department}
                        </span>
                      </td>
                      <td style={{padding:'0.75rem', fontFamily:'var(--font-data)'}}>{t.estimated_effort_hours} hrs</td>
                      <td style={{padding:'0.75rem', fontFamily:'var(--font-data)', color:'var(--primary-amber)'}}>{formatCurrencyCompact(t.cost_estimate)}</td>
                    </tr>
                  ))}
                  {allTasks.filter(t => t.cost_estimate > 0).length === 0 && (
                    <tr><td colSpan="4" style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>No costed tasks found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXTENSION REQUEST MODAL ═══ */}
      {extendModalOpen && (
        <div className="upload-overlay" onClick={() => setExtendModalOpen(false)}>
          <div className="upload-modal" style={{width:'400px'}} onClick={e => e.stopPropagation()}>
            <h2>Request Extension</h2>
            <p>Set a new deadline for task TSK-{String(extendMapId).padStart(3,'0')}</p>
            <div style={{display:'flex', flexDirection:'column', gap:'1rem', textAlign:'left'}}>
              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em'}}>New Deadline</label>
                <input type="date" value={extendDate} onChange={e => setExtendDate(e.target.value)}
                  style={{width:'100%', padding:'0.75rem', background:'rgba(0,0,0,0.5)', border:'1px solid var(--border-glass)', borderRadius:'2px', color:'white', fontFamily:'var(--font-data)', marginTop:'0.25rem'}} />
              </div>
              <div>
                <label style={{fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em'}}>Reason</label>
                <textarea value={extendReason} onChange={e => setExtendReason(e.target.value)} placeholder="Why is an extension needed?"
                  rows={3} style={{width:'100%', padding:'0.75rem', background:'rgba(0,0,0,0.5)', border:'1px solid var(--border-glass)', borderRadius:'2px', color:'white', fontFamily:'var(--font-data)', marginTop:'0.25rem', resize:'vertical'}} />
              </div>
              <div style={{display:'flex', gap:'1rem', justifyContent:'flex-end'}}>
                <button className="btn-close" onClick={() => setExtendModalOpen(false)}>Cancel</button>
                <button className="btn-initiate" style={{width:'auto', padding:'0.75rem 2rem', background: 'var(--primary-blue)', color: '#fff', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'}} onClick={handleExtend}>
                  SUBMIT REQUEST
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
