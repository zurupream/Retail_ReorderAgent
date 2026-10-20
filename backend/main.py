import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth_service import (
    format_name_from_email,
    is_access_allowed,
    get_otp_rejection_message,
    generate_and_store_otp,
    send_otp_email,
    verify_stored_otp,
    verify_google_id_token,
)
from seed_data import build_seed_reorders, compute_replenishment_metrics

app = FastAPI(
    title="Live Inventory Threshold & Autonomous Reorder Agent API",
    version="1.0.0",
    description="Deterministic BI Safety Stock Monitor, 3.2x Demand Spike Anomaly Guardrail & Autonomous ERP Purchase Requisition Engine",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REORDER_STORE: List[Dict[str, Any]] = build_seed_reorders()


class OTPRequestPayload(BaseModel):
    email: str


class OTPVerifyPayload(BaseModel):
    email: str
    code: str


class GoogleAuthPayload(BaseModel):
    credential: str


class ApprovePRPayload(BaseModel):
    approver_name: Optional[str] = "Supply Chain Controller"
    approver_email: Optional[str] = "controller@sybyl.com"
    override_qty: Optional[int] = None
    buyer_notes: Optional[str] = "Verified supplier lead time, BI safety stock buffer, and MOQ pack multiple."


class SimulateReplenishmentPayload(BaseModel):
    reorder_id: str
    on_hand_units: int
    in_transit_units: int
    daily_sales_velocity: float
    supplier_lead_time_days: int
    bi_safety_stock_units: int
    target_cover_days: int = 14


class AgentAskPayload(BaseModel):
    question: str
    reorder_id: Optional[str] = None


def _compute_kpis() -> Dict[str, Any]:
    total_groups = len(REORDER_STORE)
    breached_groups = sum(1 for r in REORDER_STORE if r["metrics"]["threshold_breach"])
    auto_pr_ready = sum(
        1 for r in REORDER_STORE
        if r["metrics"]["routing_status"] == "AUTO_PR_READY" and r["pr_approval_state"] != "APPROVED_POSTED"
    )
    spike_holds = sum(1 for r in REORDER_STORE if r["metrics"]["routing_status"] == "HUMAN_BUYER_REVIEW")
    approved_prs = sum(1 for r in REORDER_STORE if r["pr_approval_state"] == "APPROVED_POSTED")
    total_pr_exposure_usd = round(sum(r["metrics"]["reorder_value_usd"] for r in REORDER_STORE), 2)
    revenue_protected_usd = round(sum(r["stockout_risk_impact_usd"] for r in REORDER_STORE if r["metrics"]["threshold_breach"]), 2)
    return {
        "total_groups": total_groups,
        "breached_groups": breached_groups,
        "auto_pr_ready": auto_pr_ready,
        "spike_holds": spike_holds,
        "approved_prs": approved_prs,
        "total_pr_exposure_usd": total_pr_exposure_usd,
        "revenue_protected_usd": revenue_protected_usd,
    }


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "retail-reorder-agent",
        "agent_number": "09",
        "title": "Live Inventory Threshold & Autonomous Reorder Agent",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "kpis": _compute_kpis(),
    }


