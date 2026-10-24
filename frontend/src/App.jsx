import React, { useEffect, useState } from 'react';
import {
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Bot,
  FileText,
  Printer,
  LogOut,
  TrendingUp,
  Truck,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Layers,
  Send,
  Building2,
  Boxes,
  Clock,
} from 'lucide-react';
import SignInPage from './components/SignInPage';
import ThemeSwitcher from './components/ThemeSwitcher';

const STORAGE_KEY = 'retail_reorder_agent_user_v1';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('monitor');
  const [reorders, setReorders] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [selectedId, setSelectedId] = useState('RO-2026-901');
  const [loading, setLoading] = useState(false);
  const [actionBanner, setActionBanner] = useState('');

  // Simulator state in Tab 2
  const [simOnHand, setSimOnHand] = useState(1480);
  const [simInTransit, setSimInTransit] = useState(400);
  const [simVelocity, setSimVelocity] = useState(420);
  const [simLeadTime, setSimLeadTime] = useState(5);
  const [simSafetyStock, setSimSafetyStock] = useState(950);
  const [simResult, setSimResult] = useState(null);
  const [buyerNotes, setBuyerNotes] = useState(
    'Verified supplier lead time, BI safety stock buffer, and MOQ case-pack multiple.'
  );
  const [overrideQty, setOverrideQty] = useState('');
  const [approving, setApproving] = useState(false);

  // Co-Pilot state in Tab 3
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      model: 'deterministic-replenishment-engine',
      text: 'Welcome to the Supply Chain & Autonomous Replenishment Co-Pilot. Ask me about Reorder Point (ROP) breaches, why Chilled Dairy (RO-2026-902) triggered a 3.2x Demand Spike hold, or how MOQ case-pack rounding impacts total working capital.',
    },
  ]);

  const fetchReorders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reorders');
      const data = await res.json();
      if (data.items) {
        setReorders(data.items);
        setKpis(data.kpis);
      }
    } catch (err) {
      console.error('Failed to load reorders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReorders();
  }, []);

  const selectedItem =
    reorders.find((r) => r.id === selectedId) || reorders[0] || null;

  useEffect(() => {
    if (selectedItem) {
      setSimOnHand(selectedItem.on_hand_units);
      setSimInTransit(selectedItem.in_transit_units);
      setSimVelocity(selectedItem.daily_sales_velocity);
      setSimLeadTime(selectedItem.supplier_lead_time_days);
      setSimSafetyStock(selectedItem.bi_safety_stock_units);
      setOverrideQty(String(selectedItem.metrics.optimal_reorder_qty || ''));
      setSimResult(null);
    }
  }, [selectedId, reorders.length]);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser));
    } catch {
      // ignore storage errors
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleRunSimulation = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch('/api/reorders/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reorder_id: selectedItem.id,
          on_hand_units: Number(simOnHand),
          in_transit_units: Number(simInTransit),
          daily_sales_velocity: Number(simVelocity),
          supplier_lead_time_days: Number(simLeadTime),
          bi_safety_stock_units: Number(simSafetyStock),
          target_cover_days: selectedItem.target_cover_days || 14,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimResult(data.simulated_metrics);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  const handleApprovePR = async () => {
    if (!selectedItem) return;
    setApproving(true);
    setActionBanner('');
    try {
      const parsedOverride = overrideQty ? parseInt(overrideQty, 10) : null;
      const res = await fetch(`/api/reorders/${selectedItem.id}/approve-pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver_name: user?.name || 'Supply Chain Controller',
          approver_email: user?.email || 'controller@sybyl.com',
          override_qty: parsedOverride && parsedOverride > 0 ? parsedOverride : null,
          buyer_notes: buyerNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionBanner(data.message);
        await fetchReorders();
      }
    } catch (err) {
      console.error('Approve PR error:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleAskCopilot = async (customPrompt) => {
    const q = (customPrompt ?? question).trim();
    if (!q) return;
    setQuestion('');
    setAsking(true);
    setChatHistory((prev) => [...prev, { role: 'user', text: q }]);
    try {
      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          reorder_id: selectedItem?.id,
        }),
      });
      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          model: data.model || 'Enterprise Operations Reasoning Engine',
          text: data.answer || 'No response received.',
        },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          model: 'offline-fallback',
          text: 'Unable to reach Co-Pilot endpoint. Please check network connectivity.',
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  if (!user) {
    return <SignInPage onAuthenticated={handleLogin} />;
  }

  const getStatusBadge = (item) => {
    if (item.pr_approval_state === 'APPROVED_POSTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          PR POSTED TO ERP
        </span>
      );
    }
    const status = item.metrics?.routing_status;
    if (status === 'HUMAN_BUYER_REVIEW') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
          <ShieldAlert className="w-3.5 h-3.5" />
          3.2x DEMAND SPIKE HOLD
        </span>
      );
    }
    if (status === 'AUTO_PR_READY') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#0066CC] border border-blue-200">
          <Sparkles className="w-3.5 h-3.5" />
          AUTO-PR READY
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        HEALTHY BUFFER
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col">
      {/* Top Navigation Bar (Hidden during print) */}
      <header className="no-print bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066CC] flex items-center justify-center text-white shadow-sm">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
            <ThemeSwitcher />
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#0066CC] border border-blue-200">
                  Agent #09 • Supply Chain &amp; Inventory Control
                </span>
                <span className="text-xs text-gray-500 font-mono hidden sm:inline">
                  ROP = (Velocity × Lead Time) + BI Safety Stock
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900">
                Live Inventory Threshold &amp; Autonomous Reorder Agent
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchReorders}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition"
              title="Refresh Live Inventory Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-gray-900">
                {user.name}
              </span>
              <span className="text-[11px] text-gray-500">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4-Tab Bar */}
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 overflow-x-auto border-t border-gray-100 py-2">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'monitor'
                ? 'bg-[#0066CC] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>1. Live Inventory &amp; BI Threshold Monitor</span>
          </button>

          <button
            onClick={() => setActiveTab('workbench')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'workbench'
                ? 'bg-[#0066CC] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>2. Replenishment Math, Demand Spike Alert &amp; PR Workbench</span>
          </button>

          <button
            onClick={() => setActiveTab('copilot')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'copilot'
                ? 'bg-[#0066CC] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>3. Supply Chain &amp; Replenishment AI Co-Pilot</span>
          </button>

          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'sheet'
                ? 'bg-[#0066CC] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>4. ERP Purchase Requisition</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 space-y-6">
        {/* Top KPI Summary Cards (Hidden during print) */}
        {kpis && (
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
              <div className="text-xs text-gray-500 font-medium">
                Threshold Breaches
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">
                {kpis.breached_groups} / {kpis.total_groups}
              </div>
              <div className="text-[11px] text-blue-700 mt-1">
                SKUs below dynamic ROP
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
              <div className="text-xs text-gray-500 font-medium">
                Auto-PR Ready Queue
              </div>
              <div className="text-2xl font-bold text-[#0066CC] font-mono mt-1">
                {kpis.auto_pr_ready} SKUs
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Clean velocity (1.0x–1.4x band)
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-amber-200 bg-amber-50/40 shadow-sm">
              <div className="text-xs text-amber-800 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Demand Spike Holds
              </div>
              <div className="text-2xl font-bold text-amber-800 font-mono mt-1">
                {kpis.spike_holds} Flagged
              </div>
              <div className="text-[11px] text-amber-700 mt-1">
                3.2x surge routed to Buyer Review
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
              <div className="text-xs text-gray-500 font-medium">
                Staged ERP PR Exposure
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">
                ${kpis.total_pr_exposure_usd?.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                MOQ &amp; case-pack rounded
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/40 shadow-sm">
              <div className="text-xs text-emerald-800 font-medium">
                At-Risk Margin Protected
              </div>
              <div className="text-2xl font-bold text-emerald-700 font-mono mt-1">
                ${kpis.revenue_protected_usd?.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                {kpis.approved_prs} PR(s) released to ERP
              </div>
            </div>
          </div>
        )}

        {actionBanner && (
          <div className="no-print p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-medium">{actionBanner}</span>
            </div>
            <button
              onClick={() => setActiveTab('sheet')}
              className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
            >
              View ERP Purchase Requisition →
            </button>
          </div>
        )}

        {/* TAB 1: LIVE INVENTORY & BI THRESHOLD MONITOR */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Live Warehouse &amp; Branch Stock vs. BI Safety Thresholds
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Click any replenishment group to inspect deterministic Reorder Point (ROP) math, 3.2x demand spike guardrails, and branch-level stock cover.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                  <Clock className="w-3.5 h-3.5 text-[#0066CC]" />
                  <span>Polling Cycle: Every 15m • ERP + POS Live Stream</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      <th className="py-3.5 px-4">SKU Group &amp; Category</th>
                      <th className="py-3.5 px-4 text-right">On-Hand + Transit</th>
                      <th className="py-3.5 px-4 text-right">BI Safety / ROP</th>
                      <th className="py-3.5 px-4 text-right">Days Cover</th>
                      <th className="py-3.5 px-4 text-right">Velocity Spike</th>
                      <th className="py-3.5 px-4 text-right">Optimal Reorder Qty</th>
                      <th className="py-3.5 px-4">Routing &amp; PR State</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {reorders.map((item) => {
                      const m = item.metrics || {};
                      const isSelected = item.id === selectedItem?.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-50/50'
                              : 'hover:bg-gray-50/80'
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="font-semibold text-gray-900">
                              {item.title}
                            </div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              {item.id} • {item.sku_code} • {item.preferred_vendor}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            <div className="font-semibold text-gray-900">
                              {item.on_hand_units.toLocaleString()} u
                            </div>
                            <div className="text-xs text-gray-500">
                              +{item.in_transit_units.toLocaleString()} in-transit
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            <div className="font-semibold text-gray-900">
                              ROP: {m.rop_units?.toLocaleString()} u
                            </div>
                            <div className="text-xs text-gray-500">
                              Safety: {item.bi_safety_stock_units.toLocaleString()} u ({item.supplier_lead_time_days}d lead)
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold text-xs ${
                                m.days_of_cover <= item.supplier_lead_time_days
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {m.days_of_cover} days
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold text-xs ${
                                m.demand_spike_multiplier >= 2.2
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {m.demand_spike_multiplier}x ({item.daily_sales_velocity} u/d)
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-mono">
                            <div className="font-bold text-gray-900">
                              {m.optimal_reorder_qty?.toLocaleString()} u
                            </div>
                            <div className="text-xs text-gray-500">
                              ${m.reorder_value_usd?.toLocaleString()} ({m.optimal_cases} cases)
                            </div>
                          </td>
                          <td className="py-4 px-4">{getStatusBadge(item)}</td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(item.id);
                                setActiveTab('workbench');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-[#0066CC] text-white text-xs font-semibold transition"
                            >
                              <span>Inspect</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Group Branch-Level Breakdown */}
            {selectedItem && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-[#0066CC] font-semibold">
                        {selectedItem.id} • {selectedItem.warehouse_code}
                      </span>
                      <h3 className="text-base font-bold text-gray-900">
                        Warehouse &amp; Retail Branch Threshold Allocation
                      </h3>
                    </div>
                    {getStatusBadge(selectedItem)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedItem.branch_allocations.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-gray-200/80 bg-gray-50/60 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-900">
                            {b.branch}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              b.status === 'SPIKE_ALERT'
                                ? 'bg-amber-100 text-amber-800'
                                : b.status === 'CRITICAL'
                                ? 'bg-red-100 text-red-700'
                                : b.status === 'BELOW_ROP'
                                ? 'bg-blue-100 text-[#0066CC]'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between font-mono text-xs">
                          <span className="text-gray-500">
                            On-Hand: <strong className="text-gray-900">{b.on_hand.toLocaleString()} u</strong>
                          </span>
                          <span className="text-gray-500">
                            Min Threshold: <strong>{b.min_threshold.toLocaleString()} u</strong>
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              b.on_hand < b.min_threshold
                                ? 'bg-[#0066CC]'
                                : 'bg-emerald-600'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((b.on_hand / Math.max(1, b.min_threshold)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1.5 text-[11px] text-gray-500 font-mono">
                          Daily Burn: {b.daily_burn} u/day ({(b.on_hand / Math.max(1, b.daily_burn)).toFixed(1)}d cover)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Autonomous Agent Recommendation
                    </div>
                    <h3 className="text-base font-bold text-gray-900">
                      {selectedItem.title}
                    </h3>
                    <div
                      className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                        selectedItem.metrics.routing_status === 'HUMAN_BUYER_REVIEW'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-blue-50/70 border-blue-200 text-gray-800'
                      }`}
                    >
                      {selectedItem.metrics.recommendation}
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-semibold text-gray-700">
                        Live Replenishment Audit Trail
                      </div>
                      {selectedItem.audit_trail.map((entry, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-gray-600 font-mono bg-gray-50 p-2.5 rounded-xl border border-gray-200/70"
                        >
                          {entry}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab('workbench')}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#0066CC] hover:bg-blue-700 text-white text-xs font-semibold transition"
                    >
                      Open Replenishment &amp; PR Workbench →
                    </button>
                    <button
                      onClick={() => setActiveTab('sheet')}
                      className="py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
                    >
                      Purchase Requisition
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REPLENISHMENT MATH, DEMAND SPIKE ALERT & PR WORKBENCH */}
        {activeTab === 'workbench' && selectedItem && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Deterministic Math & Interactive What-If Simulator */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-[#0066CC] font-semibold">
                      DETERMINISTIC REPLENISHMENT ENGINE
                    </span>
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedItem.title}
                    </h2>
                  </div>
                  <select
                    value={selectedItem.id}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold bg-white"
                  >
                    {reorders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} — {r.category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Formula Breakdown Box */}
                <div className="p-4 rounded-2xl bg-gray-900 text-white font-mono text-xs space-y-2">
                  <div className="text-gray-400">
                    // Deterministic Reorder Point &amp; Case-Pack Rounding Formula
                  </div>
                  <div>
                    ROP = (Daily Velocity [{selectedItem.daily_sales_velocity} u/d] × Lead Time [{selectedItem.supplier_lead_time_days}d]) + BI Safety Stock [{selectedItem.bi_safety_stock_units} u] ={' '}
                    <span className="text-emerald-400 font-bold">
                      {selectedItem.metrics.rop_units.toLocaleString()} units
                    </span>
                  </div>
                  <div>
                    Demand Spike Ratio = Current Velocity [{selectedItem.daily_sales_velocity} u/d] ÷ 30D Baseline [{selectedItem.baseline_velocity_30d} u/d] ={' '}
                    <span
                      className={
                        selectedItem.metrics.demand_spike_multiplier >= 2.2
                          ? 'text-amber-400 font-bold'
                          : 'text-blue-300 font-bold'
                      }
                    >
                      {selectedItem.metrics.demand_spike_multiplier}x
                    </span>
                  </div>
                  <div>
                    Optimal ERP Order = ceil(Max(Target Deficit, MOQ [{selectedItem.vendor_moq_units} u]) / CasePack [{selectedItem.case_pack_units} u]) ={' '}
                    <span className="text-emerald-400 font-bold">
                      {selectedItem.metrics.optimal_reorder_qty.toLocaleString()} units ({selectedItem.metrics.optimal_cases.toLocaleString()} cases)
                    </span>
                  </div>
                </div>

                {/* Demand Spike Alert Banner if 3.2x */}
                {selectedItem.metrics.demand_spike_multiplier >= 2.2 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 space-y-1">
                      <div className="font-bold text-sm">
                        3.2x Demand Spike Guardrail Triggered — Routed to HUMAN_BUYER_REVIEW
                      </div>
                      <p>
                        Daily sales velocity jumped from <strong>{selectedItem.baseline_velocity_30d} u/day</strong> to{' '}
                        <strong>{selectedItem.daily_sales_velocity} u/day</strong> ({selectedItem.metrics.demand_spike_multiplier}x). Autonomous PR release was paused to prevent bullwhip over-stocking from a one-off institutional order or flash promotion. Buyer can confirm full quantity or override below.
                      </p>
                    </div>
                  </div>
                )}

                {/* Interactive Parameter Sandbox */}
                <div className="pt-2 border-t border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">
                      What-If Lead-Time &amp; Velocity Stress Simulator
                    </h3>
                    <button
                      onClick={handleRunSimulation}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0066CC] hover:bg-blue-700 text-white text-xs font-semibold transition"
                    >
                      Recalculate ROP &amp; Order Qty
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        On-Hand Stock (Units)
                      </label>
                      <input
                        type="number"
                        value={simOnHand}
                        onChange={(e) => setSimOnHand(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        In-Transit PO (Units)
                      </label>
                      <input
                        type="number"
                        value={simInTransit}
                        onChange={(e) => setSimInTransit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Daily Velocity (Units/Day)
                      </label>
                      <input
                        type="number"
                        value={simVelocity}
                        onChange={(e) => setSimVelocity(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Supplier Lead Time (Days)
                      </label>
                      <input
                        type="number"
                        value={simLeadTime}
                        onChange={(e) => setSimLeadTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        BI Safety Stock (Units)
                      </label>
                      <input
                        type="number"
                        value={simSafetyStock}
                        onChange={(e) => setSimSafetyStock(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Vendor MOQ / Pack
                      </label>
                      <div className="px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-xs font-mono text-gray-700">
                        MOQ {selectedItem.vendor_moq_units} / Pack {selectedItem.case_pack_units}
                      </div>
                    </div>
                  </div>

                  {simResult && (
                    <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-gray-500">Simulated ROP</div>
                        <div className="font-bold font-mono text-sm text-gray-900">
                          {simResult.rop_units.toLocaleString()} u
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Spike Multiplier</div>
                        <div className="font-bold font-mono text-sm text-amber-800">
                          {simResult.demand_spike_multiplier}x
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Simulated Order Qty</div>
                        <div className="font-bold font-mono text-sm text-[#0066CC]">
                          {simResult.optimal_reorder_qty.toLocaleString()} u
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Simulated PR Value</div>
                        <div className="font-bold font-mono text-sm text-emerald-700">
                          ${simResult.reorder_value_usd.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right 5 Columns: ERP Purchase Requisition Execution Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-emerald-700 font-semibold">
                      {selectedItem.erp_pr_number}
                    </span>
                    <h3 className="text-base font-bold text-gray-900">
                      ERP Purchase Requisition Release
                    </h3>
                  </div>
                  {getStatusBadge(selectedItem)}
                </div>

                <div className="space-y-2.5 text-xs border-t border-b border-gray-100 py-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Preferred Supplier:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedItem.preferred_vendor}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Supplier SLA Fill Rate:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {selectedItem.vendor_sla_reliability}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Receiving Facility:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedItem.warehouse_code} ({selectedItem.location})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unit Cost / Retail Price:</span>
                    <span className="font-mono text-gray-900">
                      ${selectedItem.unit_cost_usd.toFixed(2)} / ${selectedItem.retail_price_usd.toFixed(2)} per {selectedItem.unit_of_measure}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recommended Order Quantity:</span>
                    <span className="font-mono font-bold text-[#0066CC]">
                      {selectedItem.metrics.optimal_reorder_qty.toLocaleString()} units ({selectedItem.metrics.optimal_cases.toLocaleString()} cases)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Requisition Value:</span>
                    <span className="font-mono font-bold text-base text-gray-900">
                      ${selectedItem.metrics.reorder_value_usd.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Authorized Order Quantity (Units — Rounded to Case Pack of {selectedItem.case_pack_units})
                    </label>
                    <input
                      type="number"
                      value={overrideQty}
                      onChange={(e) => setOverrideQty(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Supply Chain Controller / Buyer Authorization Notes
                    </label>
                    <textarea
                      rows={3}
                      value={buyerNotes}
                      onChange={(e) => setBuyerNotes(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs"
                    />
                  </div>

                  <button
                    onClick={handleApprovePR}
                    disabled={approving}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {approving
                        ? 'Posting ERP Purchase Requisition...'
                        : 'Approve & Post ERP Purchase Requisition'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SUPPLY CHAIN & REPLENISHMENT AI CO-PILOT */}
        {activeTab === 'copilot' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm space-y-4">
              <div>
                <span className="text-xs font-mono text-[#0066CC] font-semibold">
                  ENTERPRISE OPERATIONS REASONING ENGINE
                </span>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">
                  Replenishment &amp; Inventory Prompts
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Select a live SKU context and click any executive prompt to run deep replenishment diagnostics.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Focused SKU Group Context
                </label>
                <select
                  value={selectedItem?.id || ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold bg-white"
                >
                  {reorders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {[
                  'Why did Chilled Dairy (RO-2026-902) trigger a 3.2x Demand Spike hold and should we release full or partial quantity?',
                  'Summarize all SKUs currently below Reorder Point (ROP) ranked by stockout margin risk.',
                  'Explain the exact Reorder Point and MOQ case-pack math for Fast-Moving Cooking Oils (RO-2026-901).',
                  'Which retail branches are at immediate risk of shelf stockout in the next 48 hours?',
                ].map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => handleAskCopilot(preset)}
                    className="w-full text-left p-3 rounded-2xl border border-gray-200 hover:border-[#0066CC] hover:bg-blue-50/40 text-xs text-gray-700 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-200/90 p-6 shadow-sm flex flex-col justify-between min-h-[500px]">
              <div className="space-y-4 overflow-y-auto max-h-[420px] pr-2">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0066CC] text-white ml-12'
                        : 'bg-gray-50 border border-gray-200/80 text-gray-800 mr-8'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="text-[10px] font-mono uppercase text-gray-400 mb-1">
                        Co-Pilot • {msg.model}
                      </div>
                    )}
                    <div className="whitespace-pre-line">{msg.text}</div>
                  </div>
                ))}
                {asking && (
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-500 font-mono">
                    Analyzing warehouse telemetry, ROP thresholds, and supplier lead times...
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskCopilot();
                }}
                className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3"
              >
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about ROP thresholds, 3.2x velocity spikes, vendor MOQs, or branch allocations..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
                <button
                  type="submit"
                  disabled={asking}
                  className="px-5 py-2.5 rounded-xl bg-[#0066CC] hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask Co-Pilot</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: ERP PURCHASE REQUISITION */}
        {activeTab === 'sheet' && selectedItem && (
          <div className="space-y-4">
            <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-600">
                  Select Replenishment Requisition:
                </span>
                <select
                  value={selectedItem.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold bg-white"
                >
                  {reorders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.erp_pr_number} — {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0066CC] hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save ERP Purchase Requisition PDF</span>
              </button>
            </div>

            {/* Print-Ready Purchase Requisition */}
            <div className="bg-white rounded-3xl border border-gray-300 shadow-sm p-8 space-y-6 max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-gray-200 pb-5">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-[#0066CC] font-bold">
                    ENTERPRISE SUPPLY CHAIN &amp; AUTONOMOUS REPLENISHMENT CONTROL
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mt-1">
                    ERP PURCHASE REQUISITION
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generated by Agent #09 (`Retail_ReorderAgent`) • Deterministic ROP &amp; BI Safety Stock Engine
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-sm text-gray-900">
                    {selectedItem.erp_pr_number}
                  </div>
                  <div className="text-gray-500">Group ID: {selectedItem.id}</div>
                  <div className="text-gray-500">SKU: {selectedItem.sku_code}</div>
                </div>
              </div>

              {/* Section 1: Vendor & Facility Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div>
                  <div className="text-gray-500">Preferred Supplier</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedItem.preferred_vendor}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Receiving Warehouse</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedItem.warehouse_code} ({selectedItem.location})
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Vendor SLA &amp; Lead Time</div>
                  <div className="font-semibold text-gray-900 mt-0.5">
                    {selectedItem.vendor_sla_reliability} • {selectedItem.supplier_lead_time_days} Days
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Authorization Status</div>
                  <div className="font-mono font-bold text-emerald-700 mt-0.5">
                    {selectedItem.pr_approval_state} ({selectedItem.metrics.routing_status})
                  </div>
                </div>
              </div>

              {/* Section 2: Replenishment & Threshold Math Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">
                  1. Deterministic Reorder Point (ROP) &amp; Demand Spike Verification
                </h3>
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-100 text-gray-700 font-semibold">
                    <tr>
                      <th className="p-2.5 text-left">On-Hand Stock</th>
                      <th className="p-2.5 text-left">In-Transit PO</th>
                      <th className="p-2.5 text-left">Daily Velocity</th>
                      <th className="p-2.5 text-left">30D Baseline / Spike</th>
                      <th className="p-2.5 text-left">BI Safety Stock</th>
                      <th className="p-2.5 text-left">Dynamic ROP</th>
                      <th className="p-2.5 text-left">Days Cover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-mono">
                    <tr>
                      <td className="p-2.5">{selectedItem.on_hand_units.toLocaleString()} u</td>
                      <td className="p-2.5">{selectedItem.in_transit_units.toLocaleString()} u</td>
                      <td className="p-2.5">{selectedItem.daily_sales_velocity} u/day</td>
                      <td className="p-2.5">
                        {selectedItem.baseline_velocity_30d} u/d ({selectedItem.metrics.demand_spike_multiplier}x)
                      </td>
                      <td className="p-2.5">{selectedItem.bi_safety_stock_units.toLocaleString()} u</td>
                      <td className="p-2.5 font-bold text-gray-900">
                        {selectedItem.metrics.rop_units.toLocaleString()} u
                      </td>
                      <td className="p-2.5 font-bold text-red-700">
                        {selectedItem.metrics.days_of_cover} days
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 3: Purchase Requisition Line Item */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">
                  2. Authorized ERP Purchase Requisition Line Item
                </h3>
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-100 text-gray-700 font-semibold">
                    <tr>
                      <th className="p-2.5 text-left">ERP PR #</th>
                      <th className="p-2.5 text-left">SKU Description &amp; UOM</th>
                      <th className="p-2.5 text-right">Vendor MOQ</th>
                      <th className="p-2.5 text-right">Case Pack</th>
                      <th className="p-2.5 text-right">Order Qty (Units / Cases)</th>
                      <th className="p-2.5 text-right">Unit Cost</th>
                      <th className="p-2.5 text-right">Total PR Value (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-mono">
                    <tr>
                      <td className="p-2.5 font-bold">{selectedItem.erp_pr_number}</td>
                      <td className="p-2.5 font-sans">
                        {selectedItem.title} ({selectedItem.unit_of_measure})
                      </td>
                      <td className="p-2.5 text-right">{selectedItem.vendor_moq_units.toLocaleString()} u</td>
                      <td className="p-2.5 text-right">{selectedItem.case_pack_units} u/case</td>
                      <td className="p-2.5 text-right font-bold text-[#0066CC]">
                        {selectedItem.metrics.optimal_reorder_qty.toLocaleString()} u ({selectedItem.metrics.optimal_cases.toLocaleString()} cases)
                      </td>
                      <td className="p-2.5 text-right">${selectedItem.unit_cost_usd.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-gray-900">
                        ${selectedItem.metrics.reorder_value_usd.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 4: Executive Sign-Off Block */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200 text-xs">
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-gray-500">Autonomous Agent Verification</div>
                  <div className="font-semibold text-gray-900 mt-1">
                    Retail_ReorderAgent (#09)
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                    ROP &amp; Spike Check: VERIFIED
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-gray-500">Category Buyer / Controller</div>
                  <div className="font-semibold text-gray-900 mt-1">
                    {selectedItem.approved_by || user.name}
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                    {selectedItem.approved_email || user.email}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-gray-500">ERP Dispatch Timestamp</div>
                  <div className="font-semibold text-gray-900 mt-1 font-mono">
                    {selectedItem.approved_at || 'Pending Final Release'}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                    Protected Margin: ${selectedItem.stockout_risk_impact_usd.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
