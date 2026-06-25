import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  CheckCircle, ShieldCheck, Activity, Search, Bell, Shield, User, 
  UploadCloud, FileText, Settings, History, LayoutDashboard,
  Check, RefreshCw, Zap, Database, BookOpen, MessageSquare, 
  Send, Trash2, X, Plus, FolderOpen
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

  const [kbSelectedFile, setKbSelectedFile] = useState(null);
  const [kbReadContent, setKbReadContent] = useState(null);
  const [kbReadTitle, setKbReadTitle] = useState('');
  const [kbReading, setKbReading] = useState(false);
  const [kbReadModalOpen, setKbReadModalOpen] = useState(false);

  const addLog = (tag, msg) => {
    setAgentLogs(prev => [...prev.slice(-50), { ts: new Date().toLocaleTimeString(), tag, msg }]);
  };

  useEffect(() => {
    fetchStats();
    fetchCirculars();
    fetchKbDocs();
  }, []);

  // Dynamic penalty from MAPs
  useEffect(() => {
    if (result && result.generated_maps) {
      let total = 0;
      result.generated_maps.forEach(m => {
        if (m.status === 'Validated_Pass' || m.status === 'Already_Compliant') return; // compliant = no risk
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

  const formatCurrencyCompact = (val) => {
    if(val >= 10000000) return '₹' + (val / 10000000).toFixed(1) + ' Cr';
    if(val >= 100000) return '₹' + (val / 100000).toFixed(1) + ' L';
    if(val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if(val >= 1000) return '$' + (val / 1000).toFixed(0) + 'K';
    if(val === 0) return '₹0';
    return '$' + val;
  };

  // Readiness
  const totalMaps = (stats.pending_maps || 0) + (stats.validated_maps || 0);
  const readiness = totalMaps === 0 ? 100 : Math.round((stats.validated_maps / totalMaps) * 100);
  const ringOffset = 377 - ((377 * readiness) / 100);

  // Kanban columns
  const maps = result?.generated_maps || [];
  const alreadyCompliant = maps.filter(m => m.status === 'Already_Compliant' || m.gap_status === 'ALREADY_COMPLIANT');
  const inProgress = maps.filter(m => m.status !== 'Already_Compliant' && m.gap_status !== 'ALREADY_COMPLIANT' && !validationResults[m.id]);
  const awaiting = maps.filter(m => validationResults[m.id]?.loading);
  const validated = maps.filter(m => validationResults[m.id] && !validationResults[m.id].loading);

  const deptColors = {
    IT: '#6366f1', Risk: '#ef4444', Operations: '#eab308', Legal: '#22c55e', Compliance: '#06b6d4',
    Treasury: '#f97316', Finance: '#a855f7', Credit: '#ec4899', 'Retail Banking': '#14b8a6', 'Corporate Banking': '#8b5cf6',
    'Wealth Management': '#d946ef', HR: '#64748b', 'Internal Audit': '#f43f5e', CISO: '#0ea5e9', 'AML/KYC': '#fbbf24',
    'Customer Service': '#34d399', Board: '#facc15'
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
          <div className={`nav-item ${currentView === 'knowledgebase' ? 'active' : ''}`} onClick={() => { setCurrentView('knowledgebase'); fetchKbDocs(); }}>
            <BookOpen className="icon" size={18} /> Knowledge Base
            {stats.kb_docs > 0 && <span style={{marginLeft: 'auto', fontSize: '0.7rem', background: 'rgba(234,179,8,0.2)', padding: '2px 6px', borderRadius: '2px', color: 'var(--primary-amber)'}}>{stats.kb_docs}</span>}
          </div>
          <div className="nav-item">
            <History className="icon" size={18} /> Audit Logs
          </div>
          <div className="nav-item">
            <Settings className="icon" size={18} /> Settings
          </div>
          
          {/* Circulars in sidebar */}
          <div style={{padding: '1.5rem 2rem 0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', borderTop: '1px solid var(--border-glass)', marginTop: '1rem'}}>
            Circular Repository
          </div>
          {circularsList.map(c => (
            <div key={c.id} className={`nav-item ${result?.circular_id === c.id ? 'active' : ''}`} onClick={() => handleSelectCircular(c.id)}
              style={{paddingLeft: '2.5rem', fontSize: '0.8rem'}}>
              <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={c.filename}>{c.filename}</div>
            </div>
          ))}
        </nav>

        <div className="sidebar-action">
          <button className="btn-initiate" onClick={() => fileInputRef.current.click()}>INITIATE AUDIT</button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} accept=".pdf,.txt" />
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
              <Bell size={20} style={{color: 'var(--text-muted)', cursor: 'pointer'}} />
              <Shield size={20} style={{color: 'var(--text-muted)', cursor: 'pointer'}} />
              <User size={20} style={{color: 'var(--primary-amber)', cursor: 'pointer'}} />
           </div>
        </header>

        <div className="dashboard-content">

          {/* ═══ DASHBOARD VIEW ═══ */}
          {currentView === 'dashboard' && (
            <>
              {/* Top Widgets */}
              <div className="top-widgets">
                {/* Penalty Exposure */}
                <div className="widget-card">
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
                    {maps.length === 0 && [20,35,25,40,30].map((h,i) => <div key={i} className="bar" style={{height: `${h}%`, opacity: 0.2}}></div>)}
                  </div>
                  <div className="widget-footer"><span>MAPS: {maps.length}</span><span>GAPS: {inProgress.length}</span></div>
                </div>

                {/* Audit Readiness */}
                <div className="widget-card highlight">
                  <div className="widget-header"><span style={{color: 'var(--primary-amber)'}}>Audit Readiness</span><Settings size={16} color="var(--primary-amber)" /></div>
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

                {/* Pipeline Topology */}
                <div className="widget-card">
                  <div className="widget-header"><span>Pipeline Topology</span><Activity size={16} color="var(--text-muted)" /></div>
                  <div className="topology-list">
                    {pipelineNodes.map((node, i) => {
                      const isActive = pipelineActive && activeNode === i;
                      const isCompleted = pipelineActive && activeNode > i;
                      return (
                        <div key={node.id} className={`topo-node ${isActive ? 'active' : ''}`}>
                          <div className="node-dot" style={{background: isCompleted ? 'var(--success-green)' : ''}}></div>
                          <div className="node-line" style={{background: isCompleted ? 'var(--success-green)' : isActive ? 'var(--primary-amber)' : ''}}></div>
                          <div className="node-name">{node.label}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="widget-footer"><span>THROUGHPUT: 450/s</span><span>Q_DEPTH: {maps.length}</span></div>
                </div>
              </div>

              {loading && (
                <div style={{padding: '2rem', textAlign: 'center', color: 'var(--primary-amber)'}}>
                  <RefreshCw className="spin" size={32} style={{margin: '0 auto 1rem'}} />
                  <p style={{fontFamily: 'var(--font-data)'}}>PIPELINE ACTIVE — GAP ANALYSIS IN PROGRESS...</p>
                </div>
              )}

              {!loading && (
                <div className="bottom-split">
                  {/* Kanban */}
                  <div className="kanban-board">
                    <div className="kanban-header">
                      <span>Active Directives {result?.regulation ? `— ${result.regulation}` : ''}</span>
                      {/* Gap summary chips */}
                      {maps.length > 0 && (
                        <div style={{display: 'flex', gap: '0.5rem', fontSize: '0.7rem', fontFamily: 'var(--font-data)'}}>
                          <span style={{background: 'rgba(34,197,94,0.15)', color: 'var(--success-green)', padding: '2px 6px', borderRadius: '2px'}}>✓ COMPLIANT: {alreadyCompliant.length}</span>
                          <span style={{background: 'rgba(234,179,8,0.15)', color: 'var(--primary-amber)', padding: '2px 6px', borderRadius: '2px'}}>⚠ GAPS: {inProgress.length}</span>
                          <span style={{background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '2px'}}>✓ VALIDATED: {validated.length}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="kanban-cols">
                      <input type="file" ref={validateFileRef} style={{display: 'none'}} onChange={handleEvidenceUpload} accept=".pdf,.txt" />

                      {/* Col 1: In Progress (gaps) */}
                      <div className="k-col">
                        <div className="k-col-title">Action Required <span>{inProgress.length}</span></div>
                        {inProgress.map((m, i) => (
                          <div key={m.id} className={`k-card ${m.risk_category?.toLowerCase() === 'high' || m.gap_status === 'NEW_REQUIREMENT' ? 'high-risk' : 'med-risk'}`}>
                            <div className="kc-header">
                              <span className={`kc-badge ${m.gap_status === 'NEW_REQUIREMENT' ? 'high' : 'med'}`}>
                                {m.gap_status === 'NEW_REQUIREMENT' ? 'NEW REQ' : m.gap_status === 'NEEDS_MODIFICATION' ? 'MODIFY' : (m.risk_category || 'MED') + ' RISK'}
                              </span>
                              <span className="kc-id">TSK-{String(m.id).padStart(3, '0')}</span>
                            </div>
                            <div className="kc-title">{m.title}</div>
                            {m.gap_detail && <div style={{fontSize: '0.7rem', color: '#fca5a5', marginBottom: '0.5rem', fontStyle: 'italic'}}>Gap: {m.gap_detail}</div>}
                            <div className="kc-metrics">
                              <div className="kc-metric">Role: <span>{m.assignee_role || 'TBD'}</span></div>
                              <div className="kc-metric">Effort: <span>{m.estimated_effort_hours || '?'}hrs</span></div>
                              <div className="kc-metric">Exp: <span>{m.regulatory_fine_potential || 'TBD'}</span></div>
                            </div>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button className="btn-evidence" onClick={() => triggerDocumentValidation(m.id)} style={{flex: 1}}>
                                <UploadCloud size={14} style={{display: 'inline', marginRight: '6px'}}/> SUBMIT NEW
                              </button>
                              <button className="btn-evidence" onClick={() => setKbSelectMapId(kbSelectMapId === m.id ? null : m.id)} style={{flex: 1, background: 'rgba(99,102,241,0.1)'}}>
                                <FileText size={14} style={{display: 'inline', marginRight: '6px'}}/> SELECT KB DOC
                              </button>
                            </div>
                            {kbSelectMapId === m.id && (
                              <div style={{marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-glass)'}}>
                                <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontFamily: 'var(--font-data)'}}>Select saved document to validate against:</div>
                                <select 
                                  onChange={(e) => { if(e.target.value) handleKbValidation(m.id, e.target.value); }}
                                  style={{width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'white', padding: '0.4rem', borderRadius: '2px', fontSize: '0.75rem'}}>
                                  <option value="">-- Choose document --</option>
                                  {kbDocs.map(doc => (
                                    <option key={doc.id} value={doc.id}>{doc.department} - {doc.title}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Already Compliant items */}
                        {alreadyCompliant.map((m) => (
                          <div key={m.id} className="k-card" style={{borderLeftColor: 'var(--success-green)', opacity: 0.7}}>
                            <div className="kc-header">
                              <span className="kc-badge" style={{color: 'var(--success-green)', background: 'rgba(34,197,94,0.1)'}}>COMPLIANT</span>
                              <span className="kc-id">TSK-{String(m.id).padStart(3, '0')}</span>
                            </div>
                            <div className="kc-title" style={{textDecoration: 'line-through', opacity: 0.7}}>{m.title}</div>
                            {m.matched_document && m.matched_document !== 'None' && (
                              <div style={{fontSize: '0.7rem', color: 'var(--success-green)', marginTop: '0.25rem'}}>✓ Matched: {m.matched_document}</div>
                            )}
                          </div>
                        ))}
                        {!result && <div className="font-data" style={{color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', marginTop: '2rem'}}>AWAITING DIRECTIVE</div>}
                      </div>

                      {/* Col 2: Awaiting */}
                      <div className="k-col">
                        <div className="k-col-title">AI Validation <span>{awaiting.length}</span></div>
                        {awaiting.map((m) => (
                          <div key={m.id} className="k-card med-risk" style={{borderColor: 'var(--deep-indigo)', opacity: 0.8}}>
                            <div className="kc-header"><span className="kc-badge med">ANALYZING</span><span className="kc-id">TSK-{String(m.id).padStart(3, '0')}</span></div>
                            <div className="kc-title"><RefreshCw className="spin" size={14} style={{display: 'inline', marginRight:'4px'}} /> Analyzing Evidence</div>
                          </div>
                        ))}
                      </div>

                      {/* Col 3: Validated */}
                      <div className="k-col">
                        <div className="k-col-title">Validated <span>{validated.length}</span></div>
                        {validated.map((m) => {
                          const v = validationResults[m.id];
                          return (
                            <div key={m.id} className={`k-card ${v.result !== 'pass' ? 'high-risk' : ''}`} style={{borderLeftColor: v.result === 'pass' ? 'var(--success-green)' : 'var(--danger-red)'}}>
                              <div className="kc-header">
                                <span className="kc-badge" style={{color: v.result === 'pass' ? 'var(--success-green)' : '#fca5a5', background: v.result === 'pass' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}}>
                                  {v.result === 'pass' ? 'VERIFIED' : 'FAILED'}
                                </span>
                                <span className="kc-id">TSK-{String(m.id).padStart(3, '0')}</span>
                              </div>
                              <div className="kc-title">{m.title}</div>
                              <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem'}}>{v.reasoning}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Agent Logs */}
                  <div className="terminal-card">
                    <div className="term-header">AGENT LOGS</div>
                    <div className="term-body" ref={el => { if(el) el.scrollTop = el.scrollHeight; }}>
                      {agentLogs.map((log, i) => (
                        <div key={i} className="log-line">
                          <span className="log-ts">[{log.ts}]</span>
                          <span className={`log-tag tag-${log.tag.toLowerCase()}`}>[{log.tag}]</span>
                          <span className="log-msg">{log.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ KNOWLEDGE BASE VIEW ═══ */}
          {currentView === 'knowledgebase' && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <h2 style={{fontSize: '1.5rem', color: 'var(--primary-amber)', fontFamily: 'var(--font-data)', letterSpacing: '0.05em'}}>KNOWLEDGE BASE</h2>
                  <p style={{color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem'}}>
                    Bank's existing policies, SOPs, and evidence. Auto-matched against incoming circulars.
                  </p>
                </div>
                <button className="btn-initiate" style={{width: 'auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={() => setKbUploadOpen(true)}>
                  <Plus size={16} /> ADD DOCUMENT
                </button>
              </div>

              {/* Upload Modal */}
              {kbUploadOpen && (
                <div className="upload-overlay" onClick={() => setKbUploadOpen(false)}>
                  <div className="upload-modal" onClick={e => e.stopPropagation()}>
                    <h2>Add to Knowledge Base</h2>
                    <p>Upload existing bank documents so the Gap Analyzer can auto-match them.</p>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left'}}>
                      <div>
                        <label style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em'}}>Document Title</label>
                        <input type="text" value={kbTitle} onChange={e => setKbTitle(e.target.value)} placeholder="e.g. IT Governance SOP v3.2"
                          style={{width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-glass)', borderRadius: '2px', color: 'white', fontFamily: 'var(--font-data)', marginTop: '0.25rem'}} />
                      </div>
                      <div style={{display: 'flex', gap: '1rem'}}>
                        <div style={{flex: 1}}>
                          <label style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em'}}>Department</label>
                          <select value={kbDept} onChange={e => setKbDept(e.target.value)}
                            style={{width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-glass)', borderRadius: '2px', color: 'white', fontFamily: 'var(--font-data)', marginTop: '0.25rem'}}>
                            <optgroup label="Core Banking">
                              <option value="IT">IT / Technology</option>
                              <option value="Risk">Risk Management</option>
                              <option value="Operations">Operations</option>
                              <option value="Legal">Legal</option>
                              <option value="Compliance">Compliance</option>
                            </optgroup>
                            <optgroup label="Banking Functions">
                              <option value="Treasury">Treasury</option>
                              <option value="Finance">Finance & Accounts</option>
                              <option value="Credit">Credit / Lending</option>
                              <option value="Retail Banking">Retail Banking</option>
                              <option value="Corporate Banking">Corporate Banking</option>
                              <option value="Wealth Management">Wealth Management</option>
                            </optgroup>
                            <optgroup label="Support Functions">
                              <option value="HR">Human Resources</option>
                              <option value="Internal Audit">Internal Audit</option>
                              <option value="CISO">CISO / InfoSec</option>
                              <option value="AML/KYC">AML / KYC Cell</option>
                              <option value="Customer Service">Customer Service</option>
                              <option value="Board">Board / Management</option>
                            </optgroup>
                            <option value="__other__">✏️ Other (type below)</option>
                          </select>
                          {kbDept === '__other__' && (
                            <input type="text" value={kbDeptCustom} onChange={e => setKbDeptCustom(e.target.value)} placeholder="Type custom department..."
                              style={{width: '100%', padding: '0.5rem', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '2px', color: 'var(--primary-amber)', fontFamily: 'var(--font-data)', marginTop: '0.5rem', fontSize: '0.8rem'}} />
                          )}
                        </div>
                        <div style={{flex: 1}}>
                          <label style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em'}}>Category</label>
                          <select value={kbCategory} onChange={e => setKbCategory(e.target.value)}
                            style={{width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-glass)', borderRadius: '2px', color: 'white', fontFamily: 'var(--font-data)', marginTop: '0.25rem'}}>
                            <optgroup label="Documents">
                              <option value="Policy">Policy Document</option>
                              <option value="SOP">SOP / Procedure</option>
                              <option value="Circular">Internal Circular</option>
                              <option value="Guidelines">Guidelines / Manual</option>
                            </optgroup>
                            <optgroup label="Records">
                              <option value="Committee Minutes">Committee / Board Minutes</option>
                              <option value="Audit Report">Audit Report</option>
                              <option value="Inspection Report">RBI/SEBI Inspection Report</option>
                              <option value="Risk Assessment">Risk Assessment</option>
                            </optgroup>
                            <optgroup label="Evidence">
                              <option value="Certificate">Certificate / License</option>
                              <option value="Training Record">Training Record</option>
                              <option value="System Log">System Log / Config</option>
                              <option value="Vendor Contract">Vendor Contract / SLA</option>
                              <option value="Customer Notice">Customer Notice / Disclosure</option>
                            </optgroup>
                            <option value="__other__">✏️ Other (type below)</option>
                          </select>
                          {kbCategory === '__other__' && (
                            <input type="text" value={kbCatCustom} onChange={e => setKbCatCustom(e.target.value)} placeholder="Type custom category..."
                              style={{width: '100%', padding: '0.5rem', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '2px', color: 'var(--primary-amber)', fontFamily: 'var(--font-data)', marginTop: '0.5rem', fontSize: '0.8rem'}} />
                          )}
                        </div>
                      </div>
                      <div className="dz-box" onClick={() => kbFileRef.current.click()}>
                        <UploadCloud size={32} style={{color: 'var(--primary-amber)', marginBottom: '0.5rem'}} />
                        <p style={{color: 'var(--text-muted)'}}>
                          {kbSelectedFile ? kbSelectedFile.name : "Click to select file (PDF, TXT)"}
                        </p>
                        <input type="file" ref={kbFileRef} style={{display: 'none'}} accept=".pdf,.txt" onChange={(e) => setKbSelectedFile(e.target.files[0])} />
                      </div>
                      <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
                        <button className="btn-close" onClick={() => setKbUploadOpen(false)}>Cancel</button>
                        <button className="btn-initiate" style={{width: 'auto', padding: '0.75rem 2rem'}} onClick={handleKbUpload} disabled={kbUploading}>
                          {kbUploading ? <><RefreshCw className="spin" size={14} /> INDEXING...</> : 'UPLOAD & INDEX'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Grid */}
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', overflowY: 'auto', flex: 1}}>
                {kbDocs.map(doc => (
                  <div key={doc.id} className="widget-card" style={{height: 'auto', cursor: 'default'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem'}}>
                      <div>
                        <div style={{fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: deptColors[doc.department] || 'var(--primary-amber)', fontFamily: 'var(--font-data)', fontWeight: 700, marginBottom: '0.25rem'}}>{doc.department}</div>
                        <h4 style={{fontSize: '0.95rem', fontWeight: 600}}>{doc.title}</h4>
                      </div>
                      <button onClick={() => handleKbDelete(doc.id)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px'}}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', display: 'inline-block', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', marginBottom: '0.75rem'}}>{doc.category}</div>
                    <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem'}}>{doc.ai_summary}</p>
                    
                    {/* Ask AI */}
                    {kbAskDocId === doc.id ? (
                      <div style={{borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem'}}>
                        <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem'}}>
                          <input type="text" value={kbQuestion} onChange={e => setKbQuestion(e.target.value)} placeholder="Ask about this document..."
                            onKeyDown={e => e.key === 'Enter' && handleKbAsk()}
                            style={{flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '2px', padding: '0.4rem 0.75rem', color: 'white', fontFamily: 'var(--font-data)', fontSize: '0.75rem'}} />
                          <button onClick={handleKbAsk} style={{background: 'var(--primary-amber)', border: 'none', borderRadius: '2px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            {kbAsking ? <RefreshCw className="spin" size={12} color="#000" /> : <Send size={12} color="#000" />}
                          </button>
                          <button onClick={() => { setKbAskDocId(null); setKbAnswer(''); }} style={{background: 'transparent', border: '1px solid var(--border-glass)', borderRadius: '2px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            <X size={12} color="white" />
                          </button>
                        </div>
                        {kbAnswer && <div style={{fontSize: '0.8rem', color: 'var(--primary-amber)', background: 'rgba(234,179,8,0.05)', padding: '0.75rem', borderRadius: '2px', lineHeight: 1.5, border: '1px solid rgba(234,179,8,0.2)'}}>{kbAnswer}</div>}
                      </div>
                    ) : (
                      <div style={{display: 'flex', gap: '0.5rem'}}>
                        <button onClick={() => { setKbAskDocId(doc.id); setKbQuestion(''); setKbAnswer(''); }}
                          style={{flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-glass)', color: 'var(--text-muted)', padding: '0.5rem', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font-data)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                          <MessageSquare size={12} /> ASK AI
                        </button>
                        <button onClick={() => handleKbRead(doc.id, doc.title)}
                          style={{flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-glass)', color: 'var(--text-muted)', padding: '0.5rem', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font-data)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
                          {kbReading && kbReadTitle === doc.title ? <RefreshCw className="spin" size={12} /> : <FileText size={12} />} READ
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                {kbDocs.length === 0 && (
                  <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)'}}>
                    <FolderOpen size={48} style={{margin: '0 auto 1rem', opacity: 0.3}} />
                    <h3 style={{marginBottom: '0.5rem'}}>No documents in Knowledge Base</h3>
                    <p style={{fontSize: '0.85rem'}}>Upload your bank's existing policies, SOPs, and evidence documents. The Gap Analyzer will auto-match them against future circulars.</p>
                    <button className="btn-initiate" style={{width: 'auto', padding: '0.75rem 2rem', margin: '1.5rem auto 0'}} onClick={() => setKbUploadOpen(true)}>
                      <Plus size={16} style={{display: 'inline', marginRight: '4px'}} /> ADD FIRST DOCUMENT
                    </button>
                  </div>
                )}
              </div>

              {/* Read Document Modal */}
              {kbReadModalOpen && (
                <div className="upload-overlay" onClick={() => setKbReadModalOpen(false)}>
                  <div className="upload-modal" style={{maxWidth: '800px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column'}} onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-glass)'}}>
                      <h2 style={{fontSize: '1.2rem'}}>{kbReadTitle}</h2>
                      <button onClick={() => setKbReadModalOpen(false)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}>
                        <X size={20} />
                      </button>
                    </div>
                    <div style={{flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-muted)'}}>
                      {kbReading ? (
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                          <RefreshCw className="spin" size={24} style={{color: 'var(--primary-amber)'}} />
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

        </div>
      </main>
    </div>
  );
};

export default App;
