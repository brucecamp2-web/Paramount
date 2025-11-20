import React, { useState, useMemo } from 'react';
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
  Check
} from 'lucide-react';

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

export default function App() {
  // --- STATE ---
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

  const [viewMode, setViewMode] = useState('quote'); 
  
  // Webhook State
  const [webhookUrl, setWebhookUrl] = useState('');
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle, sending, success, error

  // --- LOGIC ENGINE ---

  const calculationResult = useMemo(() => {
    const matData = MATERIALS[inputs.material];
    const width = parseFloat(inputs.width) || 0;
    const height = parseFloat(inputs.height) || 0;
    const qty = parseInt(inputs.quantity) || 0;

    if (width === 0 || height === 0 || qty === 0) return null;

    // 1. Calculate Specs
    const itemSqFt = (width * height) / 144;
    const totalSqFt = itemSqFt * qty;
    
    // 2. Identify Pricing Tier
    let tierRate = 0;
    let tierName = '';
    for (const tier of matData.tiers) {
      if (totalSqFt <= tier.limit) {
        tierRate = tier.price;
        tierName = `< ${tier.limit.toLocaleString()} sqft`;
        break;
      }
    }

    // 3. Base Print Cost
    let basePrintCost = totalSqFt * tierRate;
    
    // Multiplier for Double Sided
    let sidesMultiplier = 1;
    if (inputs.sides === '2') {
      sidesMultiplier = DOUBLE_SIDED_MULTIPLIER;
      basePrintCost = basePrintCost * sidesMultiplier;
    }

    // 4. Finishing Costs
    const costs = {
      print: basePrintCost,
      setup: GLOBAL_SETUP_FEE,
      lamination: 0,
      grommets: 0,
      contour: 0
    };

    const warnings = [];

    // Lamination Logic
    if (inputs.addLamination) {
      if (!matData.can_laminate) {
        warnings.push(`Cannot laminate ${matData.name}. Lamination removed.`);
      } else {
        let lamCost = totalSqFt * FINISHING_RATES.lamination;
        if (lamCost < FINISHING_RATES.lamination_min) {
          lamCost = FINISHING_RATES.lamination_min;
        }
        costs.lamination = lamCost;
      }
    }

    // Grommets Logic
    if (inputs.addGrommets) {
      const totalGrommets = qty * inputs.grommetsPerSign;
      costs.grommets = totalGrommets * FINISHING_RATES.grommets;
    }

    // Contour Cut Logic
    if (inputs.cutType === 'Contour') {
      costs.contour = CONTOUR_SETUP_FEE;
    }

    // Total Calculation
    const totalSellPrice = Object.values(costs).reduce((a, b) => a + b, 0);
    const unitPrice = totalSellPrice / qty;

    // 5. Production Optimization (Material Yield)
    let bestSheet = null;
    
    if (matData.sheets) {
      let bestCost = Infinity;

      matData.sheets.forEach(sheet => {
        const sw = sheet.w;
        const sh = sheet.h;
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


  // --- SUBMISSION HANDLER ---
  const handleSubmit = async () => {
    if (!webhookUrl) {
      alert("Please enter a Make.com Webhook URL in the settings below.");
      return;
    }

    setSubmitStatus('sending');

    // Prepare the payload for Airtable
    const payload = {
      job_name: inputs.jobName || "Untitled Job",
      order_date: new Date().toISOString().split('T')[0],
      total_price: calculationResult.totalSellPrice,
      // Line Item Details
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
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSubmitStatus('success');
        setTimeout(() => setSubmitStatus('idle'), 3000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error(error);
      setSubmitStatus('error');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg">
            <Printer size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Paramount Smart Quoter</h1>
            <p className="text-sm text-slate-500">Production Estimating & Workflow Engine</p>
          </div>
        </div>
        
        <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex">
          <button 
            onClick={() => setViewMode('quote')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'quote' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Client Quote
          </button>
          <button 
            onClick={() => setViewMode('production')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'production' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Production Ticket
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: INPUTS */}
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
                  value={inputs.jobName} onChange={handleChange}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Width (in)</label>
                  <input 
                    type="number" name="width" value={inputs.width} onChange={handleChange}
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Height (in)</label>
                  <input 
                    type="number" name="height" value={inputs.height} onChange={handleChange}
                    className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input 
                  type="number" name="quantity" value={inputs.quantity} onChange={handleChange}
                  className="w-full rounded-md border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                <select 
                  name="material" value={inputs.material} onChange={handleChange}
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
                    <input type="radio" name="sides" value="1" checked={inputs.sides === '1'} onChange={handleChange} />
                    <span>Single Sided</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-md flex-1 cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="sides" value="2" checked={inputs.sides === '2'} onChange={handleChange} />
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
                  name="cutType" value={inputs.cutType} onChange={handleChange}
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
                      checked={inputs.addLamination} onChange={handleChange} 
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
                      checked={inputs.addGrommets} onChange={handleChange} 
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
                      value={inputs.grommetsPerSign} onChange={handleChange}
                      className="w-20 rounded-md border-slate-300 border p-1 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* ADMIN / CONFIG */}
          <div className="bg-slate-100 rounded-xl shadow-inner border border-slate-200 p-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System Configuration</h2>
            <div className="space-y-2">
              <label className="block text-sm text-slate-600">Make.com Webhook URL</label>
              <input 
                type="text" 
                placeholder="https://hook.us1.make.com/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full text-xs rounded border-slate-300 p-2 font-mono text-slate-600 bg-white"
              />
              <p className="text-[10px] text-slate-400">Paste your webhook here to enable the Submit button.</p>
            </div>
          </div>

        </div>


        {/* RIGHT COLUMN: OUTPUT */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* WARNINGS */}
          {calculationResult?.warnings.length > 0 && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm animate-in slide-in-from-top-2">
              <div className="flex items-start">
                <AlertTriangle className="text-amber-600 mt-0.5 mr-3" size={20} />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Wait a minute</h3>
                  <ul className="mt-1 list-disc list-inside text-sm text-amber-700">
                    {calculationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* CLIENT QUOTE VIEW */}
          {viewMode === 'quote' && calculationResult && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign size={20} /> Customer Quote
                </h3>
                <span className="text-xs bg-blue-700 px-2 py-1 rounded text-blue-100">
                  Valid for 30 days
                </span>
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

                {/* Line Item Breakdown */}
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
                      <span className="text-slate-600 flex items-center gap-2">
                        <Settings size={14} /> Global Setup Fee
                      </span>
                      <span className="font-medium">{formatCurrency(calculationResult.costs.setup)}</span>
                    </div>
                  )}

                  {calculationResult.costs.contour > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <Scissors size={14} /> Contour File Setup
                      </span>
                      <span className="font-medium">{formatCurrency(calculationResult.costs.contour)}</span>
                    </div>
                  )}

                  {calculationResult.costs.lamination > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <Maximize size={14} /> Lamination ({inputs.width > 0 && inputs.height > 0 ? 'Applied' : 'N/A'})
                      </span>
                      <span className="font-medium">{formatCurrency(calculationResult.costs.lamination)}</span>
                    </div>
                  )}

                  {calculationResult.costs.grommets > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <CheckCircle size={14} /> Grommets ({inputs.quantity * inputs.grommetsPerSign} total)
                      </span>
                      <span className="font-medium">{formatCurrency(calculationResult.costs.grommets)}</span>
                    </div>
                  )}
                </div>
                
                {/* SUBMIT BUTTON */}
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <button
                    onClick={handleSubmit}
                    disabled={!webhookUrl || submitStatus === 'sending' || submitStatus === 'success'}
                    className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all
                      ${!webhookUrl ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 
                        submitStatus === 'success' ? 'bg-green-600 text-white' :
                        'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl active:scale-[0.98]'
                      }`}
                  >
                    {submitStatus === 'idle' && (
                      <>
                        <Send size={18} /> Submit Order to Production
                      </>
                    )}
                    {submitStatus === 'sending' && (
                      <>
                        <Loader size={18} className="animate-spin" /> Processing...
                      </>
                    )}
                    {submitStatus === 'success' && (
                      <>
                        <Check size={18} /> Order Sent!
                      </>
                    )}
                    {submitStatus === 'error' && "Error Sending - Check Webhook"}
                  </button>
                  {!webhookUrl && (
                    <p className="text-center text-xs text-red-400 mt-2">
                      * Enter Webhook URL below to enable
                    </p>
                  )}
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
                <span className="text-xs bg-indigo-800 px-2 py-1 rounded text-indigo-100 font-mono">
                  JOB-PREVIEW
                </span>
              </div>

              <div className="p-6 space-y-6">
                <div className="border-b border-slate-100 pb-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Material Yield Optimization</h4>
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
                           <div className="flex items-center gap-1">
                              <Maximize size={12} />
                              <span>Layout: <strong>{calculationResult.production.orientation}</strong></span>
                           </div>
                           <div className="flex items-center gap-1">
                              <AlertTriangle size={12} />
                              <span>Waste: <strong>{calculationResult.production.waste.toFixed(1)}%</strong></span>
                           </div>
                        </div>
                     </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Enter dimensions to calculate yield.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Routing</h4>
                      <ul className="space-y-2 text-sm">
                         <li className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${inputs.cutType === 'Contour' ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
                            <span className={inputs.cutType === 'Contour' ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                              {inputs.cutType === 'Contour' ? 'CNC Router (Contour)' : 'Standard Cut'}
                            </span>
                         </li>
                         <li className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${inputs.addLamination && calculationResult.costs.lamination > 0 ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                            <span className={inputs.addLamination && calculationResult.costs.lamination > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                               Lamination Required
                            </span>
                         </li>
                         <li className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${inputs.addGrommets ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                            <span className={inputs.addGrommets ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                               Grommets ({inputs.grommetsPerSign}/ea)
                            </span>
                         </li>
                      </ul>
                   </div>
                   <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Financials (Internal)</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Gross Revenue:</span>
                          <span className="font-medium">{formatCurrency(calculationResult.totalSellPrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Est. Mat Cost:</span>
                          <span className="text-red-600">-{formatCurrency(calculationResult.production?.totalMatCost || 0)}</span>
                        </div>
                        <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between text-green-700 font-bold">
                          <span>Gross Margin:</span>
                          <span>{calculationResult.profitability.marginPercent.toFixed(1)}%</span>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {(!inputs.width || !inputs.height || !inputs.quantity) && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-8">
              <ArrowRight size={48} className="mb-4 opacity-20" />
              <p>Enter dimensions and quantity to generate quote.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}