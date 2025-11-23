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
  UserPlus,
  UploadCloud,
  Link as LinkIcon,
  FileText,
  Trash2,
  Calendar,
  MoreHorizontal,
  AlertCircle,
  Code
} from 'lucide-react';

// --- ⚠️ HARDCODED CONFIGURATION ⚠️ ---
// These values will override any local settings
const HARDCODED_SUBMIT_WEBHOOK = "https://hook.us2.make.com/mnsu9apt7zhxfjibn3fm6fyy1qrlotlh"; 
const HARDCODED_SEARCH_WEBHOOK = "https://hook.us2.make.com/1eld4uno29hvl6fifvmw0e4s7ig54was";
const HARDCODED_CREATE_WEBHOOK = "https://hook.us2.make.com/adv73b6j8yxufrxkklj6xtdjr9u5xuqs"; 
const HARDCODED_UPLOAD_WEBHOOK = "https://hook.us2.make.com/oq7wkuxehxjfkngam1rhc9rdltqr3v6s"; 

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

const DASHBOARD_COLUMNS = [
  { id: 'Quote', label: 'Quote', match: ['Quote', 'Draft'], bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  { id: 'Prepress', label: 'Prepress', match: ['Prepress', 'Approved'], bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { id: 'Production', label: 'Production', match: ['Production'], bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  { id: 'Complete', label: 'Complete', match: ['Complete', 'Shipped'], bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' }
];

const MATERIALS = {
  '3mm PVC (Sintra)': {
    key: 'pvc_3mm',
    name: '3mm PVC (Sintra)',
    can_laminate: true,
    sheets: [{ name: '48x96', w: 48, h: 96, cost: 28.41 }, { name: '50x100', w: 50, h: 100, cost: 34.61 }, { name: '60x120', w: 60, h: 120, cost: 44.16 }],
    tiers: [{ limit: 100, price: 6.00 }, { limit: 500, price: 4.80 }, { limit: 1000, price: 3.90 }, { limit: 5000, price: 3.00 }, { limit: 999999, price: 2.50 }]
  },
  '4mm Coroplast': {
    key: 'coro_4mm',
    name: '4mm Coroplast',
    can_laminate: false, 
    sheets: [{ name: '48x96', w: 48, h: 96, cost: 10.04 }, { name: '60x120', w: 60, h: 120, cost: 14.55 }],
    tiers: [{ limit: 100, price: 4.50 }, { limit: 500, price: 3.50 }, { limit: 1000, price: 2.75 }, { limit: 999999, price: 2.75 }]
  },
  '.040 Styrene': {
    key: 'styrene_040',
    name: '.040 Styrene',
    can_laminate: true,
    sheets: [{ name: '48x96', w: 48, h: 96, cost: 14.37 }, { name: '50x100', w: 50, h: 100, cost: 15.60 }, { name: '60x120', w: 60, h: 120, cost: 23.28 }],
    tiers: [{ limit: 100, price: 5.00 }, { limit: 500, price: 4.00 }, { limit: 1000, price: 3.25 }, { limit: 999999, price: 2.75 }]
  }
};

const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

const getDaysSince = (dateString) => {
  if (!dateString) return 0;
  const diff = new Date() - new Date(dateString);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getDueDateStatus = (dateString) => {
  if (!dateString) return null;
  // Handle array if lookup field
  const rawDate = Array.isArray(dateString) ? dateString[0] : dateString;
  const due = new Date(rawDate);
  if (isNaN(due.getTime())) return null; // Invalid date

  const today = new Date();
  today.setHours(0,0,0,0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { color: 'bg-red-100 text-red-700 border-red-200', label: 'Overdue', icon: AlertCircle };
  if (diffDays === 0) return { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Due Today', icon: Clock };
  if (diffDays <= 2) return { color: 'bg-amber-50 text-amber-600 border-amber-200', label: 'Due Soon', icon: Clock };
  return { color: 'bg-slate-100 text-slate-600 border-slate-200', label: due.toLocaleDateString(undefined, {month:'short', day:'numeric'}), icon: Calendar };
};

// Helper to safely find field values with multiple possible names
const getValue = (record, keys, defaultVal = null) => {
    if (!record || !record.fields) return defaultVal;
    for (const key of keys) {
        // Check exact match
        let val = record.fields[key];
        if (val === undefined) {
            // Check lowercase match
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(record.fields).find(k => k.toLowerCase() === lowerKey);
            if (foundKey) val = record.fields[foundKey];
        }

        if (val !== undefined && val !== null) {
            // 🟢 Handle Array Values (Lookup Fields)
            if (Array.isArray(val)) {
                return val[0]; // Return first item if array
            }
            return val;
        }
    }
    return defaultVal;
};

// Helper Component for the Ticket UI
const ProductionTicketCard = ({ data }) => {
    return (
        <div className="border-4 border-slate-900 p-6 rounded-xl bg-white shadow-sm text-left">
            <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{data.jobName || "UNTITLED JOB"}</h2>
                    <p className="text-lg font-bold text-slate-600 mt-1">{data.clientName || "Walk-in Customer"}</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-slate-400 uppercase">Due Date</div>
                    <div className="text-xl font-mono font-bold text-red-600">{data.dueDate ? new Date(data.dueDate).toLocaleDateString() : "N/A"}</div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 mb-8">
                <div className="col-span-8">
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Material</label>
                        <div className="text-2xl font-bold text-slate-900">{data.material}</div>
                        <div className="text-sm font-bold text-slate-500">{data.sides === '2' || data.sides === 2 ? 'DOUBLE SIDED' : 'SINGLE SIDED'}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Width</label>
                            <div className="text-4xl font-black text-slate-900 font-mono">{data.width}"</div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Height</label>
                            <div className="text-4xl font-black text-slate-900 font-mono">{data.height}"</div>
                        </div>
                    </div>
                </div>
                <div className="col-span-4 bg-slate-100 rounded-lg p-4 flex flex-col items-center justify-center border-2 border-slate-200 border-dashed">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Quantity</label>
                    <div className="text-6xl font-black text-slate-900">{data.quantity}</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Finishing & Post-Press</label>
                <div className="flex flex-wrap gap-3">
                    {data.cutType !== 'Rectangular' && data.cutType !== 'None' && <span className="px-3 py-1 bg-pink-100 text-pink-800 font-bold rounded border border-pink-200 flex items-center gap-1"><Scissors size={14} /> {data.cutType || "CONTOUR CUT"}</span>}
                    {(data.cutType === 'Rectangular' || !data.cutType) && <span className="px-3 py-1 bg-slate-200 text-slate-600 font-bold rounded border border-slate-300">RECTANGULAR CUT</span>}
                    {data.lamination && <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded border border-blue-200 flex items-center gap-1"><Layers size={14} /> LAMINATED</span>}
                    {data.grommets && <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded border border-emerald-200 flex items-center gap-1"><CircleIcon /> GROMMETS</span>}
                    {!data.lamination && !data.grommets && (data.cutType === 'Rectangular' || !data.cutType) && <span className="text-sm text-slate-400 italic">No extra finishing</span>}
                </div>
            </div>

            {data.artFileUrl && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded"><FileText size={20} className="text-indigo-600" /></div>
                    <div className="overflow-hidden">
                        <div className="text-xs font-bold text-indigo-400 uppercase">Art File Linked</div>
                        <div className="text-xs text-indigo-700 truncate w-full font-mono">
                            <a href={data.artFileUrl} target="_blank" rel="noreferrer" className="hover:underline">{data.artFileUrl}</a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function App() {
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
    artFileUrl: '',
    dueDate: '' 
  });

  const [customer, setCustomer] = useState({ id: '', name: '' });
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false); 
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showDebug, setShowDebug] = useState(false); 
  const [showSettings, setShowSettings] = useState(false); 

  const [config, setConfig] = useState(() => {
    let loadedConfig = { 
        webhookUrl: '', 
        searchWebhookUrl: '', 
        createWebhookUrl: '', 
        uploadWebhookUrl: '', 
        airtableBaseId: '', 
        airtablePat: '', 
        airtableTableName: 'Jobs', 
        airtableLineItemsName: 'Line Items',
        airtableLinkedFieldName: 'Job_Link'
    };
    
    try { if (typeof window !== 'undefined') { const get = (k) => localStorage.getItem(k) || ''; loadedConfig = { webhookUrl: get('paramount_webhook_url'), searchWebhookUrl: get('paramount_search_webhook_url'), createWebhookUrl: get('paramount_create_webhook_url'), uploadWebhookUrl: get('paramount_upload_webhook_url'), airtableBaseId: get('paramount_at_base'), airtablePat: get('paramount_at_pat'), airtableTableName: get('paramount_at_table') || 'Jobs', airtableLineItemsName: get('paramount_at_lines') || 'Line Items', airtableLinkedFieldName: get('paramount_at_link_col') || 'Job_Link' }; } } catch (e) {}
    
    if (HARDCODED_SUBMIT_WEBHOOK) loadedConfig.webhookUrl = HARDCODED_SUBMIT_WEBHOOK;
    if (HARDCODED_SEARCH_WEBHOOK) loadedConfig.searchWebhookUrl = HARDCODED_SEARCH_WEBHOOK;
    if (HARDCODED_CREATE_WEBHOOK) loadedConfig.createWebhookUrl = HARDCODED_CREATE_WEBHOOK; 
    if (HARDCODED_UPLOAD_WEBHOOK) loadedConfig.uploadWebhookUrl = HARDCODED_UPLOAD_WEBHOOK;
    if (HARDCODED_AIRTABLE_BASE_ID) loadedConfig.airtableBaseId = HARDCODED_AIRTABLE_BASE_ID;
    if (HARDCODED_AIRTABLE_PAT) loadedConfig.airtablePat = HARDCODED_AIRTABLE_PAT;
    return loadedConfig;
  });

  useEffect(() => {
    try { if (typeof window !== 'undefined') {
        if (!HARDCODED_SUBMIT_WEBHOOK) localStorage.setItem('paramount_webhook_url', config.webhookUrl);
        if (!HARDCODED_SEARCH_WEBHOOK) localStorage.setItem('paramount_search_webhook_url', config.searchWebhookUrl);
        if (!HARDCODED_CREATE_WEBHOOK) localStorage.setItem('paramount_create_webhook_url', config.createWebhookUrl); 
        if (!HARDCODED_UPLOAD_WEBHOOK && config.uploadWebhookUrl) localStorage.setItem('paramount_upload_webhook_url', config.uploadWebhookUrl);
        if (!HARDCODED_AIRTABLE_BASE_ID) localStorage.setItem('paramount_at_base', config.airtableBaseId);
        if (!HARDCODED_AIRTABLE_PAT) localStorage.setItem('paramount_at_pat', config.airtablePat);
        localStorage.setItem('paramount_at_table', config.airtableTableName);
        localStorage.setItem('paramount_at_lines', config.airtableLineItemsName);
        localStorage.setItem('paramount_at_link_col', config.airtableLinkedFieldName);
    } } catch (e) { }
  }, [config]);

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [fetchError, setFetchError] = useState(null); 
  const [draggingJobId, setDraggingJobId] = useState(null); 
  const [dragOverJobId, setDragOverJobId] = useState(null); 
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobLineItems, setJobLineItems] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchCustomers = async () => {
    const targetUrl = config.searchWebhookUrl;
    if (!targetUrl) { alert("Please add your Customer Search Webhook URL."); return; }
    if (!customerQuery) return;
    setIsSearchingCustomer(true);
    setCustomerResults([]);
    try {
      const response = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: customerQuery }) });
      const rawText = await response.text();
      if (rawText === "Accepted") {
        if (customerQuery.toLowerCase().includes('acme')) setCustomerResults([{ id: '99', DisplayName: 'Acme Corp (Demo)' }]);
        else setCustomerResults([{ id: 'make-setup', DisplayName: '⚠️ Search Webhook needs "Webhook Response" module' }]);
        setIsSearchingCustomer(false); return;
      }
      let data = null;
      try { if (rawText && rawText.trim().length > 0) data = JSON.parse(rawText); } catch (e) { throw new Error(`Response was not JSON.`); }
      let results = [];
      if (Array.isArray(data)) results = data;
      else if (data && typeof data === 'object') {
        results = data.data || data.results || data.customers || data.items || [];
        if (!Array.isArray(results) && (data.id || data.Id || data.ID || data.DisplayName)) results = [data];
      }
      const normalizedResults = Array.isArray(results) ? results.map(c => ({ id: c.id || c.Id || c.ID || 'unknown', DisplayName: c.DisplayName || c.name || c.FullyQualifiedName || 'Unknown Name' })) : [];
      const finalResults = [...normalizedResults];
      if (finalResults.length === 0) {
         if (customerQuery.toLowerCase().includes('acme')) finalResults.push({ id: '99', DisplayName: 'Acme Corp (Demo)' });
         else finalResults.push({ id: 'no-results', DisplayName: 'No customers found.' });
      }
      if (customerQuery.trim().length > 1) finalResults.push({ id: 'create-new', DisplayName: `+ Create "${customerQuery}" in QuickBooks`, isAction: true });
      setCustomerResults(finalResults);
    } catch (error) { setCustomerResults([{ id: 'error-msg', DisplayName: `Error: ${error.message}` }]); } finally { setIsSearchingCustomer(false); }
  };

  const handleCreateCustomer = async () => {
    const targetUrl = config.createWebhookUrl;
    if (!targetUrl) { alert("Please set the 'Create Customer Webhook URL'."); return; }
    setIsCreatingCustomer(true);
    try {
        const response = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: customerQuery }) });
        if (!response.ok) throw new Error("Webhook Error");
        const rawText = await response.text();
        if (rawText === "Accepted") throw new Error("Make returned 'Accepted'. Add a Webhook Response module.");
        const data = JSON.parse(rawText);
        const newId = data.id || data.Id || data.ID;
        const newName = data.DisplayName || data.name || data.FullyQualifiedName || customerQuery;
        if (newId) { setCustomer({ id: newId, name: newName }); setCustomerResults([]); setCustomerQuery(''); } else { alert("Customer created, but no ID returned."); }
    } catch (error) { alert(`Creation failed: ${error.message}`); } finally { setIsCreatingCustomer(false); }
  };

  const selectCustomer = (cust) => {
    if (cust.id === 'create-new') { handleCreateCustomer(); return; }
    if (cust.id === 'error-msg' || cust.id === 'no-results' || cust.id === 'make-setup') return; 
    setCustomer({ id: cust.id, name: cust.DisplayName }); setCustomerResults([]); setCustomerQuery(''); 
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const targetUrl = config.uploadWebhookUrl; 
    if (!targetUrl) { alert("Please set the Upload Webhook URL."); return; }
    if (file.size > 100 * 1024 * 1024) { alert("File > 100MB. Please use a link."); return; }
    setIsUploading(true); setUploadError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]; 
        const lastDot = file.name.lastIndexOf('.');
        const ext = lastDot === -1 ? '' : file.name.substring(lastDot);
        const originalName = lastDot === -1 ? file.name : file.name.substring(0, lastDot);
        const cleanOriginal = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const cleanJob = inputs.jobName ? inputs.jobName.replace(/[^a-zA-Z0-9._-]/g, '_') : 'Quote';
        const quoteRef = Date.now().toString().slice(-6); 
        const finalName = `${cleanJob}_${cleanOriginal}_Ref${quoteRef}${ext}`;
        const response = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: finalName, mime: file.type, data: base64Data }) });
        if (!response.ok) throw new Error("Upload failed");
        const rawText = await response.text();
        if (rawText === "Accepted") { setUploadError("Error: Make 'Accepted'"); setIsUploading(false); return; }
        const result = JSON.parse(rawText);
        if (result.url) setInputs(prev => ({ ...prev, artFileUrl: result.url })); else throw new Error("No URL returned");
        setIsUploading(false);
      };
    } catch (error) { setUploadError("Upload failed."); setIsUploading(false); }
  };

  const handleDragStart = (e, jobId) => { setDraggingJobId(jobId); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e, jobId = null) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (jobId && jobId !== draggingJobId) setDragOverJobId(jobId); };
  const handleDrop = async (e, targetStatus, targetJobId = null) => {
    e.preventDefault(); setDragOverJobId(null); if (!draggingJobId) return;
    const draggedJob = jobs.find(j => j.id === draggingJobId); if (!draggedJob) return;
    let newJobs = [...jobs];
    const draggedJobIndex = newJobs.findIndex(j => j.id === draggingJobId);
    newJobs.splice(draggedJobIndex, 1);
    const updatedDraggedJob = { ...draggedJob, fields: { ...draggedJob.fields, Status: targetStatus } };
    if (targetJobId) {
        const targetIndex = newJobs.findIndex(j => j.id === targetJobId);
        if (targetIndex !== -1) newJobs.splice(targetIndex, 0, updatedDraggedJob); else newJobs.push(updatedDraggedJob); 
    } else newJobs.push(updatedDraggedJob);
    setJobs(newJobs); setDraggingJobId(null);
    if (config.airtableBaseId && config.airtablePat && draggedJob.fields.Status !== targetStatus) {
      try {
        const tableName = config.airtableTableName || 'Jobs';
        const encodedTable = encodeURIComponent(tableName);
        await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}/${draggedJob.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${config.airtablePat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { Status: targetStatus }, typecast: true }) });
      } catch (error) { fetchJobs(); } 
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob) return;
    if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) return;
    setIsDeleting(true);
    try {
        const tableName = config.airtableTableName || 'Jobs';
        const encodedTable = encodeURIComponent(tableName);
        const response = await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}/${selectedJob.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${config.airtablePat}` } });
        if (!response.ok) throw new Error("Delete failed");
        setJobs(prev => prev.filter(j => j.id !== selectedJob.id)); setSelectedJob(null);
    } catch (error) { alert("Failed to delete job: " + error.message); } finally { setIsDeleting(false); }
  };

  const calculationResult = useMemo(() => {
    const matData = MATERIALS[inputs.material];
    // 🟢 Fallback: Always return structure, even if invalid, to keep UI rendered
    if (!matData) {
        return { specs: { totalSqFt: 0 }, costs: { print: 0, setup: 0 }, totalSellPrice: 0, unitPrice: 0, production: null, profitability: { grossMargin: 0 } };
    }
    const width = parseFloat(inputs.width) || 0;
    const height = parseFloat(inputs.height) || 0;
    const qty = parseInt(inputs.quantity) || 0;
    if (width === 0 || height === 0 || qty === 0) {
        return { specs: { totalSqFt: 0 }, costs: { print: 0, setup: 0 }, totalSellPrice: 0, unitPrice: 0, production: null, profitability: { grossMargin: 0 } };
    }
    const itemSqFt = (width * height) / 144;
    const totalSqFt = itemSqFt * qty;
    let tierRate = 0;
    for (const tier of matData.tiers) { if (totalSqFt <= tier.limit) { tierRate = tier.price; break; } }
    let basePrintCost = totalSqFt * tierRate;
    if (inputs.sides === '2') basePrintCost *= DOUBLE_SIDED_MULTIPLIER;
    const costs = { print: basePrintCost, setup: GLOBAL_SETUP_FEE, lamination: 0, grommets: 0, contour: 0 };
    if (inputs.addLamination) {
      if (!matData.can_laminate) {} else { let lamCost = totalSqFt * FINISHING_RATES.lamination; if (lamCost < FINISHING_RATES.lamination_min) lamCost = FINISHING_RATES.lamination_min; costs.lamination = lamCost; }
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
    return { specs: { totalSqFt, tierRate, itemSqFt }, costs, totalSellPrice, unitPrice, production: bestSheet, profitability: { grossMargin, marginPercent } };
  }, [inputs]);

  const fetchJobs = async () => {
    setFetchError(null);
    const baseId = config.airtableBaseId; const pat = config.airtablePat;
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

  // 🟢 SMART FETCH LINE ITEMS (UPDATED to use IDs)
  const fetchLineItems = async (job) => {
    setLoadingDetails(true); setJobLineItems([]);
    const tableName = config.airtableLineItemsName || 'Line Items'; 
    const baseId = config.airtableBaseId; 
    const pat = config.airtablePat;
    const linkedField = config.airtableLinkedFieldName || 'Job_Link';
    const encodedTable = encodeURIComponent(tableName);

    try {
        let url = '';
        // 🟢 Check if job has direct linked IDs
        const possibleLinkCols = ['Line Items', 'LineItems', 'Items', 'Line_Items'];
        let linkedIds = [];
        for (const key of possibleLinkCols) {
            if (Array.isArray(job.fields[key])) { linkedIds = job.fields[key]; break; }
        }

        if (linkedIds.length > 0) {
            // Use RECORD_ID() formula
            const formula = `OR(${linkedIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;
            url = `https://api.airtable.com/v0/${baseId}/${encodedTable}?filterByFormula=${encodeURIComponent(formula)}`;
        } else {
            // Fallback to column text matching
            const filterFormula = `filterByFormula=${encodeURIComponent(`{${linkedField}}='${job.id}'`)}`;
            url = `https://api.airtable.com/v0/${baseId}/${encodedTable}?${filterFormula}`;
        }

        const response = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
        if (response.ok) { 
            const data = await response.json(); 
            setJobLineItems(data.records); 
        }
    } catch (error) { console.error("Fetch Line Items Error:", error); } finally { setLoadingDetails(false); }
  };

  // 🟢 Pass whole job object
  const handleJobClick = (job) => { setSelectedJob(job); fetchLineItems(job); };

  const handleSubmit = async () => {
    const targetUrl = config.webhookUrl;
    if (!targetUrl) { alert("Please enter a Submit Webhook URL."); return; }
    setSubmitStatus('sending');
    const payload = {
      job_name: inputs.jobName || "Untitled Job",
      order_date: new Date().toISOString().split('T')[0],
      due_date: inputs.dueDate, 
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
          {(!config.airtableBaseId || !config.airtablePat || showSettings) ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
               {/* Config Inputs */}
               <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-slate-600">Connection Settings</h3>{showSettings && <button onClick={() => setShowSettings(false)} className="text-xs text-slate-400 underline">Close</button>}</div>
               <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
                <div className="flex-1 w-full"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Airtable Base ID</label><input type="text" name="airtableBaseId" value={config.airtableBaseId} onChange={handleConfigChange} placeholder="appXXXXXXXXXXXXXX" className="w-full text-sm border-slate-300 rounded-md font-mono" /></div>
                <div className="flex-1 w-full"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Personal Access Token</label><input type="password" name="airtablePat" value={config.airtablePat} onChange={handleConfigChange} placeholder="patXXXXXXXXXXXXXX..." className="w-full text-sm border-slate-300 rounded-md font-mono" /></div>
                <button onClick={() => { setShowSettings(false); fetchJobs(); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 h-10">{loadingJobs ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh</button>
               </div>
               <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="text-xs text-slate-400 mb-1 block">Jobs Table Name</label><input type="text" name="airtableTableName" value={config.airtableTableName} onChange={handleConfigChange} placeholder="Jobs" className="w-full text-xs border-slate-200 rounded-md text-slate-500" /></div>
                  <div><label className="text-xs text-slate-400 mb-1 block">Line Items Table Name</label><input type="text" name="airtableLineItemsName" value={config.airtableLineItemsName} onChange={handleConfigChange} placeholder="Line Items" className="w-full text-xs border-slate-200 rounded-md text-slate-500" /></div>
                  <div><label className="text-xs text-slate-400 mb-1 block">Column Linking to Jobs</label><input type="text" name="airtableLinkedFieldName" value={config.airtableLinkedFieldName} onChange={handleConfigChange} placeholder="Job_Link (exact name)" className="w-full text-xs border-slate-200 rounded-md text-slate-500" /></div>
               </div>
            </div>
          ) : ( 
            <div className="flex justify-end mb-4 gap-2">
                <button onClick={() => setShowSettings(true)} className="bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 p-2 rounded-md"><Settings size={16} /></button>
                <button onClick={fetchJobs} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2">{loadingJobs ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh Board</button>
            </div> 
          )}

          {fetchError && <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md shadow-sm"><div className="flex items-center"><AlertTriangle className="text-red-600 mr-3" size={20} /><span className="text-red-700 font-medium">{fetchError}</span></div></div>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-x-auto pb-8">
            {DASHBOARD_COLUMNS.map(col => (
              <div key={col.id} className={`rounded-xl p-4 min-w-[280px] transition-colors border-t-4 ${col.border} ${col.bg}`} onDragOver={(e) => handleDragOver(e)} onDrop={(e) => handleDrop(e, col.id)}>
                 <h3 className={`font-bold mb-4 flex items-center gap-2 ${col.text} text-lg`}>{col.label} <span className="bg-white/50 text-xs px-2 py-1 rounded-full">{jobs.filter(j => col.match.includes(j.fields.Status)).length}</span></h3>
                 <div className="space-y-3 min-h-[200px]">
                   {jobs.filter(j => col.match.includes(j.fields.Status)).map(job => {
                      const daysOld = getDaysSince(job.createdTime);
                      const isArtReady = job.fields.Art_File_Link || false;
                      const dueStatus = getDueDateStatus(job.fields.Due_Date);
                      return (
                        <div key={job.id} draggable onDragStart={(e) => handleDragStart(e, job.id)} onDragOver={(e) => handleDragOver(e, job.id)} onDrop={(e) => { e.stopPropagation(); handleDrop(e, col.id, job.id); }} onClick={() => handleJobClick(job)} className={`bg-white p-4 rounded-lg shadow-sm border cursor-pointer relative group transition-all ${dragOverJobId === job.id ? 'border-blue-500 border-2 translate-y-1' : 'border-slate-200 hover:shadow-md hover:-translate-y-0.5'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{job.fields.Job_ID || 'ID...'}</span>
                                {dueStatus && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 border ${dueStatus.color}`}><dueStatus.icon size={10} /> {dueStatus.label}</span>}
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{job.fields.Project_Name || "Untitled"}</h4>
                            <p className="text-xs text-slate-500 mb-3 truncate">{job.fields.Client_Name || "Unknown"}</p>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
                                <span className="text-xs font-bold text-slate-600">{formatCurrency(job.fields.Total_Price)}</span>
                                <div className="flex gap-2">{isArtReady && <div className="text-indigo-500" title="Art File Attached"><FileText size={14} /></div>}{!dueStatus && daysOld < 2 && <div className="text-emerald-500" title="New Job"><Clock size={14} /></div>}</div>
                            </div>
                        </div>
                      );
                   })}
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
                      <div className="flex justify-between items-center mb-6 no-print">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Layers size={20} className="text-blue-600" /> Production Line Items</h3>
                          <div className="flex gap-2">
                            <button onClick={handleDeleteJob} disabled={isDeleting} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded flex items-center gap-2 transition-colors">{isDeleting ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Job</button>
                            <button onClick={() => window.print()} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded flex items-center gap-2"><Printer size={14} /> Print Traveler</button>
                          </div>
                      </div>
                      {selectedJob.fields.Due_Date && <div className="bg-amber-50 border border-amber-100 rounded p-3 mb-4 flex items-center gap-2 text-amber-800 font-bold text-sm"><Clock size={16} /> Due: {new Date(selectedJob.fields.Due_Date).toLocaleDateString()}</div>}

                      {/* 🟢 TICKET VIEW RENDERER IN MODAL */}
                      {(() => {
                          if (loadingDetails) {
                              return <div className="py-12 flex flex-col items-center justify-center text-slate-400"><Loader size={32} className="animate-spin mb-2" /><p>Fetching specs...</p></div>;
                          }

                          // Data Preparation
                          const item = jobLineItems.length > 0 ? jobLineItems[0] : selectedJob;
                          let jsonSpecs = {};
                          try {
                              const potentialKeys = ['Production_Specs_JSON', 'Item_Details_JSON', 'Details_JSON', 'Specs_JSON', 'Item_Details', 'Item Details', 'JSON'];
                              let jsonField = null;
                              for (const key of potentialKeys) { if (item.fields[key]) { jsonField = item.fields[key]; break; } }
                              if (jsonField) {
                                  const parsed = typeof jsonField === 'object' ? jsonField : JSON.parse(jsonField);
                                  jsonSpecs = parsed.item_details || parsed; 
                              }
                          } catch(e) { console.warn("JSON Parse Error", e); }

                          const resolve = (keys, defaultVal) => {
                              const fieldVal = getValue(item, keys);
                              if (fieldVal !== undefined && fieldVal !== null && fieldVal !== "") return fieldVal;
                              for (const k of keys) {
                                  if (jsonSpecs[k] !== undefined) return jsonSpecs[k];
                                  if (jsonSpecs[k.toLowerCase()] !== undefined) return jsonSpecs[k.toLowerCase()];
                              }
                              return defaultVal;
                          };

                          // 🟢 SMART RESOLVE: Check Job Record for these specific fields (Client, Due Date)
                          // Because often these are on the Job, not the Line Item
                          const clientName = getValue(selectedJob, ['Client_Name', 'Client Name', 'Client', 'Customer_Name', 'Customer Name', 'Customer', 'Company'], "Walk-in Customer");
                          const dueDate = getValue(selectedJob, ['Due_Date', 'Due Date', 'DueDate', 'Deadline', 'Date Due'], null);
                          const jobName = getValue(selectedJob, ['Project_Name', 'Project Name', 'Job Name', 'Name'], "UNTITLED JOB");

                          // Normalize Data Object for Ticket Component
                          const ticketData = {
                              jobName: jobName,
                              clientName: clientName,
                              dueDate: dueDate,
                              material: resolve(['Material_Type', 'Material', 'material', 'Material Name', 'Substrate', 'Item'], 'N/A'),
                              width: resolve(['Width_In', 'Width', 'width', 'Width (in)', 'W'], '0'),
                              height: resolve(['Height_In', 'Height', 'height', 'Height (in)', 'H'], '0'),
                              quantity: resolve(['Quantity', 'Qty', 'quantity', 'Count'], '0'),
                              sides: resolve(['Sides', 'Print Sides', 'sides'], '1'),
                              cutType: resolve(['Cut_Type', 'Finishing', 'Cut Type', 'Cut'], 'None'),
                              lamination: resolve(['Lamination', 'lamination', 'Laminate'], false),
                              grommets: resolve(['Grommets', 'grommets', 'Grommet'], false),
                              artFileUrl: resolve(['Art_File_Link', 'Art File', 'File'], '')
                          };

                          return (
                              <div className="p-4 bg-yellow-50/50 rounded-xl">
                                  <ProductionTicketCard data={ticketData} />
                                  {/* If multiple line items exist, show them below as a list */}
                                  {jobLineItems.length > 1 && (
                                      <div className="mt-8 border-t pt-6">
                                          <h4 className="font-bold text-slate-500 text-sm uppercase mb-4">Additional Items in this Job</h4>
                                          <div className="space-y-2">
                                              {jobLineItems.slice(1).map((subItem, idx) => (
                                                  <div key={subItem.id} className="bg-white p-3 rounded border text-sm flex justify-between">
                                                      <span>{getValue(subItem, ['Material_Type', 'Material'])} ({getValue(subItem, ['Width_In', 'Width'])}" x {getValue(subItem, ['Height_In', 'Height'])}")</span>
                                                      <span className="font-bold">Qty: {getValue(subItem, ['Quantity', 'Qty'])}</span>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          );
                      })()}

                      {/* 🟢 NEW DEBUG FOOTER */}
                      <div className="mt-8 pt-4 border-t border-slate-100 text-center no-print">
                          <button onClick={() => setShowDebug(!showDebug)} className="text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto"><Code size={12} /> {showDebug ? 'Hide' : 'Show'} Debug Info</button>
                          {showDebug && (
                              <div className="text-left bg-slate-900 text-green-400 p-4 rounded mt-2 text-xs font-mono overflow-auto max-h-60">
                                  <p className="text-white font-bold mb-2 border-b border-slate-700 pb-1">DEBUGGER</p>
                                  <p>Job ID: {selectedJob.id}</p>
                                  <p>Line Items Found: {jobLineItems.length}</p>
                                  <p>Link Column Used: {config.airtableLinkedFieldName}</p>
                                  <p className="mt-2 text-yellow-300">Raw Job Fields:</p>
                                  <pre>{JSON.stringify(selectedJob.fields, null, 2)}</pre>
                                  {jobLineItems.length > 0 ? (
                                      <>
                                          <p className="mt-2 text-yellow-300">Raw Line Item [0] Fields:</p>
                                          <pre>{JSON.stringify(jobLineItems[0].fields, null, 2)}</pre>
                                      </>
                                  ) : (
                                      <p className="mt-2 text-red-400">No Line Items found. Ensure Airtable columns link correctly.</p>
                                  )}
                              </div>
                          )}
                      </div>

                   </div>
                </div>
             </div>
          )}
        </main>
      )}
    </div>
  );
}