@app.post("/api/auth/otp/request")
def request_otp(payload: OTPRequestPayload) -> Dict[str, Any]:
    email = (payload.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid work email address.")
    if not is_access_allowed(email):
        raise HTTPException(status_code=403, detail=get_otp_rejection_message(email))
    code = generate_and_store_otp(email)
    try:
        send_otp_email(email, code)
        return {
            "ok": True,
            "message": f"6-digit verification code dispatched to {email}.",
            "email": email,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {str(exc)}")


@app.post("/api/auth/otp/verify")
def verify_otp(payload: OTPVerifyPayload) -> Dict[str, Any]:
    email = (payload.email or "").strip().lower()
    code = (payload.code or "").strip()
    ok, message = verify_stored_otp(email, code)
    if not ok:
        raise HTTPException(status_code=401, detail=message)
    return {
        "ok": True,
        "user": {
            "email": email,
            "name": format_name_from_email(email),
            "role": "Supply Chain & Replenishment Director",
            "auth_method": "email_otp",
        },
    }


@app.post("/api/auth/google")
def google_auth(payload: GoogleAuthPayload) -> Dict[str, Any]:
    ok, user_info, error_msg = verify_google_id_token(payload.credential)
    if not ok:
        raise HTTPException(status_code=401, detail=error_msg or "Google authentication failed.")
    return {
        "ok": True,
        "user": {
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "picture": user_info.get("picture", ""),
            "role": "Supply Chain & Replenishment Director",
            "auth_method": "google_sso",
        },
    }


@app.get("/api/reorders")
def list_reorders() -> Dict[str, Any]:
    return {
        "items": REORDER_STORE,
        "kpis": _compute_kpis(),
    }


@app.get("/api/reorders/{reorder_id}")
def get_reorder(reorder_id: str) -> Dict[str, Any]:
    for item in REORDER_STORE:
        if item["id"] == reorder_id:
            return item
    raise HTTPException(status_code=404, detail=f"Replenishment group {reorder_id} not found.")


@app.post("/api/reorders/{reorder_id}/approve-pr")
def approve_purchase_requisition(reorder_id: str, payload: ApprovePRPayload) -> Dict[str, Any]:
    for item in REORDER_STORE:
        if item["id"] == reorder_id:
            now_str = datetime.now(timezone.utc).strftime("%H:%M UTC")
            final_qty = payload.override_qty if (payload.override_qty and payload.override_qty > 0) else item["metrics"]["optimal_reorder_qty"]
            pack = max(1, item["case_pack_units"])
            final_cases = int((final_qty + pack - 1) // pack)
            final_qty = final_cases * pack
            final_value = round(final_qty * item["unit_cost_usd"], 2)

            item["metrics"]["optimal_reorder_qty"] = final_qty
            item["metrics"]["optimal_cases"] = final_cases
            item["metrics"]["reorder_value_usd"] = final_value
            item["pr_approval_state"] = "APPROVED_POSTED"
            item["approved_by"] = payload.approver_name or "Supply Chain Controller"
            item["approved_email"] = payload.approver_email or "controller@sybyl.com"
            item["approved_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            item["buyer_notes"] = payload.buyer_notes or "Approved & transmitted to ERP Purchasing Queue."
            item["audit_trail"].insert(
                0,
                f"{now_str} — ERP Purchase Requisition {item['erp_pr_number']} APPROVED & POSTED by {item['approved_by']} "
                f"for {final_qty:,} units ({final_cases:,} cases / ${final_value:,.2f}).",
            )
            return {
                "ok": True,
                "message": f"ERP Purchase Requisition {item['erp_pr_number']} approved and dispatched to vendor queue.",
                "item": item,
                "kpis": _compute_kpis(),
            }
    raise HTTPException(status_code=404, detail=f"Replenishment group {reorder_id} not found.")


@app.post("/api/reorders/simulate")
def simulate_replenishment(payload: SimulateReplenishmentPayload) -> Dict[str, Any]:
    target_item = next((r for r in REORDER_STORE if r["id"] == payload.reorder_id), REORDER_STORE[0])
    simulated_metrics = compute_replenishment_metrics(
        on_hand_units=payload.on_hand_units,
        in_transit_units=payload.in_transit_units,
        daily_sales_velocity=payload.daily_sales_velocity,
        baseline_velocity_30d=target_item["baseline_velocity_30d"],
        supplier_lead_time_days=payload.supplier_lead_time_days,
        bi_safety_stock_units=payload.bi_safety_stock_units,
        vendor_moq_units=target_item["vendor_moq_units"],
        case_pack_units=target_item["case_pack_units"],
        unit_cost_usd=target_item["unit_cost_usd"],
        target_cover_days=payload.target_cover_days,
    )
    return {
        "reorder_id": target_item["id"],
        "sku_code": target_item["sku_code"],
        "title": target_item["title"],
        "vendor_moq_units": target_item["vendor_moq_units"],
        "case_pack_units": target_item["case_pack_units"],
        "unit_cost_usd": target_item["unit_cost_usd"],
        "simulated_metrics": simulated_metrics,
    }


def _build_deterministic_copilot_response(question: str, selected: Dict[str, Any]) -> str:
    m = selected["metrics"]
    return (
        f"### Replenishment & BI Threshold Analysis: **{selected['title']}** (`{selected['sku_code']}`)\n\n"
        f"- **Live Stock vs. BI Threshold**: On-hand inventory is **{selected['on_hand_units']:,} units** (`{m['days_of_cover']} days cover`) "
        f"plus **{selected['in_transit_units']:,} in-transit units** = **{m['net_available_units']:,} net units**, compared against a "
        f"deterministic **Reorder Point (ROP) of {m['rop_units']:,} units** (`({selected['daily_sales_velocity']:.0f} u/day × {selected['supplier_lead_time_days']}d lead time) + {selected['bi_safety_stock_units']:,} safety stock`).\n"
        f"- **Demand Spike Guardrail**: Current burn rate is **{m['demand_spike_multiplier']}x** vs. the 30-day baseline (`{selected['baseline_velocity_30d']:.0f} u/day`). "
        f"Routing Status: **`{m['routing_status']}`** ({m['anomaly_flag']}).\n"
        f"- **Recommended ERP Requisition (`{selected['erp_pr_number']}`)**: Order **{m['optimal_reorder_qty']:,} units** "
        f"(**{m['optimal_cases']:,} cases** of {selected['case_pack_units']} units, respecting vendor MOQ of {selected['vendor_moq_units']:,} units) "
        f"from **{selected['preferred_vendor']}** at **${m['reorder_value_usd']:,.2f}** total landed cost to protect **${selected['stockout_risk_impact_usd']:,.0f}** in at-risk retail margin."
    )


@app.post("/api/agent/ask")
def ask_replenishment_copilot(payload: AgentAskPayload) -> Dict[str, Any]:
    selected = next(
        (r for r in REORDER_STORE if r["id"] == payload.reorder_id),
        REORDER_STORE[0],
    )
    fallback_answer = _build_deterministic_copilot_response(payload.question, selected)

    try:
        from google import genai

        use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "1") == "1"
        project = os.getenv("GOOGLE_CLOUD_PROJECT", "gemini-enterprise-demo-498212")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "global")

        if use_vertex:
            client = genai.Client(vertexai=True, project=project, location=location)
        else:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if not api_key:
                return {"answer": fallback_answer, "model": "deterministic-replenishment-engine", "reorder_id": selected["id"]}
            client = genai.Client(api_key=api_key)

        portfolio_summary = "\n".join(
            [
                f"- {r['id']} ({r['sku_code']} | {r['category']}): OnHand={r['on_hand_units']}, InTransit={r['in_transit_units']}, "
                f"Velocity={r['daily_sales_velocity']}/day (30d Base={r['baseline_velocity_30d']}/day, Spike={r['metrics']['demand_spike_multiplier']}x), "
                f"LeadTime={r['supplier_lead_time_days']}d, SafetyStock={r['bi_safety_stock_units']}, ROP={r['metrics']['rop_units']}, "
                f"Routing={r['metrics']['routing_status']}, OptimalOrder={r['metrics']['optimal_reorder_qty']}u (${r['metrics']['reorder_value_usd']:,.2f})"
                for r in REORDER_STORE
            ]
        )

        prompt = (
            "You are the Supply Chain & Autonomous Replenishment AI Co-Pilot for an enterprise retail & distribution network.\n"
            "Use exact figures from the live inventory telemetry below. Highlight ROP math, lead-time risk, 3.2x demand spike guardrails, "
            "and ERP Purchase Requisition recommendations concisely in executive markdown.\n\n"
            f"Focused SKU Group: {selected['id']} - {selected['title']} ({selected['sku_code']})\n"
            f"Portfolio Telemetry:\n{portfolio_summary}\n\n"
            f"User Question: {payload.question}"
        )

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        answer_text = (resp.text or "").strip() or fallback_answer
        return {
            "answer": answer_text,
            "model": "gemini-2.5-flash",
            "reorder_id": selected["id"],
        }
    except Exception:
        return {
            "answer": fallback_answer,
            "model": "deterministic-replenishment-engine",
            "reorder_id": selected["id"],
        }


FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
