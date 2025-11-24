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
  Code,
  Plus,
  BookOpen,
  Save,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';

// --- ⚠️ HARDCODED CONFIGURATION ⚠️ ---
const HARDCODED_SUBMIT_WEBHOOK = "https://hook.us2.make.com/mnsu9apt7zhxfjibn3fm6fyy1qrlotlh"; 
const HARDCODED_SEARCH_WEBHOOK = "https://hook.us2.make.com/1eld4uno29hvl6fifvmw0e4s7ig54was";
const HARDCODED_CREATE_WEBHOOK = "https://hook.us2.make.com/adv73b6j8yxufrxkklj6xtdjr9u5xuqs"; 
const HARDCODED_UPLOAD_WEBHOOK = "https://hook.us2.make.com/oq7wkuxehxjfkngam1rhc9rdltqr3v6s"; 

const HARDCODED_AIRTABLE_BASE_ID = "app3QrZgktGpCp21l"; 
const HARDCODED_AIRTABLE_PAT = "pateL0HJlHko5bI1x.53da74b4f542f8ac101af18d4fa4ba87666faebb4835b2c967bc9492c2d95588";     

const GLOBAL_SETUP_FEE = 40.00;
const CONTOUR_SETUP_FEE = 25.00;
const DOUBLE_SIDED_MULTIPLIER = 1.6;

const FINISHING_RATES = {
  grommets: 0.25,
  lamination: 2.50,
  lamination_min: 20.00,
  coil_binding: 5.00, 
  stapling: 0.50      
};

