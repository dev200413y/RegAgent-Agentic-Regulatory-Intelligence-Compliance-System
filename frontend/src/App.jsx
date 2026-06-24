import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, Clock, ShieldCheck, Activity, BarChart2, CheckSquare, AlertTriangle, FileText, MessageSquare, AlertOctagon, RefreshCw, Settings, Database, Trash2, Globe, FileWarning, Upload, LayoutDashboard } from 'lucide-react';
import './index.css';

const App = () => {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'admin'

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [trace, setTrace] = useState([]);
  const [stats, setStats] = useState({ total_circulars: 0, pending_maps: 0, validated_maps: 0 });
  const [circularsList, setCircularsList] = useState([]);
  
  // Ingestion Hub State (Admin)
  const [ingestionTab, setIngestionTab] = useState('circular'); // 'circular' or 'complaint'
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Complaint Result
  const [complaintResult, setComplaintResult] = useState(null);

  // Validation State (Document based)
  const [validatingMapId, setValidatingMapId] = useState(null);
  const [validationResults, setValidationResults] = useState({});
  const validateFileRef = useRef(null);
  
  // Chatbot
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchCirculars();
  }, [currentView]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('http://localhost:8000/stats');
      setStats(res.data);
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  const fetchCirculars = async () => {
    try {
      const res = await axios.get('http://localhost:8000/circulars');
      setCircularsList(res.data);
    } catch (e) {
      console.error("Failed to fetch circulars", e);
    }
  };

  const simulateTrace = (type = 'circular') => {
    setTrace([]);
    let messages = [];
    if (type === 'circular') {
      messages = [
        "[System] Circular detected. Uploading...",
        "[Monitor Agent] Extracting text from document...",
        "[Parser Agent] Parsing regulatory text via Local LLM...",
        "[Parser Agent] Extracting obligations & computing Penalty Risk...",
        "[MAP Generator] Converting obligations & prioritizing...",
        "[Assignment Engine] Routing MAPs to correct departments...",
        "[System] Pipeline complete."
      ];
    } else if (type === 'complaint') {
      messages = [
        "[System] Complaint Document Uploaded...",
        "[Complaint Agent] Reading and analyzing complaint text...",
        "[Complaint Agent] Cross-referencing against all active circulars...",
        "[Complaint Agent] Checking for compliance violations...",
        "[System] Analysis complete."
      ];
    } else if (type === 'scrape') {
       messages = [
        "[Monitor Agent] Initiating web scrape on RBI, SEBI, IRDAI domains...",
        "[Monitor Agent] CRITICAL: New Gazette Notification detected!",
        "[System] Automatically downloading circular...",
        "[Parser Agent] Parsing regulatory text...",
        "[MAP Generator] Generating Action Points...",
        "[System] Pipeline complete."
      ];
    }
    
    messages.forEach((msg, index) => {
      setTimeout(() => {
        setTrace(prev => [...prev, msg]);
      }, index * 1000);
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    setResult(null);
    setComplaintResult(null);
    setValidationResults({});
    setChatHistory([]);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      if (ingestionTab === 'circular') {
        simulateTrace('circular');
        const uploadRes = await axios.post('http://localhost:8000/upload', formData);
        const { filepath, circular_id } = uploadRes.data;
        const processRes = await axios.post('http://localhost:8000/process', { filepath, circular_id });
        
        setTimeout(() => {
          setResult({ ...processRes.data, circular_id });
          fetchStats();
          fetchCirculars();
          setLoading(false);
          setSelectedFile(null);
          // Auto switch to dashboard to see results
          setCurrentView('dashboard');
        }, 8000);

      } else if (ingestionTab === 'complaint') {
        simulateTrace('complaint');
        const compRes = await axios.post('http://localhost:8000/analyze-complaint', formData);
        
        setTimeout(() => {
          setComplaintResult(compRes.data);
          setLoading(false);
          setSelectedFile(null);
          setCurrentView('dashboard'); // Auto switch
        }, 6000);
      }
      
    } catch (error) {
      console.error("API Error", error);
      setLoading(false);
    }
  };

  const triggerDocumentValidation = (mapId) => {
    setValidatingMapId(mapId);
    validateFileRef.current.click();
  };

  const handleEvidenceUpload = async (e) => {
    if (!e.target.files || !e.target.files[0] || !validatingMapId) return;
    const evidenceFile = e.target.files[0];
    const mapId = validatingMapId;
    
    const formData = new FormData();
    formData.append('file', evidenceFile);
    formData.append('map_id', mapId);

    setValidationResults(prev => ({ ...prev, [mapId]: { loading: true } }));
    
    try {
      const res = await axios.post('http://localhost:8000/validate-doc', formData);
      setValidationResults(prev => ({ ...prev, [mapId]: res.data }));
      fetchStats();
    } catch (error) {
      console.error("Validation Error", error);
      setValidationResults(prev => ({ ...prev, [mapId]: null }));
    } finally {
      setValidatingMapId(null);
    }
  };

  const handleAskChatbot = async () => {
    if (!chatQuestion.trim() || !result?.circular_id) return;
    const userQ = chatQuestion;
    setChatHistory(prev => [...prev, { role: 'user', text: userQ }]);
    setChatQuestion("");
    setChatLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/chat', { circular_id: result.circular_id, question: userQ });
      setChatHistory(prev => [...prev, { role: 'ai', text: res.data.answer }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Error: Could not connect to AI Agent." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // --- DEMO TOOL FUNCTIONS (Admin Page) ---
  const handleDemoPopulate = async () => {
    await axios.post('http://localhost:8000/demo/populate');
    alert("System populated with mock data!");
  };

  const handleDemoReset = async () => {
    await axios.post('http://localhost:8000/demo/reset');
    setResult(null);
    setComplaintResult(null);
    setTrace([]);
    alert("Database wiped clean!");
  };

  const handleDemoSimulateScrape = async () => {
    setLoading(true);
    setResult(null);
    setComplaintResult(null);
    setValidationResults({});
    setChatHistory([]);
    simulateTrace('scrape');
    
    try {
      const scrapeRes = await axios.post('http://localhost:8000/demo/simulate-scrape');
      const processRes = await axios.post('http://localhost:8000/process', {
        filepath: scrapeRes.data.simulated_filepath,
        circular_id: scrapeRes.data.circular_id
      });
      setTimeout(() => {
        setResult({ ...processRes.data, circular_id: scrapeRes.data.circular_id });
        fetchStats();
        fetchCirculars();
        setLoading(false);
        setCurrentView('dashboard');
      }, 7000);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    const p = priority?.toLowerCase();
    if (p === 'critical') return 'priority-critical';
    if (p === 'high') return 'priority-high';
    if (p === 'low') return 'priority-low';
    return 'priority-medium';
  };

  // ------------------ RENDERING VIEWS ------------------

  const renderDashboard = () => (
    <>
      <header className="header">
        <h1>Live Compliance Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <ShieldCheck size={18} /> OS Active
          </span>
        </div>
      </header>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}><FileText size={24} /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.total_circulars}</div>
            <div className="stat-label">Circulars Processed</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}><AlertTriangle size={24} /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.pending_maps}</div>
            <div className="stat-label">Pending MAPs</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}><CheckSquare size={24} /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.validated_maps}</div>
            <div className="stat-label">Validated Compliant</div>
          </div>
        </div>
      </div>

      {/* COMPLAINT RESULT UI */}
      {complaintResult && (
        <div className={`complaint-card ${complaintResult.is_violation ? 'complaint-danger' : 'complaint-safe'}`}>
           <h2 style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
             {complaintResult.is_violation ? <AlertOctagon color="#ef4444" /> : <ShieldCheck color="#10b981" />}
             AI Complaint Analysis Alert
           </h2>
           <div className="complaint-detail">
             <strong>Violation Detected:</strong> {complaintResult.is_violation ? "YES" : "NO"}
           </div>
           {complaintResult.is_violation && (
             <>
              <div className="complaint-detail">
                <strong>Violated Circular:</strong> {complaintResult.violates_circular}
              </div>
              <div className="complaint-detail">
                <strong>Severity:</strong> <span className={`priority-badge ${getPriorityColor(complaintResult.severity)}`}>{complaintResult.severity}</span>
              </div>
             </>
           )}
           <div className="validation-reasoning" style={{marginTop: '1rem', fontSize: '1rem'}}>
              <strong>AI Reasoning:</strong> <br/> {complaintResult.reasoning}
           </div>
           <button className="btn-secondary" style={{width: '200px', marginTop: '2rem'}} onClick={() => {setComplaintResult(null); setCurrentView('admin');}}>Acknowledge & Clear</button>
        </div>
      )}

      {/* CIRCULAR RESULT UI */}
      {result && !loading && !complaintResult && (
        <div style={{ animation: 'fadeIn 0.5s forwards', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          
          <div style={{ flex: 2 }}>
            <div className="summary-banner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>{result.regulation || "Unknown"}</h2>
                <span className={`priority-badge ${getPriorityColor(result.generated_maps?.[0]?.priority)}`}>
                  Priority: {result.generated_maps?.[0]?.priority || "Medium"}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)' }}>{result.summary || "No summary available."}</p>
              <div className="penalty-risk">
                <AlertOctagon size={16} /> 
                <strong>Financial Penalty Risk Estimator:</strong> {result.penalty_risk || result.generated_maps?.[0]?.penalty_risk || "Assessing..."}
              </div>
            </div>

            <h3 style={{ marginBottom: '1rem', marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare size={20} color="var(--primary)" /> 
              Department Action Points ({result.generated_maps?.length || 0})
            </h3>
            
            {/* Hidden file input for Evidence Documents */}
            <input 
              type="file" 
              ref={validateFileRef} 
              style={{display: 'none'}} 
              onChange={handleEvidenceUpload} 
              accept=".pdf,.txt"
            />

            <div className="maps-grid">
              {result.generated_maps?.map((map, idx) => {
                const mapId = idx + 1; 
                const valResult = validationResults[mapId];

                return (
                  <div key={idx} className={`map-card ${valResult?.result === 'pass' ? 'map-pass' : valResult?.result === 'fail' ? 'map-fail' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="dept-badge dept-assigned">
                        {map.department}
                      </span>
                      {valResult && !valResult.loading && (
                        <span className={`validation-badge ${valResult.result === 'pass' ? 'badge-pass' : 'badge-fail'}`}>
                          {valResult.result === 'pass' ? '✅ COMPLIANT' : '❌ FAILED'}
                        </span>
                      )}
                      {valResult?.loading && (
                         <span className="validation-badge" style={{color: 'var(--primary)'}}>Analyzing Doc...</span>
                      )}
                    </div>
                    
                    <h4 className="map-title">{map.title}</h4>
                    <div className="map-detail"><strong>KPI:</strong> {map.kpi}</div>
                    <div className="map-detail"><strong>Evidence Needed:</strong> {map.evidence_required}</div>
                    
                    <div className="map-detail" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '1rem', color: 'var(--warning)' }}>
                      <Clock size={14} /> Due: {map.deadline || "Immediate"}
                    </div>

                    <div className="validation-section">
                      {!valResult ? (
                        <div style={{textAlign: 'center'}}>
                          <button 
                            className="btn-secondary" 
                            onClick={() => triggerDocumentValidation(mapId)}
                            style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}
                          >
                            <Upload size={16} /> Upload Evidence Doc to Validate
                          </button>
                          <p style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem'}}>AI will read the full document to verify compliance.</p>
                        </div>
                      ) : valResult.loading ? (
                        <div className="validation-reasoning pulse" style={{textAlign: 'center'}}>
                          Validator AI reading document...
                        </div>
                      ) : (
                        <div className="validation-reasoning">
                          <strong>Validator AI:</strong> {valResult.reasoning}
                          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: valResult.result === 'fail' ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {valResult.result === 'fail' && <span>⚠️ Escalation Email Drafted to {map.department} Head.</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chatbot Column */}
          <div className="chat-container">
            <div className="chat-header">
              <MessageSquare size={18} />
              Ask the Circular (AI)
            </div>
            <div className="chat-history">
              {chatHistory.length === 0 && (
                <div className="chat-msg ai-msg">
                  Hi! I've read this circular. Ask me anything, e.g., "What is the penalty?" or "Translate this to Hindi."
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-msg ${msg.role === 'user' ? 'user-msg' : 'ai-msg'}`}>
                  {msg.text}
                </div>
              ))}
              {chatLoading && <div className="chat-msg ai-msg pulse">Thinking...</div>}
            </div>
            <div className="chat-input-area">
              <input 
                type="text" 
                value={chatQuestion}
                onChange={e => setChatQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAskChatbot()}
                placeholder="Ask a question..."
              />
              <button onClick={handleAskChatbot}>Ask</button>
            </div>
          </div>

        </div>
      )}

      {/* If nothing is loaded on Dashboard */}
      {!result && !complaintResult && !loading && (
        <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h2>All Systems Green</h2>
          <p>No active alerts. Waiting for new regulatory circulars or complaints.</p>
        </div>
      )}
    </>
  );

  const renderAdmin = () => (
    <>
      <header className="header">
        <h1>Admin Data Hub</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <Settings size={18} /> Ingestion & Controls
          </span>
        </div>
      </header>

      {/* Demo Controls Section */}
      <div className="admin-section" style={{marginBottom: '3rem'}}>
        <h3 style={{marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem'}}>Quick Demo Tools</h3>
        <div style={{display: 'flex', gap: '1rem'}}>
          <button className="btn-primary" style={{flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'}} onClick={handleDemoSimulateScrape}>
            <Globe size={18} /> Simulate Web Scrape (Automated)
          </button>
          <button className="btn-secondary" style={{flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: 0}} onClick={handleDemoPopulate}>
            <Database size={18} /> Populate Fake Data
          </button>
          <button className="btn-secondary" style={{flex: 1, borderColor: 'var(--danger)', color: '#fca5a5', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: 0}} onClick={handleDemoReset}>
            <Trash2 size={18} /> Wipe Database
          </button>
        </div>
      </div>

      {/* AI Ingestion Hub */}
      <div className="admin-section">
        <h3 style={{marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem'}}>Manual AI Ingestion</h3>
        {!loading && (
          <div className="ingestion-hub">
            <div className="ingestion-tabs">
              <button 
                className={`tab-btn ${ingestionTab === 'circular' ? 'active' : ''}`}
                onClick={() => setIngestionTab('circular')}
              >
                <FileText size={18} /> Feed Circular
              </button>
              <button 
                className={`tab-btn ${ingestionTab === 'complaint' ? 'active' : ''}`}
                onClick={() => setIngestionTab('complaint')}
              >
                <FileWarning size={18} /> Feed Complaint
              </button>
            </div>

            <div className="upload-section" onClick={() => fileInputRef.current.click()}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                accept=".pdf,.txt"
              />
              <UploadCloud className="upload-icon" />
              <h2>{selectedFile ? selectedFile.name : `Feed AI a ${ingestionTab === 'circular' ? 'Circular' : 'Complaint'} Document`}</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {selectedFile ? "Document ready. Click below to initiate AI agents." : "Drop your PDF/TXT file here."}
              </p>
              {selectedFile && (
                <button 
                  className="btn-primary" 
                  onClick={(e) => { e.stopPropagation(); handleProcessFile(); }}
                  style={{ marginTop: '1.5rem', padding: '1rem 2rem', fontSize: '1.1rem' }}
                >
                  {ingestionTab === 'circular' ? 'Initiate AI Processing' : 'Analyze Complaint & Switch to Dashboard'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="live-trace">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
              <Activity size={16} /> <strong>Agentic Pipeline Status</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldCheck size={14} /> 100% Data Privacy (Running Local AI Model - takes ~15s)
            </div>
          </div>
          {trace.map((msg, idx) => (
            <div key={idx} className="trace-line">
              <span style={{ color: '#9ca3af' }}>{new Date().toLocaleTimeString()}</span> - {msg}
            </div>
          ))}
          <div className="trace-line pulse" style={{ color: 'var(--primary)' }}>Inferencing local 7B AI model... Please wait.</div>
        </div>
      )}
    </>
  );

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{marginBottom: '1rem'}}>
          <ShieldCheck size={24} />
          <h2>RegAgent</h2>
        </div>
        
        {/* Navigation Links */}
        <div className="nav-menu" style={{padding: '0 1rem'}}>
          <button 
            className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <LayoutDashboard size={18} /> Live Dashboard
          </button>
          <button 
            className={`nav-link ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentView('admin')}
          >
            <Database size={18} /> Admin Hub
          </button>
        </div>

        <hr style={{borderColor: 'var(--border)', margin: '2rem 0'}} />

        {/* Circulars List shown only in Dashboard view visually or always? Let's show always but dim */}
        <div className="sidebar-header" style={{border: 'none', paddingTop: 0}}>
          <FileText size={18} />
          <h3 style={{fontSize: '0.9rem'}}>Circular Repository</h3>
        </div>
        <div className="sidebar-list">
          {circularsList.map(c => (
            <div key={c.id} className="repo-card">
              <div className="repo-filename">{c.filename}</div>
              <div className="repo-meta">
                <span className={`repo-priority ${getPriorityColor(c.priority)}`}>{c.priority}</span>
                <span className="repo-date">{c.upload_date.split(' ')[0]}</span>
              </div>
            </div>
          ))}
          {circularsList.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>
              No circulars.
            </div>
          )}
        </div>
      </aside>

      {/* Main Content View Switcher */}
      <main className="main-content">
        {currentView === 'dashboard' ? renderDashboard() : renderAdmin()}
      </main>
    </div>
  );
};

export default App;
