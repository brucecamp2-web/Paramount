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
  Settings,
  Send,
  Loader,
  Check,
  Kanban,
  RefreshCw,
  Layout,
  Clock,
  Database,
  X,
  Search,
  User,
  UploadCloud,
  Link as LinkIcon
} from 'lucide-react';

// --- ⚠️ HARDCODED CONFIGURATION ⚠️ ---
// These values will override any local settings
const HARDCODED_SUBMIT_WEBHOOK = "https://hook.us2.make.com/mnsu9apt7zhxfjibn3fm6fyy1qrlotlh"; 
const HARDCODED_SEARCH_WEBHOOK = "https://hook.us2.make.com/1eld4uno29hvl6fifvmw0e4s7ig54was";
const HARDCODED_UPLOAD_WEBHOOK = ""; 

// ✅ Credentials (Hardcoded for stability)
const HARDCODED_AIRTABLE_BASE_ID = "app3QrZgktGpCp21l"; 
const HARDCODED_AIRTABLE_PAT = "pateL0HJlHko5bI1x.53da74b4f542f8ac101af18d4fa4ba87666faebb4835b2c967bc9492c2d95588";     

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

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
};

export default function App() {
  // --- APP STATE ---
  const [viewMode, setViewMode] = useState('quote'); 
  
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
    grommetsPerSign: 4,
    artFileUrl: ''
  });

  const [customer, setCustomer] = useState({ id: '', name: '' });
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // --- SAFE CONFIG INITIALIZATION ---
  const [config, setConfig] = useState(() => {
    // 1. Default empty values
    let loadedConfig = { 
        webhookUrl: '', searchWebhookUrl: '', uploadWebhookUrl: '', 
        airtableBaseId: '', airtablePat: '', airtableTableName: 'Jobs', airtableLineItemsName: 'Line Items' 
    };
    
    try {
        // 2. Try loading from LocalStorage if available
        if (typeof window !== 'undefined') {
            const get = (k) => localStorage.getItem(k) || '';
            loadedConfig = {
                webhookUrl: get('paramount_webhook_url'),
                searchWebhookUrl: get('paramount_search_webhook_url'),
                uploadWebhookUrl: get('paramount_upload_webhook_url'),
                airtableBaseId: get('paramount_at_base'),
                airtablePat: get('paramount_at_pat'),
                airtableTableName: get('paramount_at_table') || 'Jobs',
                airtableLineItemsName: get('paramount_at_lines') || 'Line Items'
            };
        }
    } catch (e) {
        console.warn("Storage access failed, using defaults.");
    }

    // 3. OVERRIDE with Hardcoded values if they exist (Safety Net)
    if (HARDCODED_SUBMIT_WEBHOOK) loadedConfig.webhookUrl = HARDCODED_SUBMIT_WEBHOOK;
    if (HARDCODED_SEARCH_WEBHOOK) loadedConfig.searchWebhookUrl = HARDCODED_SEARCH_WEBHOOK;
    if (HARDCODED_UPLOAD_WEBHOOK) loadedConfig.uploadWebhookUrl = HARDCODED_UPLOAD_WEBHOOK;
    if (HARDCODED_AIRTABLE_BASE_ID) loadedConfig.airtableBaseId = HARDCODED_AIRTABLE_BASE_ID;
    if (HARDCODED_AIRTABLE_PAT) loadedConfig.airtablePat = HARDCODED_AIRTABLE_PAT;

    return loadedConfig;
  });

  // Persist Config (Only for fields that aren't hardcoded)
  useEffect(() => {
    try {
        if (typeof window !== 'undefined') {
            if (!HARDCODED_SUBMIT_WEBHOOK) localStorage.setItem('paramount_webhook_url', config.webhookUrl);
            if (!HARDCODED_SEARCH_WEBHOOK) localStorage.setItem('paramount_search_webhook_url', config.searchWebhookUrl);
            if (!HARDCODED_UPLOAD_WEBHOOK && config.uploadWebhookUrl) localStorage.setItem('paramount_upload_webhook_url', config.uploadWebhookUrl);
            if (!HARDCODED_AIRTABLE_BASE_ID) localStorage.setItem('paramount_at_base', config.airtableBaseId);
            if (!HARDCODED_AIRTABLE_PAT) localStorage.setItem('paramount_at_pat', config.airtablePat);
            
            localStorage.setItem('paramount_at_table', config.airtableTableName);
            localStorage.setItem('paramount_at_lines', config.airtableLineItemsName);
        }
    } catch (e) { /* Ignore storage errors */ }
  }, [config]);

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [fetchError, setFetchError] = useState(null); 
  const [draggingJobId, setDraggingJobId] = useState(null); 

  const [selectedJob, setSelectedJob] = useState(null);
  const [jobLineItems, setJobLineItems] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // --- SEARCH LOGIC (ROBUST) ---
  const searchCustomers = async () => {
    const targetUrl = config.searchWebhookUrl;
    if (!targetUrl) { alert("Please add your Customer Search Webhook URL."); return; }
    if (!customerQuery) return;

    setIsSearchingCustomer(true);
    setCustomerResults([]);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: customerQuery })
      });
      
      const rawText = await response.text();
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      // ✅ CHECK 1: Did Make return "Accepted" (Missing Webhook Response)?
      if (rawText === "Accepted") {
        // Fallback: If searching for demo, show it even if webhook is broken
        if (customerQuery.toLowerCase().includes('acme')) {
             setCustomerResults([{ id: '99', DisplayName: 'Acme Corp (Demo)' }]);
             return; // Exit early
        }

        // Otherwise show the setup hint
        setCustomerResults([{ id: 'make-setup', DisplayName: '⚠️ Setup: Add "Webhook Response" in Make' }]);
        return;
      }

      let data = null;
      try {
        // Only try parsing if there is text content
        if (rawText && rawText.trim().length > 0) {
           data = JSON.parse(rawText);
        }
      } catch (e) {
        console.warn("Search response was not valid JSON:", rawText);
        throw new Error(`Response was not JSON. received: "${rawText.substring(0, 20)}..."`);
      }
      
      // ✅ CHECK 2: Smart Unwrapping (Handle { data: [] } vs [])
      let results = [];
      if (Array.isArray(data)) {
        results = data;
      } else if (data && typeof data === 'object') {
        // Try to find the array if it's wrapped
        results = data.data || data.results || data.customers || data.items || [];
        
        // If it's a single object (not an array) but looks like a customer, wrap it
        if (!Array.isArray(results) && (data.id || data.Id || data.ID || data.DisplayName)) {
            results = [data];
        }
      }
      
      const normalizedResults = Array.isArray(results) ? results.map(c => ({
         id: c.id || c.Id || c.ID || 'unknown',
         DisplayName: c.DisplayName || c.name || c.FullyQualifiedName || 'Unknown Name'
      })) : [];

      if (normalizedResults.length === 0) {
         if (customerQuery.toLowerCase().includes('acme')) {
            setCustomerResults([{ id: '99', DisplayName: 'Acme Corp (Demo)' }]);
         } else {
            // ✅ CHECK 3: Explicit "No Results" state
            setCustomerResults([{ id: 'no-results', DisplayName: 'No customers found.' }]);
         }
      } else {
         setCustomerResults(normalizedResults);
      }

    } catch (error) {
      console.error("Search Error:", error);
      setCustomerResults([{ id: 'error-msg', DisplayName: `Error: ${error.message}` }]);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const selectCustomer = (cust) => {
    // Prevent selecting the error message or empty state or setup hint
    if (cust.id === 'error-msg' || cust.id === 'no-results' || cust.id === 'make-setup') return; 
    setCustomer({ id: cust.id, name: cust.DisplayName });
    setCustomerResults([]); 
    setCustomerQuery(''); 
  };

  // --- UPLOAD LOGIC ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const targetUrl = config.uploadWebhookUrl; 
    if (!targetUrl) { alert("Please set the Upload Webhook URL."); return; }
    if (file.size > 8 * 1024 * 1024) { alert("File > 8MB. Please use a link."); return; }

    setIsUploading(true); setUploadError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]; 
        const response = await fetch(targetUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, mime: file.type, data: base64Data })
        });
        if (!response.ok) throw new Error("Upload failed");
        const result = await response.json();
        if (result.url) setInputs(prev => ({ ...prev, artFileUrl: result.url }));
        else throw new Error("No URL returned");
        setIsUploading(false);
      };
    } catch (error) { setUploadError("Upload failed."); setIsUploading(false); }
  };

  // --- DRAG & DROP ---
  const handleDragStart = (e, jobId) => { setDraggingJobId(jobId); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (!draggingJobId) return;
    const jobToMove = jobs.find(j => j.id === draggingJobId);
    if (!jobToMove || jobToMove.fields.Status === newStatus) { setDraggingJobId(null); return; }
    const updatedJobs = jobs.map(j => j.id === draggingJobId ? { ...j, fields: { ...j.fields, Status: newStatus } } : j);
    setJobs(updatedJobs);
    setDraggingJobId(null);
    if (config.airtableBaseId && config.airtablePat) {
      try {
        const tableName = config.airtableTableName || 'Jobs';
        const encodedTable = encodeURIComponent(tableName);
        await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}/${jobToMove.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${config.airtablePat}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { Status: newStatus }, typecast: true })
        });
      } catch (error) { fetchJobs(); }
    }
  };

  // --- CALCULATOR ---
  const calculationResult = useMemo(() => {
    const matData = MATERIALS[inputs.material];
    if (!matData) return null;

    const width = parseFloat(inputs.width) || 0;
    const height = parseFloat(inputs.height) || 0;
    const qty = parseInt(inputs.quantity) || 0;
    if (width === 0 || height === 0 || qty === 0) return null;

    const itemSqFt = (width * height) / 144;
    const totalSqFt = itemSqFt * qty;
    let tierRate = 0;
    for (const tier of matData.tiers) { if (totalSqFt <= tier.limit) { tierRate = tier.price; break; } }
    let basePrintCost = totalSqFt * tierRate;
    if (inputs.sides === '2') basePrintCost *= DOUBLE_SIDED_MULTIPLIER;

    const costs = { print: basePrintCost, setup: GLOBAL_SETUP_FEE, lamination: 0, grommets: 0, contour: 0 };
    const warnings = [];

    if (inputs.addLamination) {
      if (!matData.can_laminate) warnings.push(`Cannot laminate ${matData.name}.`);
      else { let lamCost = totalSqFt * FINISHING_RATES.lamination; if (lamCost < FINISHING_RATES.lamination_min) lamCost = FINISHING_RATES.lamination_min; costs.lamination = lamCost; }
    }
    if (inputs.addGrommets) costs.grommets = qty * inputs.grommetsPerSign * FINISHING_RATES.grommets;
    if (inputs.cutType === 'Contour') costs.contour = CONTOUR_SETUP_FEE;

    const totalSellPrice = Object.values(costs).reduce((a, b) => a + b, 0);
    const unitPrice = totalSellPrice / qty;

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
            bestSheet = { name: sheet.name, costPerSheet: sheet.cost, totalMatCost: totalMatCost, sheetsNeeded: sheetsNeeded, yieldPerSheet: perSheet, orientation: fitB > fitA ? 'Rotated' : 'Standard', waste: (( (sw*sh) - (perSheet * width * height) ) / (sw*sh)) * 100 };
          }
        }
      });
    }
    const grossMargin = totalSellPrice - (bestSheet ? bestSheet.totalMatCost : 0);
    const marginPercent = (grossMargin / totalSellPrice) * 100;

    return { specs: { totalSqFt, tierRate, itemSqFt }, costs, totalSellPrice, unitPrice, warnings, production: bestSheet, profitability: { grossMargin, marginPercent } };
  }, [inputs]);

  // --- FETCH JOBS ---
  const fetchJobs = async () => {
    setFetchError(null);
    const baseId = config.airtableBaseId;
    const pat = config.airtablePat;
    if (!baseId || !pat) return;
    
    const tableName = config.airtableTableName || 'Jobs';
    setLoadingJobs(true);
    try {
      const encodedTable = encodeURIComponent(tableName);
      const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodedTable}`, { headers: { Authorization: `Bearer ${pat}` } });
      if (!response.ok) throw new Error(`Airtable Error: ${response.statusText}`);
      const data = await response.json();
      setJobs(data.records);
    } catch (error) { setFetchError(error.message); } finally { setLoadingJobs(false); }
  };

  const fetchLineItems = async (jobRecordId) => {
    setLoadingDetails(true);
    setJobLineItems([]);
    const tableName = config.airtableLineItemsName || 'Line Items';
    const baseId = config.airtableBaseId;
    const pat = config.airtablePat;
    try {
      const encodedTable = encodeURIComponent(tableName);
      const filterFormula = `filterByFormula=${encodeURIComponent(`{Job_Link}='${jobRecordId}'`)}`;
      const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodedTable}?${filterFormula}`, { headers: { Authorization: `Bearer ${pat}` } });
      if (response.ok) { const data = await response.json(); setJobLineItems(data.records); }
    } catch (error) { console.error(error); } finally { setLoadingDetails(false); }
  };

  const handleJobClick = (job) => { setSelectedJob(job); fetchLineItems(job.id); };

  // --- SUBMIT ---
  const handleSubmit = async () => {
    const targetUrl = config.webhookUrl;
    if (!targetUrl) { alert("Please enter a Submit Webhook URL."); return; }
    setSubmitStatus('sending');
    const payload = {
      job_name: inputs.jobName || "Untitled Job",
      order_date: new Date().toISOString().split('T')[0],
      total_price: calculationResult.totalSellPrice,
      customer_name: customer.name || "Walk-in", 
      qbo_customer_id: customer.id || "", 
      art_file_link: inputs.artFileUrl || "", 
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
      const response = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.ok) { setSubmitStatus('success'); setTimeout(() => setSubmitStatus('idle'), 3000); if (config.airtableBaseId) fetchJobs(); setCustomer({ id: '', name: '' }); setInputs(prev => ({...prev, artFileUrl: ''})); } else { setSubmitStatus('error'); }
    } catch (error) { setSubmitStatus('error'); }
  };

  const handleInputChange = (e) => { const { name, value, type, checked } = e.target; setInputs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
  const handleConfigChange = (e) => { const { name, value } = e.target; setConfig(prev => ({ ...prev, [name]: value })); };

  // DEBUG
  console.log("App Rendered. Config:", { hasBase: !!config.airtableBaseId, hasPat: !!config.airtablePat });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <style>{`@media print { body * { visibility: hidden; } .printable-ticket, .printable-ticket * { visibility: visible; } .printable-ticket { position: fixed; left: 0; top: 0; width: 100%; height: 100%; background: white; z-index: 9999; padding: 20px; } .no-print { display: none !important; } }`}</style>
      
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3"><div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg"><Printer size={28} /></div><div><h1 className="text-2xl font-bold text-slate-800">Paramount OS</h1><p className="text-sm text-slate-500">Shop Operating System</p></div></div>
        <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex self-start">
          <button onClick={() => setViewMode('quote')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'quote' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}><DollarSign size={16} /> Quoter</button>
          <button onClick={() => setViewMode('production')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'production' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}><Package size={16} /> Ticket</button>
          <button onClick={() => { setViewMode('dashboard'); fetchJobs(); }} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><Kanban size={16} /> Shop Dashboard</button>
        </div>
      </header>

      {viewMode === 'dashboard' && (
        <main className="max-w-7xl mx-auto relative no-print">
          {(!config.airtableBaseId || !config.airtablePat) ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
               <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
                <div className="flex-1 w-full"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Airtable Base ID</label><input type="text" name="airtableBaseId" value={config.airtableBaseId} onChange={handleConfigChange} placeholder="appXXXXXXXXXXXXXX" className="w-full text-sm border-slate-300 rounded-md font-mono" /></div>
                <div className="flex-1 w-full"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Personal Access Token</label><input type="password" name="airtablePat" value={config.airtablePat} onChange={handleConfigChange} placeholder="patXXXXXXXXXXXXXX..." className="w-full text-sm border-slate-300 rounded-md font-mono" /></div>
                <button onClick={fetchJobs} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 h-10">{loadingJobs ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh</button>
               </div>
               
               <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-400 mb-1 block">Jobs Table Name</label><input type="text" name="airtableTableName" value={config.airtableTableName} onChange={handleConfigChange} placeholder="Jobs" className="w-full text-xs border-slate-200 rounded-md text-slate-500" /></div>
                  <div><label className="text-xs text-slate-400 mb-1 block">Line Items Table Name</label><input type="text" name="airtableLineItemsName" value={config.airtableLineItemsName} onChange={handleConfigChange} placeholder="Line Items" className="w-full text-xs border-slate-200 rounded-md text-slate-500" /></div>
               </div>
            </div>
          ) : ( <div className="flex justify-end mb-4"><button onClick={fetchJobs} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2">{loadingJobs ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh Board</button></div> )}

          {fetchError && <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md shadow-sm"><div className="flex items-center"><AlertTriangle className="text-red-600 mr-3" size={20} /><span className="text-red-700 font-medium">{fetchError}</span></div></div>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-x-auto pb-8">
            {['Draft', 'Approved', 'Production', 'Complete'].map(status => (
              <div key={status} className={`rounded-xl p-4 min-w-[280px] transition-colors ${status === 'Approved' ? 'bg-blue-50' : status === 'Production' ? 'bg-indigo-50' : status === 'Complete' ? 'bg-emerald-50' : 'bg-slate-100'}`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                 <h3 className={`font-bold mb-4 flex items-center gap-2 ${status === 'Approved' ? 'text-blue-800' : status === 'Production' ? 'text-indigo-800' : status === 'Complete' ? 'text-emerald-800' : 'text-slate-600'}`}>{status}</h3>
                 <div className="space-y-3">
                   {jobs.filter(j => j.fields.Status === status || (status === 'Complete' && j.fields.Status === 'Shipped')).map(job => (
                      <div key={job.id} draggable onDragStart={(e) => handleDragStart(e, job.id)} onClick={() => handleJobClick(job)} className={`bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-all cursor-pointer active:scale-[0.98] relative group`}>
                        <div className="flex justify-between items-start mb-2"><span className="text-xs font-mono text-slate-400">{job.fields.Job_ID}</span><span className="text-xs font-bold text-slate-600">{formatCurrency(job.fields.Total_Price)}</span></div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">{job.fields.Project_Name || "Untitled"}</h4>
                        <p className="text-xs text-slate-500 mb-2">{job.fields.Client_Name || "Unknown"}</p>
                      </div>
                   ))}
                 </div>
              </div>
            ))}
          </div>

          {selectedJob && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden printable-ticket">
                   <div className="bg-slate-900 text-white p-6 flex justify-between items-start print:bg-white print:text-black print:border-b print:border-black">
                      <div><p className="text-slate-400 text-xs font-mono mb-1 print:text-black">{selectedJob.fields.Job_ID}</p><h2 className="text-2xl font-bold">{selectedJob.fields.Project_Name}</h2><p className="text-slate-300 text-sm print:text-black">{selectedJob.fields.Client_Name || "Unknown Client"}</p></div>
                      <button onClick={() => setSelectedJob(null)} className="text-slate-400 hover:text-white p-1 no-print"><X size={24} /></button>
                   </div>
                   <div className="p-6 overflow-y-auto flex-1">
                      <div className="flex justify-between items-center mb-6 no-print"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Layers size={20} className="text-blue-600" /> Production Line Items</h3><button onClick={() => window.print()} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded flex items-center gap-2"><Printer size={14} /> Print Traveler</button></div>
                      <div className="hidden print:block mb-4"><h3 className="text-lg font-bold border-b-2 border-black pb-1">WORK ORDER</h3></div>
                      {loadingDetails ? <div className="py-12 flex flex-col items-center justify-center text-slate-400"><Loader size={32} className="animate-spin mb-2" /><p>Fetching...</p></div> : (
                         <div className="space-y-6">
                            {jobLineItems.map((item, idx) => {
                               // Added extra safety here for the parse inside the map
                               let specs = {}; 
                               try { 
                                 if (item && item.fields && item.fields.Production_Specs_JSON) {
                                   specs = JSON.parse(item.fields.Production_Specs_JSON); 
                                 }
                               } catch(e) {
                                 // Silent fail for invalid specs JSON
                               }
                               return (
                                 <div key={item.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 print:bg-white print:border-black print:border-2">
                                    <div className="flex justify-between items-start mb-3 border-b border-slate-200 pb-3 print:border-black">
                                       <div><span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mr-2 print:text-black print:bg-transparent print:border print:border-black">Item #{idx + 1}</span><span className="font-bold text-slate-800 text-lg print:text-black">{item.fields.Material_Type}</span></div>
                                       <div className="text-right"><span className="block font-bold text-2xl">{item.fields.Quantity}</span></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                       <div><p className="text-xs text-slate-400 uppercase font-bold mb-1 print:text-black">Dimensions</p><p className="font-mono font-semibold text-lg">{item.fields.Width_In}" x {item.fields.Height_In}"</p></div>
                                       <div><p className="text-xs text-slate-400 uppercase font-bold mb-1 print:text-black">Finishing</p><p>{item.fields.Cut_Type}</p></div>
                                    </div>
                                    {specs.name && <div className="mt-3 text-xs bg-white p-2 border rounded print:border-black">Use <strong>{specs.name}</strong> sheet. Yield: {specs.yield}. Waste: {typeof specs.waste === 'number' ? specs.waste.toFixed(1) : 0}%</div>}
                                 </div>
                            )})} 
                         </div>
                      )}
                   </div>
                </div>
             </div>
          )}
        </main>
      )}

      {(viewMode === 'quote' || viewMode === 'production') && (
        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
          <div className="lg:col-span-5 space-y-6">
            
            {/* CUSTOMER SEARCH CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-emerald-500">
               <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><User size={18} className="text-emerald-600" /> Customer</h2>
               {customer.name ? (
                  <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-100"><div className="flex items-center gap-3"><div className="bg-emerald-200 text-emerald-800 p-2 rounded-full"><Check size={16} /></div><div><p className="font-bold text-emerald-900 text-sm">{customer.name}</p><p className="text-xs text-emerald-600">QBO ID: {customer.id}</p></div></div><button onClick={() => setCustomer({id:'', name:''})} className="text-emerald-400 hover:text-emerald-700"><X size={16} /></button></div>
               ) : (
                  <div className="relative">
                     <div className="flex gap-2"><input type="text" placeholder="Search QBO (e.g. Acme)" className="flex-1 rounded-md border-slate-300 text-sm p-2" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchCustomers()} /><button onClick={searchCustomers} className="bg-slate-800 text-white p-2 rounded-md hover:bg-slate-700">{isSearchingCustomer ? <Loader size={18} className="animate-spin" /> : <Search size={18} />}</button></div>
                     {customerResults.length > 0 && ( <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-slate-200 rounded-md mt-1 z-10 max-h-40 overflow-y-auto">{customerResults.map(res => (<div key={res.id} onClick={() => selectCustomer(res)} className={`p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0 ${res.id === 'error-msg' ? 'text-red-500 cursor-default hover:bg-white' : res.id === 'no-results' ? 'text-slate-400 cursor-default hover:bg-white' : res.id === 'make-setup' ? 'text-amber-600 bg-amber-50 cursor-default hover:bg-amber-50' : ''}`}><p className={`font-bold ${res.id === 'error-msg' ? 'text-red-500' : res.id === 'make-setup' ? 'text-amber-700' : 'text-slate-700'}`}>{res.DisplayName}</p>{(res.id !== 'error-msg' && res.id !== 'no-results' && res.id !== 'make-setup') && <p className="text-xs text-slate-400">ID: {res.id}</p>}</div>))}</div> )}
                  </div>
               )}
            </div>

            {/* JOB SPECS */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings size={18} className="text-blue-600" /> Job Specs</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Job / Project Name</label><input type="text" name="jobName" placeholder="e.g. Fall Event Signs" value={inputs.jobName} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm border p-2" /></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Width (in)</label><input type="number" name="width" value={inputs.width} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Height (in)</label><input type="number" name="height" value={inputs.height} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" name="quantity" value={inputs.quantity} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Material</label><select name="material" value={inputs.material} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2">{Object.values(MATERIALS).map(m => (<option key={m.key} value={m.name}>{m.name}</option>))}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Print Sides</label><div className="flex gap-4"><label className="flex items-center gap-2 p-2 border rounded-md flex-1 cursor-pointer hover:bg-slate-50"><input type="radio" name="sides" value="1" checked={inputs.sides === '1'} onChange={handleInputChange} /><span>Single Sided</span></label><label className="flex items-center gap-2 p-2 border rounded-md flex-1 cursor-pointer hover:bg-slate-50"><input type="radio" name="sides" value="2" checked={inputs.sides === '2'} onChange={handleInputChange} /><span>Double Sided</span></label></div></div>
              </div>
            </div>

            {/* FINISHING */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Scissors size={18} className="text-green-600" /> Finishing</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Cut Type</label><select name="cutType" value={inputs.cutType} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2"><option value="Rectangular">Rectangular (Free)</option><option value="Contour">Contour / Shape (+$25.00 Setup)</option></select></div>
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <label className="flex items-center justify-between cursor-pointer"><div className="flex items-center gap-2"><input type="checkbox" name="addLamination" checked={inputs.addLamination} onChange={handleInputChange} className="h-4 w-4 text-blue-600 rounded" /><span className="text-sm font-medium text-slate-700">Add Lamination</span></div><span className="text-xs text-slate-500">$2.50/sqft</span></label>
                  <label className="flex items-center justify-between cursor-pointer"><div className="flex items-center gap-2"><input type="checkbox" name="addGrommets" checked={inputs.addGrommets} onChange={handleInputChange} className="h-4 w-4 text-blue-600 rounded" /><span className="text-sm font-medium text-slate-700">Add Grommets</span></div><span className="text-xs text-slate-500">$0.25/ea</span></label>
                </div>
              </div>
            </div>

            {/* ART FILES (NEW) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-indigo-500">
               <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><UploadCloud size={18} className="text-indigo-600" /> Art Files</h2>
               <div className="space-y-3">
                  {/* 1. Direct Upload */}
                  <div className="border-2 border-dashed border-indigo-100 rounded-lg p-4 text-center hover:bg-indigo-50 transition-colors cursor-pointer relative">
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                     {isUploading ? (<div className="flex flex-col items-center justify-center text-indigo-600"><Loader size={24} className="animate-spin mb-2" /><span className="text-sm font-medium">Uploading to Drive...</span></div>) : (<div className="flex flex-col items-center justify-center text-indigo-400"><UploadCloud size={24} className="mb-2" /><span className="text-sm font-medium text-indigo-600">Click to Upload File</span><span className="text-[10px] text-slate-400 mt-1">Max 8MB (Logos, Proofs)</span></div>)}
                  </div>
                  {/* 2. Paste Link */}
                  <div className="relative"><div className="absolute left-3 top-2.5 text-slate-400"><LinkIcon size={16} /></div><input type="text" name="artFileUrl" placeholder="Paste WeTransfer / Dropbox Link" className="w-full pl-9 rounded-md border-slate-300 text-sm p-2" value={inputs.artFileUrl} onChange={handleInputChange} /></div>
                  {inputs.artFileUrl && (<div className="bg-indigo-50 text-indigo-700 text-xs p-2 rounded flex items-center gap-2"><CheckCircle size={14} /> File Link Ready</div>)}
                  {uploadError && <p className="text-red-500 text-xs mt-1">{uploadError}</p>}
               </div>
            </div>

            {/* ADMIN CONFIG (Only shown if not all hardcoded) */}
            {(!HARDCODED_SUBMIT_WEBHOOK || !HARDCODED_SEARCH_WEBHOOK || !HARDCODED_UPLOAD_WEBHOOK) && (
              <div className="bg-slate-100 rounded-xl shadow-inner border border-slate-200 p-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Webhook Settings</h2>
                <div className="space-y-3">
                  {!HARDCODED_SUBMIT_WEBHOOK && <div><label className="block text-[10px] text-slate-500 mb-1">Submit Order Webhook</label><input type="text" name="webhookUrl" value={config.webhookUrl} onChange={handleConfigChange} className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white" placeholder="https://hook..." /></div>}
                  {!HARDCODED_SEARCH_WEBHOOK && <div><label className="block text-[10px] text-slate-500 mb-1">QBO Search Webhook</label><input type="text" name="searchWebhookUrl" value={config.searchWebhookUrl} onChange={handleConfigChange} className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white" placeholder="https://hook..." /></div>}
                  {!HARDCODED_UPLOAD_WEBHOOK && <div><label className="block text-[10px] text-slate-500 mb-1">Drive Upload Webhook</label><input type="text" name="uploadWebhookUrl" value={config.uploadWebhookUrl} onChange={handleConfigChange} className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white" placeholder="https://hook..." /></div>}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-6">
            {calculationResult && (
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center"><h3 className="font-semibold flex items-center gap-2"><DollarSign size={20} /> Customer Quote</h3><span className="text-xs bg-blue-700 px-2 py-1 rounded text-blue-100">Valid for 30 days</span></div>
                <div className="p-6">
                  <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-6">
                    <div><p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Project Cost</p><h2 className="text-4xl font-bold text-slate-900 mt-1">{formatCurrency(calculationResult.totalSellPrice)}</h2></div>
                    <div className="text-right"><p className="text-sm text-slate-500">Price per unit</p><p className="text-xl font-semibold text-slate-700">{formatCurrency(calculationResult.unitPrice)} <span className="text-sm font-normal text-slate-400">/ea</span></p></div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <button onClick={handleSubmit} disabled={(!HARDCODED_SUBMIT_WEBHOOK && !config.webhookUrl) || submitStatus === 'sending' || submitStatus === 'success'} className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${submitStatus === 'success' ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                      {submitStatus === 'idle' && <><Send size={18} /> Submit Order {customer.name && `for ${customer.name}`}</>}
                      {submitStatus === 'sending' && <><Loader size={18} className="animate-spin" /> Sending...</>}
                      {submitStatus === 'success' && <><Check size={18} /> Sent!</>}
                      {submitStatus === 'error' && "Error - Check Webhook"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}