const DASHBOARD_COLUMNS = [
  { id: 'Quote', label: 'Quote', match: ['Quote', 'Draft'], bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  { id: 'Prepress', label: 'Prepress', match: ['Prepress', 'Approved'], bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { id: 'Production', label: 'Production', match: ['Production'], bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  { id: 'Complete', label: 'Complete', match: ['Complete', 'Shipped'], bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' }
];

const DEFAULT_DIGITAL_PRODUCTS = [
  { id: 'menu_85_14', name: 'Menu 8.5x14 (Synthetic)', width: 8.5, height: 14, basePrice: 2.50, perPagePrice: 0.00, binding: 'None' },
  { id: 'booklet_85_11', name: 'Coil Bound Book 8.5x11', width: 8.5, height: 11, basePrice: 5.00, perPagePrice: 0.25, binding: 'Coil' },
  { id: 'flyer_4_6', name: 'Flyer 4x6 (Cardstock)', width: 4, height: 6, basePrice: 0.45, perPagePrice: 0.00, binding: 'None' },
  { id: 'biz_card', name: 'Business Cards (Set of 250)', width: 3.5, height: 2, basePrice: 45.00, perPagePrice: 0.00, binding: 'None' }
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

const safeFormatDate = (dateInput) => {
    if (!dateInput) return "";
    let raw = dateInput;
    while (Array.isArray(raw)) { if (raw.length === 0) return ""; raw = raw[0]; }
    try {
        let date;
        if (typeof raw === 'string' && raw.match(/^\d{4}-\d{2}-\d{2}$/)) { date = new Date(raw + 'T12:00:00'); } 
        else { date = new Date(raw); }
        if (isNaN(date.getTime())) return ""; 
        return date.toLocaleDateString();
    } catch (e) { return ""; }
};

const getDueDateStatus = (dateInput) => {
  if (!dateInput) return null;
  let rawDate = dateInput;
  while (Array.isArray(rawDate)) { if (rawDate.length === 0) return null; rawDate = rawDate[0]; }
  let due;
  if (typeof rawDate === 'string' && rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) { due = new Date(rawDate + 'T12:00:00'); } 
  else { due = new Date(rawDate); }
  if (isNaN(due.getTime())) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { color: 'bg-red-100 text-red-700 border-red-200', label: 'Overdue', icon: AlertCircle };
  if (diffDays === 0) return { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Due Today', icon: Clock };
  if (diffDays <= 2) return { color: 'bg-amber-50 text-amber-600 border-amber-200', label: 'Due Soon', icon: Clock };
  return { color: 'bg-slate-100 text-slate-600 border-slate-200', label: due.toLocaleDateString(undefined, {month:'short', day:'numeric'}), icon: Calendar };
};

// 🟢 SMART FIELD RESOLVER (IMPROVED for Arrays/Lookups)
const getValue = (record, keys, defaultVal = null) => {
    if (!record || !record.fields) return defaultVal;
    for (const key of keys) {
        let val = record.fields[key];
        if (val === undefined) {
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(record.fields).find(k => k.toLowerCase() === lowerKey);
            if (foundKey) val = record.fields[foundKey];
        }
        if (val !== undefined && val !== null && val !== "") {
            while (Array.isArray(val)) { if (val.length === 0) return defaultVal; val = val[0]; }
            return val;
        }
    }
    return defaultVal;
};

// Helper Component for the Ticket UI
const ProductionTicketCard = ({ data }) => {
    const formattedDate = safeFormatDate(data.dueDate) || "N/A";
    
    // Format Address Helper
    const formatAddress = (addr) => {
        if (!addr) return null;
        if (typeof addr === 'string') return addr;
        if (typeof addr === 'object') {
            // Handle QBO Address Object
            const line1 = addr.Line1 || '';
            const city = addr.City || '';
            const state = addr.CountrySubDivisionCode || '';
            const postal = addr.PostalCode || '';
            return `${line1}, ${city} ${state} ${postal}`.replace(/,\s+$/, '').trim();
        }
        return null;
    };

    const shipAddress = formatAddress(data.shipAddr);

    return (
        <div className="border-4 border-slate-900 p-6 rounded-xl bg-white shadow-sm text-left">
            <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{data.jobName || "UNTITLED JOB"}</h2>
                    <p className="text-lg font-bold text-slate-600 mt-1">{data.clientName}</p>
                    
                    {/* 🟢 CONTACT INFO SECTION */}
                    {(data.email || data.phone || shipAddress) && (
                        <div className="mt-3 text-xs text-slate-500 space-y-1 font-mono">
                            {data.email && <div className="flex items-center gap-2"><Mail size={12} /> {data.email}</div>}
                            {data.phone && <div className="flex items-center gap-2"><Phone size={12} /> {data.phone}</div>}
                            {shipAddress && <div className="flex items-start gap-2"><MapPin size={12} className="mt-0.5" /> {shipAddress}</div>}
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-slate-400 uppercase">Due Date</div>
                    <div className="text-xl font-mono font-bold text-red-600">{formattedDate}</div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 mb-8">
                <div className="col-span-8">
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Product / Material</label>
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
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Finishing & Production Notes</label>
                <div className="flex flex-wrap gap-3">
                    {data.cutType !== 'Rectangular' && data.cutType !== 'None' && <span className="px-3 py-1 bg-pink-100 text-pink-800 font-bold rounded border border-pink-200 flex items-center gap-1"><Scissors size={14} /> {data.cutType || "CONTOUR CUT"}</span>}
                    {(data.cutType === 'Rectangular' || !data.cutType) && <span className="px-3 py-1 bg-slate-200 text-slate-600 font-bold rounded border border-slate-300">RECTANGULAR CUT</span>}
                    {data.lamination && <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded border border-blue-200 flex items-center gap-1"><Layers size={14} /> LAMINATED</span>}
                    {data.grommets && <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded border border-emerald-200 flex items-center gap-1"><CircleIcon /> GROMMETS</span>}
                    
                    {/* Digital Finishing */}
                    {data.binding === 'Coil' && <span className="px-3 py-1 bg-orange-100 text-orange-800 font-bold rounded border border-orange-200 flex items-center gap-1"><BookOpen size={14} /> COIL BOUND</span>}
                    {data.binding === 'Staple' && <span className="px-3 py-1 bg-orange-100 text-orange-800 font-bold rounded border border-orange-200 flex items-center gap-1">STAPLED</span>}
                    {data.pages > 0 && <span className="px-3 py-1 bg-slate-200 text-slate-800 font-bold rounded border border-slate-300">{data.pages} PAGES</span>}

                    {!data.lamination && !data.grommets && !data.binding && (data.cutType === 'Rectangular' || !data.cutType) && <span className="text-sm text-slate-400 italic">Standard Finishing</span>}
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
  const [quoteType, setQuoteType] = useState('large_format'); 
  
  const [digitalProducts, setDigitalProducts] = useState(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('paramount_digital_products');
          if (saved) return JSON.parse(saved);
      }
      return DEFAULT_DIGITAL_PRODUCTS;
  });

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
    dueDate: '',
    digitalProductId: '',
    customDigitalName: '',
    unitPrice: 0,
    pageCount: 0,
    bindingType: 'None'
  });

  // 🟢 UPDATED CUSTOMER STATE
  const [customer, setCustomer] = useState({ id: '', name: '', email: '', phone: '', shipAddr: null });
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false); 
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showDebug, setShowDebug] = useState(false); 
  const [showSettings, setShowSettings] = useState(false); 
  const [newProduct, setNewProduct] = useState({ name: '', width: 0, height: 0, basePrice: 0, perPagePrice: 0, binding: 'None' });

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
        localStorage.setItem('paramount_digital_products', JSON.stringify(digitalProducts));
    } } catch (e) { }
  }, [config, digitalProducts]);

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

  // 🟢 UPDATED SEARCH LOGIC TO EXTRACT QBO FIELDS
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
      
      // 🟢 EXTRACT EXTRA FIELDS
      const normalizedResults = Array.isArray(results) ? results.map(c => ({
         id: c.id || c.Id || c.ID || 'unknown',
         DisplayName: c.DisplayName || c.name || c.FullyQualifiedName || 'Unknown Name',
         email: c.PrimaryEmailAddr?.Address || c.email || '',
         phone: c.PrimaryPhone?.FreeFormNumber || c.phone || '',
         shipAddr: c.ShipAddr || c.shippingAddress || null
      })) : [];

      const finalResults = [...normalizedResults];
      if (finalResults.length === 0) {
         if (customerQuery.toLowerCase().includes('acme')) finalResults.push({ id: '99', DisplayName: 'Acme Corp (Demo)', email: 'demo@acme.com', phone: '555-123-4567' });
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
        if (newId) { setCustomer({ id: newId, name: newName, email: '', phone: '', shipAddr: null }); setCustomerResults([]); setCustomerQuery(''); } else { alert("Customer created, but no ID returned."); }
    } catch (error) { alert(`Creation failed: ${error.message}`); } finally { setIsCreatingCustomer(false); }
  };

  const selectCustomer = (cust) => {
    if (cust.id === 'create-new') { handleCreateCustomer(); return; }
    if (cust.id === 'error-msg' || cust.id === 'no-results' || cust.id === 'make-setup') return; 
    setCustomer({ 
        id: cust.id, 
        name: cust.DisplayName,
        email: cust.email,
        phone: cust.phone,
        shipAddr: cust.shipAddr
    }); 
    setCustomerResults([]); setCustomerQuery(''); 
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
    const qty = parseInt(inputs.quantity) || 0;
    
    if (quoteType === 'large_format') {
        const matData = MATERIALS[inputs.material] || Object.values(MATERIALS)[0];
        const width = parseFloat(inputs.width) || 0;
        const height = parseFloat(inputs.height) || 0;
        
        if (width === 0 || height === 0 || qty === 0 || !matData) {
            return { specs: { totalSqFt: 0 }, costs: { print: 0, setup: 0 }, totalSellPrice: 0, unitPrice: 0, production: null, profitability: { grossMargin: 0 } };
        }

        const itemSqFt = (width * height) / 144;
        const totalSqFt = itemSqFt * qty;
        let tierRate = 0;
        if (matData.tiers) { for (const tier of matData.tiers) { if (totalSqFt <= tier.limit) { tierRate = tier.price; break; } } }
        
        let basePrintCost = totalSqFt * tierRate;
        if (inputs.sides === '2') basePrintCost *= DOUBLE_SIDED_MULTIPLIER;
        
        const costs = { print: basePrintCost, setup: GLOBAL_SETUP_FEE, lamination: 0, grommets: 0, contour: 0 };
        if (inputs.addLamination && matData.can_laminate) { 
              let lamCost = totalSqFt * FINISHING_RATES.lamination; 
              if (lamCost < FINISHING_RATES.lamination_min) lamCost = FINISHING_RATES.lamination_min; 
              costs.lamination = lamCost; 
        }
        if (inputs.addGrommets) costs.grommets = qty * inputs.grommetsPerSign * FINISHING_RATES.grommets;
        if (inputs.cutType === 'Contour') costs.contour = CONTOUR_SETUP_FEE;
        
        const totalSellPrice = Object.values(costs).reduce((a, b) => a + b, 0);
        const unitPrice = totalSellPrice / qty;
        let bestSheet = null;
        
        if (matData && matData.sheets) {
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
    } else {
        let unitBase = 0;
        let product = null;
        if (inputs.digitalProductId === 'custom') {
            unitBase = parseFloat(inputs.unitPrice) || 0;
            product = { name: inputs.customDigitalName || 'Custom Digital', width: inputs.width, height: inputs.height, binding: 'None' };
        } else {
            product = digitalProducts.find(p => p.id === inputs.digitalProductId);
            if (product) unitBase = product.basePrice + ((product.perPagePrice || 0) * (parseInt(inputs.pageCount) || 0));
        }
        let bindingCost = 0;
        if (inputs.bindingType === 'Coil') bindingCost = FINISHING_RATES.coil_binding;
        if (inputs.bindingType === 'Staple') bindingCost = FINISHING_RATES.stapling;
        const singleCost = unitBase + bindingCost;
        const totalSellPrice = singleCost * qty;
        return {
            specs: { type: 'digital', product: product },
            costs: { print: totalSellPrice },
            totalSellPrice: totalSellPrice,
            unitPrice: singleCost,
            production: null,
            profitability: { grossMargin: 0, marginPercent: 0 } 
        };
    }
  }, [inputs, quoteType, digitalProducts]);

  const handleSubmit = async () => {
    const targetUrl = config.webhookUrl;
    if (!targetUrl) { alert("Please enter a Submit Webhook URL."); return; }
    setSubmitStatus('sending');
    
    const itemData = quoteType === 'large_format' ? {
        material: inputs.material,
        width: inputs.width,
        height: inputs.height,
        quantity: inputs.quantity,
        sides: inputs.sides,
        cut_type: inputs.cutType,
        lamination: inputs.addLamination,
        grommets: inputs.addGrommets,
        production_json: JSON.stringify(calculationResult.production)
    } : {
        material: inputs.digitalProductId === 'custom' ? inputs.customDigitalName : digitalProducts.find(p => p.id === inputs.digitalProductId)?.name,
        width: inputs.width,
        height: inputs.height,
        quantity: inputs.quantity,
        binding: inputs.bindingType,
        pages: inputs.pageCount,
        production_json: JSON.stringify({ type: 'digital', product: inputs.digitalProductId })
    };

    const payload = {
      job_name: inputs.jobName || "Untitled Job",
      order_date: new Date().toISOString().split('T')[0],
      due_date: inputs.dueDate, 
      total_price: calculationResult.totalSellPrice,
      customer_name: customer.name || "Walk-in", 
      qbo_customer_id: customer.id || "", 
      // 🟢 ADDED CONTACT DETAILS TO PAYLOAD
      customer_email: customer.email || "",
      customer_phone: customer.phone || "",
      shipping_address: customer.shipAddr ? (typeof customer.shipAddr === 'object' ? JSON.stringify(customer.shipAddr) : customer.shipAddr) : "",
      
      art_file_link: inputs.artFileUrl || "", 
      item_details: itemData
    };

    try {
      const response = await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.ok) { setSubmitStatus('success'); setTimeout(() => setSubmitStatus('idle'), 3000); if (config.airtableBaseId) fetchJobs(); setCustomer({ id: '', name: '', email: '', phone: '', shipAddr: null }); setInputs(prev => ({...prev, artFileUrl: ''})); } else { setSubmitStatus('error'); }
    } catch (error) { setSubmitStatus('error'); }
  };

  const handleInputChange = (e) => { const { name, value, type, checked } = e.target; setInputs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
  const handleConfigChange = (e) => { const { name, value } = e.target; setConfig(prev => ({ ...prev, [name]: value })); };
  
  const handleAddProduct = (e) => {
      e.preventDefault();
      const newId = newProduct.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const productToAdd = { ...newProduct, id: newId, width: parseFloat(newProduct.width), height: parseFloat(newProduct.height), basePrice: parseFloat(newProduct.basePrice), perPagePrice: parseFloat(newProduct.perPagePrice) };
      setDigitalProducts([...digitalProducts, productToAdd]);
      setNewProduct({ name: '', width: 0, height: 0, basePrice: 0, perPagePrice: 0, binding: 'None' });
      alert("Product Added!");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <style>{`@media print { body * { visibility: hidden; } .printable-ticket, .printable-ticket * { visibility: visible; } .printable-ticket { position: fixed; left: 0; top: 0; width: 100%; height: 100%; background: white; z-index: 9999; padding: 20px; } .no-print { display: none !important; } }`}</style>
      
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3"><div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg"><Printer size={28} /></div><div><h1 className="text-2xl font-bold text-slate-800">Paramount OS</h1><p className="text-sm text-slate-500">Shop Operating System</p></div></div>
        <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex self-start">
          <button onClick={() => setViewMode('quote')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'quote' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}><DollarSign size={16} /> Quoter</button>
          <button onClick={() => setViewMode('production')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'production' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}><Package size={16} /> Ticket</button>
          <button onClick={() => { setViewMode('dashboard'); fetchJobs(); }} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><Kanban size={16} /> Shop Dashboard</button>
          <button onClick={() => setViewMode('admin')} className={`p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50`} title="Product Admin"><Settings size={16} /></button>
        </div>
      </header>

      {viewMode === 'admin' && (
          <main className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Product Administration</h2>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
                  <h3 className="font-bold mb-4 text-slate-700 flex items-center gap-2"><Plus size={18} /> Add New Digital Product</h3>
                  <form onSubmit={handleAddProduct} className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
                      <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label><input type="text" required className="w-full border p-2 rounded text-sm" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Width</label><input type="number" step="0.1" className="w-full border p-2 rounded text-sm" value={newProduct.width} onChange={e => setNewProduct({...newProduct, width: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Height</label><input type="number" step="0.1" className="w-full border p-2 rounded text-sm" value={newProduct.height} onChange={e => setNewProduct({...newProduct, height: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Base Price ($)</label><input type="number" step="0.01" className="w-full border p-2 rounded text-sm" value={newProduct.basePrice} onChange={e => setNewProduct({...newProduct, basePrice: e.target.value})} /></div>
                      <div><button type="submit" className="w-full bg-blue-600 text-white p-2 rounded text-sm font-bold hover:bg-blue-700">Add</button></div>
                  </form>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase"><tr className="border-b"><th className="p-4">Name</th><th className="p-4">Size</th><th className="p-4">Base Price</th><th className="p-4">Action</th></tr></thead>
                      <tbody>
                          {digitalProducts.map((p, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                  <td className="p-4 font-medium">{p.name}</td>
                                  <td className="p-4">{p.width}" x {p.height}"</td>
                                  <td className="p-4">${p.basePrice.toFixed(2)}</td>
                                  <td className="p-4"><button onClick={() => { const n = [...digitalProducts]; n.splice(i, 1); setDigitalProducts(n); }} className="text-red-500 hover:underline">Remove</button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </main>
      )}

      {viewMode === 'dashboard' && (
        <main className="max-w-7xl mx-auto relative no-print">
          {/* ... (Dashboard code identical to previous, just re-pasting context not needed unless you want changes) ... */}
           {(!config.airtableBaseId || !config.airtablePat || showSettings) ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
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
                      const dueStatus = getDueDateStatus(getValue(job, ['Due_Date', 'Due Date', 'DueDate', 'Deadline', 'Date Due', 'Ship Date', 'Target Date', 'Delivery Date', 'Date Needed', 'Order Date', 'Order_Date']));
                      return (
                        <div key={job.id} draggable onDragStart={(e) => handleDragStart(e, job.id)} onDragOver={(e) => handleDragOver(e, job.id)} onDrop={(e) => { e.stopPropagation(); handleDrop(e, col.id, job.id); }} onClick={() => handleJobClick(job)} className={`bg-white p-4 rounded-lg shadow-sm border cursor-pointer relative group transition-all ${dragOverJobId === job.id ? 'border-blue-500 border-2 translate-y-1' : 'border-slate-200 hover:shadow-md hover:-translate-y-0.5'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{job.fields.Job_ID || 'ID...'}</span>
                                {dueStatus && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 border ${dueStatus.color}`}><dueStatus.icon size={10} /> {dueStatus.label}</span>}
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{job.fields.Project_Name || "Untitled"}</h4>
                            <p className="text-xs text-slate-500 mb-3 truncate">{getValue(job, ['Client_Name', 'Client Name', 'Customer', 'Company', 'Business Name', 'Client', 'Account', 'Account Name', 'Name', 'Display Name', 'DisplayName'], "Unknown")}</p>
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
                      
                      {(() => {
                          if (loadingDetails) {
                              return <div className="py-12 flex flex-col items-center justify-center text-slate-400"><Loader size={32} className="animate-spin mb-2" /><p>Fetching specs...</p></div>;
                          }
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

                          const clientName = getValue(selectedJob, ['Client_Name', 'Client Name', 'Client', 'Customer_Name', 'Customer Name', 'Customer', 'Company', 'Business Name', 'Client', 'Account', 'Account Name', 'Name', 'Display Name', 'DisplayName'], "Walk-in Customer");
                          const dueDate = getValue(selectedJob, ['Due_Date', 'Due Date', 'DueDate', 'Deadline', 'Date Due', 'Ship Date', 'Target Date', 'Delivery Date', 'Date Needed', 'Order Date', 'Order_Date'], null);
                          const jobName = getValue(selectedJob, ['Project_Name', 'Project Name', 'Job Name', 'Name'], "UNTITLED JOB");
                          
                          // 🟢 RESOLVE NEW CONTACT FIELDS
                          const email = getValue(selectedJob, ['Customer Email', 'Email', 'Contact Email', 'Primary Email'], null);
                          const phone = getValue(selectedJob, ['Customer Phone', 'Phone', 'Contact Phone', 'Mobile'], null);
                          const shipAddr = getValue(selectedJob, ['Shipping Address', 'Ship To', 'Address', 'Ship Address'], null);

                          const ticketData = {
                              jobName: jobName,
                              clientName: clientName,
                              dueDate: dueDate,
                              email: email,
                              phone: phone,
                              shipAddr: shipAddr,
                              material: resolve(['Material_Type', 'Material', 'material', 'Material Name', 'Substrate', 'Item'], 'N/A'),
                              width: resolve(['Width_In', 'Width', 'width', 'Width (in)', 'W'], '0'),
                              height: resolve(['Height_In', 'Height', 'height', 'Height (in)', 'H'], '0'),
                              quantity: resolve(['Quantity', 'Qty', 'quantity', 'Count'], '0'),
                              sides: resolve(['Sides', 'Print Sides', 'sides'], '1'),
                              cutType: resolve(['Cut_Type', 'Finishing', 'Cut Type', 'Cut'], 'None'),
                              lamination: resolve(['Lamination', 'lamination', 'Laminate'], false),
                              grommets: resolve(['Grommets', 'grommets', 'Grommet'], false),
                              binding: resolve(['Binding', 'binding', 'Bind'], null),
                              pages: resolve(['Pages', 'pages', 'Page Count'], 0),
                              artFileUrl: resolve(['Art_File_Link', 'Art File', 'File'], '')
                          };

                          return (
                              <div className="p-4 bg-yellow-50/50 rounded-xl">
                                  <ProductionTicketCard data={ticketData} />
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
                     {/* DROPDOWN RESULTS */}
                     {customerResults.length > 0 && ( 
                        <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-slate-200 rounded-md mt-1 z-10 max-h-60 overflow-y-auto">
                            {customerResults.map(res => (
                                <div key={res.id} onClick={() => selectCustomer(res)} className={`p-3 border-b border-slate-50 last:border-0 flex items-center gap-2 ${res.isAction ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer text-blue-800' : ''} ${res.id === 'error-msg' ? 'text-red-500 cursor-default hover:bg-white' : ''} ${res.id === 'no-results' || res.id === 'make-setup' ? 'text-slate-400 cursor-default hover:bg-white' : ''} ${!res.isAction && res.id !== 'error-msg' && res.id !== 'no-results' && res.id !== 'make-setup' ? 'hover:bg-slate-50 cursor-pointer' : ''}`}>
                                    {res.isAction && (isCreatingCustomer ? <Loader size={16} className="animate-spin" /> : <UserPlus size={16} />)}
                                    <div><p className={`font-bold text-sm ${res.isAction ? 'text-blue-700' : ''}`}>{res.DisplayName}</p>{(res.id !== 'error-msg' && res.id !== 'no-results' && res.id !== 'make-setup' && !res.isAction) && <p className="text-xs text-slate-400">ID: {res.id}</p>}</div>
                                </div>
                            ))}
                        </div> 
                     )}
                  </div>
               )}
            </div>

            {/* 🟢 NEW: QUOTE TYPE SWITCHER */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold flex items-center gap-2"><Settings size={18} className="text-blue-600" /> Job Specs</h2>
                 <div className="flex bg-slate-100 rounded-lg p-1">
                    <button onClick={() => setQuoteType('large_format')} className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${quoteType === 'large_format' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Large Format</button>
                    <button onClick={() => setQuoteType('digital')} className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${quoteType === 'digital' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Digital/Small</button>
                 </div>
              </div>

              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Job / Project Name</label><input type="text" name="jobName" placeholder="e.g. Fall Event Signs" value={inputs.jobName} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm border p-2" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label><input type="date" name="dueDate" value={inputs.dueDate} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm border p-2" /></div>

                {/* 🟢 CONDITIONAL INPUTS BASED ON TYPE */}
                {quoteType === 'large_format' ? (
                   <>
                      <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Width (in)</label><input type="number" name="width" value={inputs.width} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Height (in)</label><input type="number" name="height" value={inputs.height} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" name="quantity" value={inputs.quantity} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Material</label><select name="material" value={inputs.material} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2">{Object.values(MATERIALS).map(m => (<option key={m.key} value={m.name}>{m.name}</option>))}</select></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Print Sides</label><div className="flex gap-4"><label className="flex items-center gap-2 p-2 border rounded-md flex-1 cursor-pointer hover:bg-slate-50"><input type="radio" name="sides" value="1" checked={inputs.sides === '1'} onChange={handleInputChange} /><span>Single Sided</span></label><label className="flex items-center gap-2 p-2 border rounded-md flex-1 cursor-pointer hover:bg-slate-50"><input type="radio" name="sides" value="2" checked={inputs.sides === '2'} onChange={handleInputChange} /><span>Double Sided</span></label></div></div>
                   </>
                ) : (
                   <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                        <select name="digitalProductId" value={inputs.digitalProductId} onChange={e => {
                            const val = e.target.value;
                            if (val === 'custom') {
                                setInputs({...inputs, digitalProductId: 'custom', width: 0, height: 0});
                            } else {
                                const p = digitalProducts.find(dp => dp.id === val);
                                if (p) setInputs({...inputs, digitalProductId: val, width: p.width, height: p.height});
                            }
                        }} className="w-full rounded-md border-slate-300 border p-2">
                            <option value="">Select Product...</option>
                            {digitalProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            <option value="custom">-- Custom Digital Quote --</option>
                        </select>
                      </div>

                      {inputs.digitalProductId === 'custom' && (
                        <>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label><input type="text" name="customDigitalName" value={inputs.customDigitalName} onChange={handleInputChange} className="w-full border p-2 rounded-md" placeholder="e.g. Custom Invites" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Width</label><input type="number" name="width" value={inputs.width} onChange={handleInputChange} className="w-full border p-2 rounded-md" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Height</label><input type="number" name="height" value={inputs.height} onChange={handleInputChange} className="w-full border p-2 rounded-md" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Unit Price ($)</label><input type="number" step="0.01" name="unitPrice" value={inputs.unitPrice} onChange={handleInputChange} className="w-full border p-2 rounded-md" /></div>
                        </>
                      )}

                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" name="quantity" value={inputs.quantity} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Page Count (if booklet)</label><input type="number" name="pageCount" value={inputs.pageCount} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2" /></div>
                   </>
                )}
              </div>
            </div>

            {/* FINISHING */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Scissors size={18} className="text-green-600" /> Finishing</h2>
              {quoteType === 'large_format' ? (
                  <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Cut Type</label><select name="cutType" value={inputs.cutType} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2"><option value="Rectangular">Rectangular (Free)</option><option value="Contour">Contour / Shape (+$25.00 Setup)</option></select></div>
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <label className="flex items-center justify-between cursor-pointer"><div className="flex items-center gap-2"><input type="checkbox" name="addLamination" checked={inputs.addLamination} onChange={handleInputChange} className="h-4 w-4 text-blue-600 rounded" /><span className="text-sm font-medium text-slate-700">Add Lamination</span></div><span className="text-xs text-slate-500">$2.50/sqft</span></label>
                      <label className="flex items-center justify-between cursor-pointer"><div className="flex items-center gap-2"><input type="checkbox" name="addGrommets" checked={inputs.addGrommets} onChange={handleInputChange} className="h-4 w-4 text-blue-600 rounded" /><span className="text-sm font-medium text-slate-700">Add Grommets</span></div><span className="text-xs text-slate-500">$0.25/ea</span></label>
                    </div>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Binding / Finishing</label><select name="bindingType" value={inputs.bindingType} onChange={handleInputChange} className="w-full rounded-md border-slate-300 border p-2"><option value="None">None / Flush Cut</option><option value="Coil">Coil Binding (+$5.00)</option><option value="Staple">Stapled / Saddle Stitch (+$0.50)</option></select></div>
                  </div>
              )}
            </div>

            {/* ART FILES */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-l-4 border-l-indigo-500">
               <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><UploadCloud size={18} className="text-indigo-600" /> Art Files</h2>
               <div className="space-y-3">
                  <div className="border-2 border-dashed border-indigo-100 rounded-lg p-4 text-center hover:bg-indigo-50 transition-colors cursor-pointer relative">
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                     {isUploading ? (<div className="flex flex-col items-center justify-center text-indigo-600"><Loader size={24} className="animate-spin mb-2" /><span className="text-sm font-medium">Uploading to Drive...</span></div>) : (<div className="flex flex-col items-center justify-center text-indigo-400"><UploadCloud size={24} className="mb-2" /><span className="text-sm font-medium text-indigo-600">Click to Upload File</span><span className="text-[10px] text-slate-400 mt-1">Max 100MB (Logos, Proofs)</span></div>)}
                  </div>
                  <div className="relative"><div className="absolute left-3 top-2.5 text-slate-400"><LinkIcon size={16} /></div><input type="text" name="artFileUrl" placeholder="Paste WeTransfer / Dropbox Link" className="w-full pl-9 rounded-md border-slate-300 text-sm p-2" value={inputs.artFileUrl} onChange={handleInputChange} /></div>
                  {inputs.artFileUrl && (<div className="bg-indigo-50 text-indigo-700 text-xs p-2 rounded flex items-center gap-2 truncate"><CheckCircle size={14} className="flex-shrink-0" /> <span className="truncate">{inputs.artFileUrl}</span></div>)}
                  {uploadError && <p className="text-red-500 text-xs mt-1">{uploadError}</p>}
               </div>
            </div>

            {/* ADMIN CONFIG */}
            {(!HARDCODED_SUBMIT_WEBHOOK || !HARDCODED_SEARCH_WEBHOOK || !HARDCODED_UPLOAD_WEBHOOK || !HARDCODED_CREATE_WEBHOOK) && (
              <div className="bg-slate-100 rounded-xl shadow-inner border border-slate-200 p-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Webhook Settings</h2>
                <div className="space-y-3">
                  {!HARDCODED_SUBMIT_WEBHOOK && <div><label className="block text-[10px] text-slate-500 mb-1">Submit Order Webhook</label><input type="text" name="webhookUrl" value={config.webhookUrl} onChange={handleConfigChange} className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white" placeholder="https://hook..." /></div>}
                  {!HARDCODED_SEARCH_WEBHOOK && <div><label className="block text-[10px] text-slate-500 mb-1">QBO Search Webhook</label><input type="text" name="searchWebhookUrl" value={config.searchWebhookUrl} onChange={handleConfigChange} className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white" placeholder="https://hook..." /></div>}
                  {!HARDCODED_CREATE_WEBHOOK && <div><label className="block text-[10px] text-slate-500 mb-1">Create Customer Webhook</label><input type="text" name="createWebhookUrl" value={config.createWebhookUrl} onChange={handleConfigChange} className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white" placeholder="https://hook..." /></div>}
                  {!HARDCODED_UPLOAD_WEBHOOK && <div><label className="block text-[10px] text-slate-500 mb-1">Drive Upload Webhook</label><input type="text" name="uploadWebhookUrl" value={config.uploadWebhookUrl} onChange={handleConfigChange} className="w-full text-xs rounded border-slate-300 p-2 font-mono bg-white" placeholder="https://hook..." /></div>}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-6">
            {/* 🟢 ALWAYS RENDER THE CONTAINER */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                {viewMode === 'quote' && (
                  <>
                    <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-semibold flex items-center gap-2"><DollarSign size={20} /> Customer Quote</h3>
                      <span className="text-xs bg-blue-700 px-2 py-1 rounded text-blue-100">Valid for 30 days</span>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-6">
                        <div>
                          <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Project Cost</p>
                          <h2 className="text-4xl font-bold text-slate-900 mt-1">{formatCurrency(calculationResult?.totalSellPrice || 0)}</h2>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Price per unit</p>
                          <p className="text-xl font-semibold text-slate-700">{formatCurrency(calculationResult?.unitPrice || 0)} <span className="text-sm font-normal text-slate-400">/ea</span></p>
                        </div>
                      </div>
                      
                      {/* 🟢 Dynamic Quote Summary based on Type */}
                      <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-slate-600">
                         {quoteType === 'large_format' ? (
                             <>
                                <div className="flex justify-between border-b border-slate-50 pb-2"><span>Dimensions</span> <span className="font-mono font-bold">{inputs.width}" x {inputs.height}"</span></div>
                                <div className="flex justify-between border-b border-slate-50 pb-2"><span>Material</span> <span className="font-bold">{inputs.material}</span></div>
                             </>
                         ) : (
                             <>
                                <div className="flex justify-between border-b border-slate-50 pb-2"><span>Product</span> <span className="font-bold truncate">{calculationResult.specs?.product?.name || inputs.customDigitalName || 'Custom'}</span></div>
                                <div className="flex justify-between border-b border-slate-50 pb-2"><span>Binding</span> <span className="font-bold">{inputs.bindingType}</span></div>
                             </>
                         )}
                         <div className="flex justify-between border-b border-slate-50 pb-2"><span>Quantity</span> <span className="font-bold">{inputs.quantity}</span></div>
                         {inputs.dueDate && <div className="flex justify-between border-b border-slate-50 pb-2 text-amber-600"><span>Due Date</span> <span className="font-bold">{safeFormatDate(inputs.dueDate)}</span></div>}
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
                  </>
                )}

                {viewMode === 'production' && (
                  <>
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                      <h3 className="font-semibold flex items-center gap-2"><Package size={20} /> Production Ticket Preview</h3>
                      <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">INTERNAL USE ONLY</span>
                    </div>
                    <div className="p-8 bg-yellow-50/50 h-full">
                        <ProductionTicketCard data={{
                            jobName: inputs.jobName,
                            clientName: customer.name || "Walk-in Customer",
                            dueDate: inputs.dueDate,
                            // 🟢 Pass contact info for Preview
                            email: customer.email,
                            phone: customer.phone,
                            shipAddr: customer.shipAddr,
                            
                            material: quoteType === 'large_format' ? inputs.material : (inputs.digitalProductId === 'custom' ? inputs.customDigitalName : digitalProducts.find(p => p.id === inputs.digitalProductId)?.name),
                            width: inputs.width,
                            height: inputs.height,
                            quantity: inputs.quantity,
                            sides: inputs.sides,
                            cutType: quoteType === 'large_format' ? inputs.cutType : 'None',
                            lamination: inputs.addLamination,
                            grommets: inputs.addGrommets,
                            binding: inputs.bindingType,
                            pages: inputs.pageCount,
                            artFileUrl: inputs.artFileUrl
                        }} />
                    </div>
                  </>
                )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}