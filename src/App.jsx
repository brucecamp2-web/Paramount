import React, { useState, useEffect } from 'react';
import { Printer, DollarSign, Package, Kanban } from 'lucide-react';
import QuoteBuilder from './components/QuoteBuilder';
import ShopDashboard from './components/ShopDashboard';
import { Config, AirtableRecord } from './types';
import { 
  HARDCODED_SUBMIT_WEBHOOK, HARDCODED_SEARCH_WEBHOOK, HARDCODED_CREATE_WEBHOOK, HARDCODED_UPLOAD_WEBHOOK,
  HARDCODED_AIRTABLE_BASE_ID, HARDCODED_AIRTABLE_PAT
} from './constants';

export default function App() {
  const [viewMode, setViewMode] = useState<'quote' | 'production' | 'dashboard'>('quote'); 
  
  const [config, setConfig] = useState<Config>(() => {
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
    
    try { if (typeof window !== 'undefined') { const get = (k: string) => localStorage.getItem(k) || ''; loadedConfig = { webhookUrl: get('paramount_webhook_url'), searchWebhookUrl: get('paramount_search_webhook_url'), createWebhookUrl: get('paramount_create_webhook_url'), uploadWebhookUrl: get('paramount_upload_webhook_url'), airtableBaseId: get('paramount_at_base'), airtablePat: get('paramount_at_pat'), airtableTableName: get('paramount_at_table') || 'Jobs', airtableLineItemsName: get('paramount_at_lines') || 'Line Items', airtableLinkedFieldName: get('paramount_at_link_col') || 'Job_Link' }; } } catch (e) {}
    
    if (HARDCODED_SUBMIT_WEBHOOK) loadedConfig.webhookUrl = HARDCODED_SUBMIT_WEBHOOK;
    if (HARDCODED_SEARCH_WEBHOOK) loadedConfig.searchWebhookUrl = HARDCODED_SEARCH_WEBHOOK;
    if (HARDCODED_CREATE_WEBHOOK) loadedConfig.createWebhookUrl = HARDCODED_CREATE_WEBHOOK; 
    if (HARDCODED_UPLOAD_WEBHOOK) loadedConfig.uploadWebhookUrl = HARDCODED_UPLOAD_WEBHOOK;
    if (HARDCODED_AIRTABLE_BASE_ID) loadedConfig.airtableBaseId = HARDCODED_AIRTABLE_BASE_ID;
    if (HARDCODED_AIRTABLE_PAT) loadedConfig.airtablePat = HARDCODED_AIRTABLE_PAT;
    return loadedConfig;
  });

  const [jobs, setJobs] = useState<AirtableRecord[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    } catch (error: any) { setFetchError(error.message); } finally { setLoadingJobs(false); }
  };

  const handleUpdateJobStatus = async (jobId: string, newStatus: string) => {
    // Optimistic Update
    const originalJobs = [...jobs];
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, fields: { ...j.fields, Status: newStatus } } : j));

    if (config.airtableBaseId && config.airtablePat) {
      try {
        const tableName = config.airtableTableName || 'Jobs';
        const encodedTable = encodeURIComponent(tableName);
        await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}/${jobId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${config.airtablePat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { Status: newStatus }, typecast: true }) });
      } catch (error) { 
          // Revert on error
          console.error("Failed to update status", error);
          setJobs(originalJobs);
          fetchJobs(); 
      } 
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
        const tableName = config.airtableTableName || 'Jobs';
        const encodedTable = encodeURIComponent(tableName);
        const response = await fetch(`https://api.airtable.com/v0/${config.airtableBaseId}/${encodedTable}/${jobId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${config.airtablePat}` } });
        if (!response.ok) throw new Error("Delete failed");
        setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (error: any) { alert("Failed to delete job: " + error.message); }
  };

  const handleRefresh = () => {
    fetchJobs();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <style>{`@media print { body * { visibility: hidden; } .printable-ticket, .printable-ticket * { visibility: visible; } .printable-ticket { position: fixed; left: 0; top: 0; width: 100%; height: 100%; background: white; z-index: 9999; padding: 20px; } .no-print { display: none !important; } }`}</style>
      
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3"><div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg"><Printer size={28} /></div><div><h1 className="text-2xl font-bold text-slate-100">Paramount OS</h1><p className="text-sm text-slate-400">Shop Operating System</p></div></div>
        <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 shadow-sm flex self-start">
          <button onClick={() => setViewMode('quote')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'quote' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'}`}><DollarSign size={16} /> Quoter</button>
          <button onClick={() => setViewMode('production')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'production' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'}`}><Package size={16} /> Ticket</button>
          <button onClick={() => { setViewMode('dashboard'); fetchJobs(); }} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'}`}><Kanban size={16} /> Shop Dashboard</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto relative">
        {viewMode === 'dashboard' ? (
            <ShopDashboard 
                config={config} 
                onConfigChange={setConfig} 
                jobs={jobs} 
                loadingJobs={loadingJobs} 
                fetchError={fetchError} 
                onRefresh={handleRefresh}
                onUpdateStatus={handleUpdateJobStatus}
                onDeleteJob={handleDeleteJob}
            />
        ) : (
            <QuoteBuilder 
                config={config} 
                viewMode={viewMode}
                onRefreshBoard={fetchJobs}
            />
        )}
      </main>
    </div>
  );
}