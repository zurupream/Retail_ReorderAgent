import React, { useEffect, useRef, useState } from 'react';
import {
  PackageCheck,
  ShieldCheck,
  Activity,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Mail,
  KeyRound,
  Lock,
  CheckCircle2,
  Layers,
  Truck,
} from 'lucide-react';

const GOOGLE_CLIENT_ID =
  '259388273008-n8vg3ae8be86e56svvg09rbdciah17u1.apps.googleusercontent.com';

export default function SignInPage({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const googleBtnRef = useRef(null);

  useEffect(() => {
    const initGoogle = () => {
      if (window.google && window.google.accounts && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response?.credential) return;
            setLoading(true);
            setErrorMsg('');
            try {
              const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
              });
              const data = await res.json();
              if (!res.ok) {
                throw new Error(data.detail || 'Google SSO sign-in failed');
              }
              onAuthenticated(data.user);
            } catch (err) {
              setErrorMsg(err.message);
            } finally {
              setLoading(false);
            }
          },
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: 'continue_with',
          shape: 'pill',
        });
      }
    };

    const timer = setTimeout(initGoogle, 300);
    return () => clearTimeout(timer);
  }, [onAuthenticated]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to dispatch OTP');
      }
      setOtpSent(true);
      setStatusMsg(data.message || `6-digit code dispatched to ${email}`);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid verification code');
      }
      onAuthenticated(data.user);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between">
      {/* Top Executive Bar */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066CC] flex items-center justify-center text-white shadow-sm">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#0066CC] border border-blue-200">
                  Retail &amp; Distribution Agent #09
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  BI-SAFETY-STOCK • ERP-AUTO-PR
                </span>
              </div>
              <h1 className="text-base font-semibold text-gray-900 mt-0.5">
                Live Inventory Threshold &amp; Autonomous Reorder Agent
              </h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Zero-Stockout Replenishment Control Plane</span>
          </div>
        </div>
      </header>

      {/* Main 12-Column Split Grid */}
      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1">
        {/* Left 7/12: Apple-Style 3-Step Visual Workflow Diagram */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium mb-3">
              <Activity className="w-3.5 h-3.5" />
              Continuous Warehouse &amp; Branch Stock Polling
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
              Autonomous Reorder Point Math with Demand Spike Guardrails.
            </h2>
            <p className="mt-3 text-gray-600 text-base leading-relaxed">
              Eliminate retail shelf stockouts and over-ordering across Central Distribution Centers and retail branches. The agent continuously compares live ERP on-hand &amp; in-transit stock against BI safety thresholds, flags abnormal velocity surges, and generates ERP Purchase Requisitions.
            </p>
          </div>

          {/* 3-Step Visual Workflow Diagram */}
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0066CC] font-bold shrink-0">
                1
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                    1. Live Warehouse &amp; Branch Stock vs. BI Safety Thresholds
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-[#0066CC]">
                    Real-Time Telemetry
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Polls Central DC and branch on-hand + in-transit balances across Cooking Oils, Chilled Dairy, Bottled Water, Detergents, OTC Pharmacy, and Packaging Film against minimum BI safety stock buffers.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
                2
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                    2. Deterministic ROP, Lead-Time &amp; 3.2x Demand Spike Anomaly Check
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                    ROP = (Vel × Lead) + Safety
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Computes exact Days of Cover, Vendor MOQ / Case Pack rounding, and velocity ratios. Clean threshold breaches route to <span className="font-mono font-semibold text-emerald-700">AUTO_PR_READY</span> while <span className="font-mono font-semibold text-amber-700">3.2x</span> demand spikes pause for <span className="font-mono font-semibold text-amber-700">HUMAN_BUYER_REVIEW</span>.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                3
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                    3. ERP Purchase Requisition Authorization
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    One-Click ERP Release
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Converts approved replenishment orders into auditable ERP Purchase Requisitions (<span className="font-mono">PR-ERP-88410+</span>) with vendor SLA metrics, case pack breakdowns, and print-ready Purchase Requisition authorization documents.
                </p>
              </div>
            </div>
          </div>

          {/* Executive Metrics Strip */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="bg-white/90 rounded-xl p-3.5 border border-gray-200/80">
              <div className="text-xs text-gray-500">Monitored Categories</div>
              <div className="text-lg font-bold text-gray-900 font-mono mt-0.5">
                6 Core SKU Groups
              </div>
            </div>
            <div className="bg-white/90 rounded-xl p-3.5 border border-gray-200/80">
              <div className="text-xs text-gray-500">Spike Guardrail Ceiling</div>
              <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">
                2.2x / 3.2x Flag
              </div>
            </div>
            <div className="bg-white/90 rounded-xl p-3.5 border border-gray-200/80">
              <div className="text-xs text-gray-500">Margin Protected</div>
              <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                $100,750+ / Cycle
              </div>
            </div>
          </div>
        </div>

        {/* Right 5/12: Enterprise SSO Card */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xl p-7 sm:p-8 space-y-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0066CC] bg-blue-50 px-2.5 py-1 rounded-full">
                <Lock className="w-3.5 h-3.5" />
                Enterprise Supply Chain SSO
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Sign in to Replenishment Workbench
              </h3>
              <p className="text-xs text-gray-500">
                Authenticate via Passwordless Work Email 6-Digit OTP or Corporate Google SSO.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{statusMsg}</span>
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Work or Business Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0066CC] hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>
                    {loading ? 'Dispatching 6-Digit OTP...' : 'Send 6-Digit Verification OTP'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700">
                      6-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setStatusMsg('');
                      }}
                      className="text-xs text-[#0066CC] hover:underline"
                    >
                      Change email
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{loading ? 'Verifying OTP...' : 'Verify & Launch Workbench'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-xs text-gray-400 uppercase font-medium">
                Or Corporate Google SSO
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="flex justify-center">
              <div ref={googleBtnRef} className="min-h-[42px] flex items-center justify-center" />
            </div>

            <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                ERP Connector: SAP / Oracle / Dynamics Ready
              </span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-gray-400" />
                MOQ &amp; Case-Pack Enforced
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200/70 bg-white/60 py-4">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <span>
            Agent #09 • Live Inventory Threshold &amp; Autonomous Reorder Agent
          </span>
          <span className="font-mono">
            ROP = (Daily Velocity × Lead Time) + BI Safety Stock
          </span>
        </div>
      </footer>
    </div>
  );
}
