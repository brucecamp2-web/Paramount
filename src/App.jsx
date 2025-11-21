import React, { useState, useMemo, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Printer, 
  Scissors, 
  Layers, 
  DollarSign, 
  Package,
  Maximize,
  ArrowRight,
  Settings,
  Send,
  Loader,
  Check,
  Save,
  Kanban,
  RefreshCw,
  Layout,
  ExternalLink,
  Clock,
  Database,
  X,
  FileText,
  GripVertical
} from 'lucide-react';

// --- ⚠️ PASTE YOUR MAKE.COM WEBHOOK HERE TO SHARE WITH OTHERS ⚠️ ---
const HARDCODED_WEBHOOK_URL = "https://hook.us2.make.com/mnsu9apt7zhxfjibn3fm6fyy1qrlotlh"; 

// --- DATA CONSTANTS ---

const GLOBAL_SETUP_FEE = 40.00;
const CONTOUR_SETUP_FEE = 25.00;
const DOUBLE_SIDED_MULTIPLIER = 1.6;

const FINISHING_RATES = {
  grommets: 0.25,
  lamination: 2.50,
  lamination_min: 20.00
};

// Pricing Database
const MATERIALS = {
  '3mm PVC (Sintra)': {
    key: 'pvc_3mm',
    name: '3mm PVC (Sintra)',
    can_laminate: true,
    sheets: [
      { name: '48x96', w: 48, h: 96, cost: 28.41 },
      { name: '50x100', w: 50, h: 100, cost: 34.61 },
      { name: '60x120', w: 60, h: 120, cost: 44.16 }
    ],
    tiers: [
      { limit: 100, price: 6.00 },
      { limit: 500, price: 4.80 },
      { limit: 1000, price: 3.90 },
      { limit: 5000, price: 3.00 },
      { limit: 999999, price: 2.50 }
    ]
  },
  '4mm Coroplast': {
    key: 'coro_4mm',
    name: '4mm Coroplast',
    can_laminate: false, 
    sheets: [
      { name: '48x96', w: 48, h: 96, cost: 10.04 },
      { name: '60x120', w: 60, h: 120, cost: 14.55 }
    ],
    tiers: [
      { limit: 100, price: 4.50 },
      { limit: 500, price: 3.50 },
      { limit: 1000, price: 2.75 },
      { limit: 999999, price: 2.75 }
    ]
  },
  '.040 Styrene': {
    key: 'styrene_040',
    name: '.040 Styrene',
    can_laminate: true,
    sheets: [
      { name: '48x96', w: 48, h: 96, cost: 14.37 },
      { name: '50x100', w: 50, h: 100, cost: 15.60 },
      { name: '60x120', w: 60, h: 120, cost: 23.28 }
    ],
    tiers: [
      { limit: 100, price: 5.00 },
      { limit: 500, price: 4.00 },
      { limit: 1000, price: 3.25 },
      { limit: 999999, price: 2.75 }
    ]
  }
};

// Helper for currency formatting
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
};

export default function App() {
  // --- APP STATE ---
  const [viewMode, setViewMode] = useState('quote'); // 'quote', 'production', 'dashboard'
  
  // Quote Logic State
  const [inputs, setInputs] = useState({
    jobName: '',
    width: 24,
    height: 18,
    quantity: 10,
    material: '3mm PVC (Sintra)',
    sides: '1',
    cutType: 'Rectangular',
    addLamination: false,
    addGrommets: false,
    grommetsPerSign: 4
  });

  // Credentials State (LocalStorage)
  const [config, setConfig] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        webhookUrl: HARDCODED_WEBHOOK_URL || localStorage.getItem('paramount_webhook_url') || '',
        airtableBaseId: localStorage.getItem('paramount_at_base') || '',
        airtablePat: localStorage.getItem('paramount_at_pat') || '',
        airtableTableName: localStorage.getItem('paramount_at_table') || 'Jobs',
        airtableLineItemsName: localStorage.getItem('paramount_at_lines') || 'Line Items'
      };
    }
    return { webhookUrl: '', airtableBaseId: '', airtablePat: '', airtableTableName: 'Jobs', airtableLineItemsName: 'Line Items' };
  });

  // Persist Config
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!HARDCODED_WEBHOOK_URL) localStorage.setItem('paramount_webhook_url', config.webhookUrl);
      localStorage.setItem('paramount_at_base', config.airtableBaseId);
      localStorage.setItem('paramount_at_pat', config.airtablePat);
      localStorage.setItem('paramount_at_table', config.airtableTableName);
      localStorage.setItem('paramount_at_lines', config.airtableLineItemsName);
    }
  }, [config]);

  // Dashboard State
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [fetchError, setFetchError] = useState(null); 
  const [draggingJobId, setDraggingJobId] = useState(null); // For Drag & Drop

  // Modal State
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobLineItems, setJobLineItems] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (e, jobId) => {
    setDraggingJobId(jobId);
    e.dataTransfer.effectAllowed = "move";
    // Optional: Set a custom drag image or style here
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (!draggingJobId) return;

    const jobToMove = jobs.find(j => j.id === draggingJobId);
    if (!jobToMove || jobToMove.fields.Status === newStatus) {
      setDraggingJobId(null);
      return;
    }

    // 1. Optimistic Update (Update UI immediately)
    const updatedJobs = jobs.map(j => 
      j.id === draggingJobId ? { ...j, fields: { ...j.fields, Status: newStatus } } : j
    );
    setJobs(updatedJobs);
    setDraggingJobId(null);

    // 2. API Update (Update Airtable in background)
    if (config.airtableBaseId && config.airtablePat) {
      try {
        const tableName = config.airtableTableName || 'Jobs';
        const encodedTable = encodeURIComponent(tableName);
        
        const response = await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}/${jobToMove.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${config.airtablePat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: { Status: newStatus }
          })
        });

        if (!response.ok) {
          throw new Error("Failed to update status in Airtable");
        }
        // Success - no action needed
      } catch (error) {
        console.error("Drag update failed:", error);
        alert("Failed to save status change to Airtable. Reverting...");
        fetchJobs(); // Revert on error
      }
    }
  };

  // --- QUOTE CALCULATOR ENGINE ---
  const calculationResult = useMemo(() => {
    const matData = MATERIALS[inputs.material];
    const width = parseFloat(inputs.width) || 0;
    const height = parseFloat(inputs.height) || 0;
    const qty = parseInt(inputs.quantity) || 0;

    if (width === 0 || height === 0 || qty === 0) return null;

    // Specs & Pricing
    const itemSqFt = (width * height) / 144;
    const totalSqFt = itemSqFt * qty;
    
    let tierRate = 0;
    let tierName = '';
    for (const tier of matData.tiers) {
      if (totalSqFt <= tier.limit) {
        tierRate = tier.price;
        tierName = `< ${tier.limit.toLocaleString()} sqft`;
        break;
      }
    }

    let basePrintCost = totalSqFt * tierRate;
    if (inputs.sides === '2') basePrintCost *= DOUBLE_SIDED_MULTIPLIER;

    const costs = {
      print: basePrintCost,
      setup: GLOBAL_SETUP_FEE,
      lamination: 0,
      grommets: 0,
      contour: 0
    };

    const warnings = [];

    if (inputs.addLamination) {
      if (!matData.can_laminate) {
        warnings.push(`Cannot laminate ${matData.name}. Lamination removed.`);
      } else {
        let lamCost = totalSqFt * FINISHING_RATES.lamination;
        if (lamCost < FINISHING_RATES.lamination_min) lamCost = FINISHING_RATES.lamination_min;
        costs.lamination = lamCost;
      }
    }

    if (inputs.addGrommets) {
      costs.grommets = qty * inputs.grommetsPerSign * FINISHING_RATES.grommets;
    }

    if (inputs.cutType === 'Contour') {
      costs.contour = CONTOUR_SETUP_FEE;
    }

    const totalSellPrice = Object.values(costs).reduce((a, b) => a + b, 0);
    const unitPrice = totalSellPrice / qty;

    // Material Yield
    let bestSheet = null;
    if (matData.sheets) {
      let bestCost = Infinity;
      matData.sheets.forEach(sheet => {
        const sw = sheet.w, sh = sheet.h;
        const fitA = Math.floor(sw / width) * Math.floor(sh / height);
        const fitB = Math.floor(sw / height) * Math.floor(sh / width);
        const perSheet = Math.max(fitA, fitB);
        
        if (perSheet > 0) {
          const sheetsNeeded = Math.ceil(qty / perSheet);
          const totalMatCost = sheetsNeeded * sheet.cost;
          if (totalMatCost < bestCost) {
            bestCost = totalMatCost;
            bestSheet = {
              name: sheet.name,
              costPerSheet: sheet.cost,
              totalMatCost: totalMatCost,
              sheetsNeeded: sheetsNeeded,
              yieldPerSheet: perSheet,
              orientation: fitB > fitA ? 'Rotated' : 'Standard',
              waste: (( (sw*sh) - (perSheet * width * height) ) / (sw*sh)) * 100
            };
          }
        }
      });
    }

    const grossMargin = totalSellPrice - (bestSheet ? bestSheet.totalMatCost : 0);
    const marginPercent = (grossMargin / totalSellPrice) * 100;

    return {
      specs: { totalSqFt, tierRate, tierName, itemSqFt },
      costs,
      totalSellPrice,
      unitPrice,
      warnings,
      production: bestSheet,
      profitability: { grossMargin, marginPercent }
    };
  }, [inputs]);

  // --- AIRTABLE FETCH LOGIC ---
  const fetchJobs = async () => {
    setFetchError(null);
    
    if (!config.airtableBaseId || !config.airtablePat) {
      setFetchError("Missing Configuration: Enter Base ID and Token above.");
      return;
    }

    const tableName = config.airtableTableName || 'Jobs';

    setLoadingJobs(true);
    try {
      // Encode the table name to handle spaces (e.g. "Line Items")
      const encodedTable = encodeURIComponent(tableName);
      const response = await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}`, {
        headers: {
          Authorization: `Bearer ${config.airtablePat}`
        }
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error?.message || response.statusText;
        
        if (response.status === 404) throw new Error(`404 Not Found: Could not find table "${tableName}". Check your Base ID and Table Name.`);
        if (response.status === 401) throw new Error("401 Unauthorized: Check your Personal Access Token permissions.");
        throw new Error(`Airtable Error (${response.status}): ${msg}`);
      }
      
      const data = await response.json();
      setJobs(data.records);
    } catch (error) {
      console.error(error);
      setFetchError(error.message);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Fetch specific line items for a job
  const fetchLineItems = async (jobRecordId) => {
    setLoadingDetails(true);
    setJobLineItems([]);
    
    const tableName = config.airtableLineItemsName || 'Line Items';
    
    try {
      const encodedTable = encodeURIComponent(tableName);
      // Filter formula: {Job_Link} = 'RECORD_ID'
      const filterFormula = `filterByFormula=${encodeURIComponent(`{Job_Link}='${jobRecordId}'`)}`;
      
      const response = await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}?${filterFormula}`, {
        headers: {
           Authorization: `Bearer ${config.airtablePat}`
        }
      });

      if (!response.ok) throw new Error("Failed to fetch line items");
      
      const data = await response.json();
      setJobLineItems(data.records);

    } catch (error) {
      console.error("Line Item Fetch Error:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    fetchLineItems(job.id); // Pass the Airtable Record ID
  };

  // --- SUBMIT HANDLER ---
  const handleSubmit = async () => {
    const targetUrl = HARDCODED_WEBHOOK_URL || config.webhookUrl;
    
    if (!targetUrl) {
      alert("Please enter a Make.com Webhook URL in the settings.");
      return;
    }

    setSubmitStatus('sending');
    const payload = {
      job_name: inputs.jobName || "Untitled Job",
      order_date: new Date().toISOString().split('T')[0],
      total_price: calculationResult.totalSellPrice,
      item_details: {
        material: inputs.material,
        width: inputs.width,
        height: inputs.height,
        quantity: inputs.quantity,
        sides: inputs.sides,
        cut_type: inputs.cutType,
        lamination: inputs.addLamination,
        grommets: inputs.addGrommets,
        production_json: JSON.stringify(calculationResult.production)
      }
    };

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSubmitStatus('success');
        setTimeout(() => setSubmitStatus('idle'), 3000);
        if (config.airtableBaseId) fetchJobs(); 
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error(error);
      setSubmitStatus('error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-ticket, .printable-ticket * {
            visibility: visible;
          }
          .printable-ticket {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: white;
            z-index: 9999;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg">
            <Printer size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Paramount OS</h1>
            <p className="text-sm text-slate-500">Shop Operating System</p>
          </div>
        </div>
        
        <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex self-start">
          <button 
            onClick={() => setViewMode('quote')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'quote' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <DollarSign size={16} /> Quoter
          </button>
          <button 
            onClick={() => setViewMode('production')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'production' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Package size={16} /> Ticket
          </button>
          <button 
            onClick={() => { setViewMode('dashboard'); if(config.airtableBaseId) fetchJobs(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Kanban size={16} /> Shop Dashboard
          </button>
        </div>
      </header>

      {/* --- DASHBOARD VIEW --- */}
      {viewMode === 'dashboard' && (
        <main className="max-w-7xl mx-auto relative no-print">
          
          {/* Config Panel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
             <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
              <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Airtable Base ID</label>
                <input 
                  type="text" name="airtableBaseId" value={config.airtableBaseId} onChange={handleConfigChange}
                  placeholder="appXXXXXXXXXXXXXX"
                  className="w-full text-sm border-slate-300 rounded-md font-mono"
                />
              </div>
              <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Personal Access Token</label>
                <input 
                  type="password" name="airtablePat" value={config.airtablePat} onChange={handleConfigChange}
                  placeholder="patXXXXXXXXXXXXXX..."
                  className="w-full text-sm border-slate-300 rounded-md font-mono"
                />
              </div>
              <button 
                onClick={fetchJobs}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 h-10"
              >
                {loadingJobs ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Refresh
              </button>
             </div>
             
             <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Jobs Table Name</label>
                  <input 
                    type="text" name="airtableTableName" value={config.airtableTableName} onChange={handleConfigChange}
                    placeholder="Jobs"
                    className="w-full text-xs border-slate-200 rounded-md text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Line Items Table Name</label>
                  <input 
                    type="text" name="airtableLineItemsName" value={config.airtableLineItemsName} onChange={handleConfigChange}
                    placeholder="Line Items"
                    className="w-full text-xs border-slate-200 rounded-md text-slate-500"
                  />
                </div>
             </div>
          </div>

          {fetchError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md shadow-sm">
               <div className="flex items-center">
                  <AlertTriangle className="text-red-600 mr-3" size={20} />
                  <span className="text-red-700 font-medium">{fetchError}</span>
               </div>
            </div>
          )}

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-x-auto pb-8">
            
            {['Draft', 'Approved', 'Production', 'Complete'].map(status => (
              <div 
                key={status} 
                className={`rounded-xl p-4 min-w-[280px] transition-colors ${status === 'Approved' ? 'bg-blue-50' : status === 'Production' ? 'bg-indigo-50' : status === 'Complete' ? 'bg-emerald-50' : 'bg-slate-100'}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                 <h3 className={`font-bold mb-4 flex items-center gap-2 ${status === 'Approved' ? 'text-blue-800' : status === 'Production' ? 'text-indigo-800' : status === 'Complete' ? 'text-emerald-800' : 'text-slate-600'}`}>
                    {status === 'Draft' && <Layout size={18}/>}
                    {status === 'Approved' && <CheckCircle size={18}/>}
                    {status === 'Production' && <Settings size={18}/>}
                    {status === 'Complete' && <Package size={18}/>}
                    {status}
                 </h3>
                 <div className="space-y-3">
                   {jobs.filter(j => j.fields.Status === status || (status === 'Complete' && j.fields.Status === 'Shipped')).map(job => (
                      <div 
                        key={job.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onClick={() => handleJobClick(job)}
                        className={`bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-all cursor-pointer active:scale-[0.98] relative group ${
                          status === 'Approved' ? 'border-blue-100 border-l-4 border-l-blue-500' : 
                          status === 'Production' ? 'border-indigo-100 border-l-4 border-l-indigo-500' :
                          'border-slate-200'
                        }`}
                      >
                        <div className="absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                           <GripVertical size={16} />
                        </div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-mono text-slate-400">{job.fields.Job_ID}</span>
                          <span className="text-xs font-bold text-slate-600">{formatCurrency(job.fields.Total_Price)}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">{job.fields.Project_Name || "Untitled"}</h4>
                        <p className="text-xs text-slate-500 mb-2">{job.fields.Client_Name || "Unknown Client"}</p>
                        
                        <div className="flex items-center justify-between mt-3">
                           <div className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock size={12} /> {job.fields.Due_Date ? job.fields.Due_Date.split('-').slice(1).join('/') : "No Date"}
                           </div>
                           {status === 'Production' && <Loader size={14} className="text-indigo-500 animate-spin" />}
                        </div>
                      </div>
                   ))}
                   {jobs.filter(j => j.fields.Status === status).length === 0 && <p className="text-sm text-slate-400 italic opacity-50 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">Drop here</p>}
                 </div>
              </div>
            ))}
          </div>

          {/* JOB DETAIL MODAL */}
          {selectedJob && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden printable-ticket">
                   
                   {/* Modal Header */}
                   <div className="bg-slate-900 text-white p-6 flex justify-between items-start print:bg-white print:text-black print:border-b print:border-black">
                      <div>
                         <p className="text-slate-400 text-xs font-mono mb-1 print:text-black">{selectedJob.fields.Job_ID}</p>
                         <h2 className="text-2xl font-bold">{selectedJob.fields.Project_Name}</h2>
                         <p className="text-slate-300 text-sm print:text-black">{selectedJob.fields.Client_Name} • Due: {selectedJob.fields.Due_Date || "N/A"}</p>
                      </div>
                      <button onClick={() => setSelectedJob(null)} className="text-slate-400 hover:text-white p-1 no-print">
                         <X size={24} />
                      </button>
                   </div>

                   {/* Modal Body */}
                   <div className="p-6 overflow-y-auto flex-1">
                      
                      <div className="flex justify-between items-center mb-6 no-print">
                         <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Layers size={20} className="text-blue-600" /> Production Line Items
                         </h3>
                         <div className="flex gap-2">
                           <button onClick={() => window.print()} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded flex items-center gap-2">
                              <Printer size={14} /> Print Traveler
                           </button>
                         </div>
                      </div>

                      {/* Print-only Header */}
                      <div className="hidden print:block mb-4">
                         <h3 className="text-lg font-bold border-b-2 border-black pb-1">WORK ORDER / TRAVELER</h3>
                      </div>

                      {loadingDetails ? (
                         <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                            <Loader size={32} className="animate-spin mb-2" />
                            <p>Fetching specs from Airtable...</p>
                         </div>
                      ) : (
                         <div className="space-y-6">
                            {jobLineItems.length > 0 ? jobLineItems.map((item, idx) => {
                               // Parse the JSON Spec String safely
                               let prodSpecs = null;
                               try {
                                  prodSpecs = JSON.parse(item.fields.Production_Specs_JSON || '{}');
                               } catch (e) { console.log("JSON Parse Error", e)}

                               return (
                                 <div key={item.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 print:bg-white print:border-black print:border-2">
                                    <div className="flex justify-between items-start mb-3 border-b border-slate-200 pb-3 print:border-black">
                                       <div>
                                          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mr-2 print:text-black print:bg-transparent print:border print:border-black">Item #{idx + 1}</span>
                                          <span className="font-bold text-slate-800 text-lg print:text-black">{item.fields.Material_Type}</span>
                                       </div>
                                       <div className="text-right">
                                          <span className="block font-bold text-2xl">{item.fields.Quantity} <span className="text-sm font-normal text-slate-500 print:text-black">units</span></span>
                                       </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                       <div>
                                          <p className="text-xs text-slate-400 uppercase font-bold mb-1 print:text-black">Dimensions</p>
                                          <p className="font-mono font-semibold text-lg">{item.fields.Width_In}" x {item.fields.Height_In}"</p>
                                          <p className="text-xs text-slate-500 mt-1 print:text-black font-bold">{item.fields.Sides === '2' ? 'DOUBLE SIDED' : 'Single Sided'}</p>
                                       </div>
                                       
                                       <div>
                                          <p className="text-xs text-slate-400 uppercase font-bold mb-1 print:text-black">Finishing</p>
                                          <ul className="space-y-1">
                                             <li className="flex items-center gap-2 font-semibold">
                                                <span className="no-print">{item.fields.Cut_Type === 'Contour' ? <Scissors size={12} /> : <Scissors size={12} />}</span>
                                                <span>{item.fields.Cut_Type}</span>
                                             </li>
                                             {item.fields.Finishing_Lam && <li className="flex items-center gap-2 font-semibold"><span className="no-print"><Maximize size={12} /></span> Laminated</li>}
                                             {item.fields.Finishing_Grommets && <li className="flex items-center gap-2 font-semibold"><span className="no-print"><CheckCircle size={12} /></span> Grommets</li>}
                                          </ul>
                                       </div>
                                    </div>

                                    {prodSpecs && (
                                       <div className="mt-4 bg-white border border-dashed border-indigo-200 rounded p-3 print:border-black print:border-2">
                                          <p className="text-xs text-indigo-600 font-bold uppercase mb-2 flex items-center gap-1 print:text-black">
                                             <Database size={12} className="no-print" /> Production Data
                                          </p>
                                          <div className="flex gap-4 text-xs text-slate-600 print:text-black print:text-sm">
                                             <div>Sheet: <strong>{prodSpecs.name || prodSpecs.sheet || "N/A"}</strong></div>
                                             <div>Yield: <strong>{prodSpecs.yield || prodSpecs.yieldPerSheet || "0"} per sheet</strong></div>
                                             <div>Orientation: <strong>{prodSpecs.orientation || "Standard"}</strong></div>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                               )
                            }) : (
                               <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                  <p className="text-slate-400">No Line Items found linked to this job.</p>
                                  <p className="text-xs text-slate-300 mt-1">Check the "Job_Link" column in Airtable.</p>
                               </div>
                            )}
                         </div>
                      )}
                   </div>

                   {/* Modal Footer */}
                   <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end no-print">
                      <button onClick={() => setSelectedJob(null)} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50">
                         Close
                      </button>
                   </div>
                </div>
             </div>
          )}

        </main>
      )}


      {/* --- QUOTE & TICKET VIEWS --- */}
      {(viewMode === 'quote' || viewMode === 'production') && (
        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
          
          {/* LEFT: INPUTS */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={18} className="text-blue-600" /> Job Specs
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Job / Project Name</label>
                  <input 
                    type="text" name="jobName" placeholder="e.g. Fall Event Signs"
                    value={inputs.jobName} onChange={handleInputChange}
                    className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Width (in)</label>
                    <input 
                      type="number" name="width" value={inputs.width} onChange={handleInputChange}
                      className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Height (in)</label>
                    <input 
                      type="number" name="height" value={inputs.height} onChange={handleInputChange}
                      className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                  <input 
                    type="number" name="quantity" value={inputs.quantity} onChange={handleInputChange}
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                  <select 
                    name="material" value={inputs.material} onChange={handleInputChange}
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.values(MATERIALS).map(m => (
                      <option key={m.key} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Print Sides</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 p-2 border rounded-md flex-1 cursor-pointer hover:bg-slate-50">
                      <input type="radio" name="sides" value="1" checked={inputs.sides === '1'} onChange={handleInputChange} />
                      <span>Single Sided</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 border rounded-md flex-1 cursor-pointer hover:bg-slate-50">
                      <input type="radio" name="sides" value="2" checked={inputs.sides === '2'} onChange={handleInputChange} />
                      <span>Double Sided (+60%)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Scissors size={18} className="text-green-600" /> Finishing & Cutting
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cut Type</label>
                  <select 
                    name="cutType" value={inputs.cutType} onChange={handleInputChange}
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Rectangular">Rectangular (Free)</option>
                    <option value="Contour">Contour / Shape (+$25.00 Setup)</option>
                  </select>
                </div>
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" name="addLamination" 
                        checked={inputs.addLamination} onChange={handleInputChange} 
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Add Lamination</span>
                    </div>
                    <span className="text-xs text-slate-500">$2.50/sqft</span>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" name="addGrommets" 
                        checked={inputs.addGrommets} onChange={handleInputChange} 
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Add Grommets</span>
                    </div>
                    <span className="text-xs text-slate-500">$0.25/ea</span>
                  </label>
                  {inputs.addGrommets && (
                    <div className="pl-6 animate-in fade-in slide-in-from-top-1">
                      <label className="text-xs text-slate-500 block mb-1">Grommets per sign</label>
                      <input 
                        type="number" name="grommetsPerSign" 
                        value={inputs.grommetsPerSign} onChange={handleInputChange}
                        className="w-20 rounded-md border-slate-300 border p-1 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ADMIN CONFIG (Quoter Side) */}
            {!HARDCODED_WEBHOOK_URL && (
              <div className="bg-slate-100 rounded-xl shadow-inner border border-slate-200 p-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Settings</h2>
                <div className="space-y-2">
                  <label className="block text-sm text-slate-600">Make.com Webhook URL</label>
                  <input 
                    type="text" name="webhookUrl" value={config.webhookUrl} onChange={handleConfigChange}
                    className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white"
                    placeholder="https://hook.us1.make.com/..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: OUTPUT */}
          <div className="lg:col-span-7 space-y-6">
            
            {calculationResult?.warnings.length > 0 && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm">
                <div className="flex items-start">
                  <AlertTriangle className="text-amber-600 mt-0.5 mr-3" size={20} />
                  <div>
                    <h3 className="text-sm font-medium text-amber-800">Validation Warning</h3>
                    <ul className="mt-1 list-disc list-inside text-sm text-amber-700">
                      {calculationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* QUOTE PREVIEW */}
            {viewMode === 'quote' && calculationResult && (
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign size={20} /> Customer Quote
                  </h3>
                  <span className="text-xs bg-blue-700 px-2 py-1 rounded text-blue-100">Valid for 30 days</span>
                </div>
                
                <div className="p-6">
                  <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-6">
                    <div>
                      <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Project Cost</p>
                      <h2 className="text-4xl font-bold text-slate-900 mt-1">
                        {formatCurrency(calculationResult.totalSellPrice)}
                      </h2>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Price per unit</p>
                      <p className="text-xl font-semibold text-slate-700">
                        {formatCurrency(calculationResult.unitPrice)} <span className="text-sm font-normal text-slate-400">/ea</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <Layers size={14} /> 
                        Print ({Math.round(calculationResult.specs.totalSqFt)} sqft @ {formatCurrency(calculationResult.specs.tierRate)})
                        {inputs.sides === '2' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">2-Sided</span>}
                      </span>
                      <span className="font-medium">{formatCurrency(calculationResult.costs.print)}</span>
                    </div>
                    {calculationResult.costs.setup > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2"><Settings size={14}/> Setup Fee</span>
                        <span className="font-medium">{formatCurrency(calculationResult.costs.setup)}</span>
                      </div>
                    )}
                    {calculationResult.costs.contour > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2"><Scissors size={14}/> Contour Setup</span>
                        <span className="font-medium">{formatCurrency(calculationResult.costs.contour)}</span>
                      </div>
                    )}
                    {calculationResult.costs.lamination > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2"><Maximize size={14}/> Lamination</span>
                        <span className="font-medium">{formatCurrency(calculationResult.costs.lamination)}</span>
                      </div>
                    )}
                    {calculationResult.costs.grommets > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2"><CheckCircle size={14}/> Grommets</span>
                        <span className="font-medium">{formatCurrency(calculationResult.costs.grommets)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <button
                      onClick={handleSubmit}
                      disabled={(!HARDCODED_WEBHOOK_URL && !config.webhookUrl) || submitStatus === 'sending' || submitStatus === 'success'}
                      className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${submitStatus === 'success' ? 'bg-green-600 text-white' : (!HARDCODED_WEBHOOK_URL && !config.webhookUrl) ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    >
                      {submitStatus === 'idle' && <><Send size={18} /> Submit Order to Production</>}
                      {submitStatus === 'sending' && <><Loader size={18} className="animate-spin" /> Processing...</>}
                      {submitStatus === 'success' && <><Check size={18} /> Order Sent!</>}
                      {submitStatus === 'error' && "Error - Check Webhook"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCTION TICKET VIEW */}
            {viewMode === 'production' && calculationResult && (
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package size={20} /> Production Ticket
                  </h3>
                  <span className="text-xs bg-indigo-800 px-2 py-1 rounded text-indigo-100 font-mono">JOB-PREVIEW</span>
                </div>
                <div className="p-6 space-y-6">
                  <div className="border-b border-slate-100 pb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Material Yield</h4>
                    {calculationResult.production ? (
                       <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-lg font-bold text-indigo-900">{calculationResult.production.name} Sheet</p>
                              <p className="text-indigo-700 text-sm">Use {calculationResult.production.sheetsNeeded} Sheets total</p>
                            </div>
                            <div className="text-right">
                              <span className="inline-block bg-white text-indigo-600 text-xs font-bold px-2 py-1 rounded border border-indigo-200">
                                Fits {calculationResult.production.yieldPerSheet} / sheet
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs text-indigo-800 mt-3">
                             <span>Layout: <strong>{calculationResult.production.orientation}</strong></span>
                             <span>Waste: <strong>{calculationResult.production.waste.toFixed(1)}%</strong></span>
                          </div>
                       </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Enter dimensions to calculate yield.</p>
                    )}
                  </div>
                  <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Routing Instructions</h4>
                      <ul className="space-y-2 text-sm">
                         <li className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${inputs.cutType === 'Contour' ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
                            <span className={inputs.cutType === 'Contour' ? 'font-semibold' : 'text-slate-500'}>
                              {inputs.cutType === 'Contour' ? 'CNC Router (Contour)' : 'Standard Cut'}
                            </span>
                         </li>
                         {/* Add other routing steps here */}
                      </ul>
                   </div>
                </div>
              </div>
            )}

            {!calculationResult && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-8">
                <ArrowRight size={48} className="mb-4 opacity-20" />
                <p>Enter specs to generate quote.</p>
              </div>
            )}

          </div>
        </main>
      )}
    </div>
  );
}