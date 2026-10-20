import math
from typing import Dict, Any, List


def compute_replenishment_metrics(
    on_hand_units: int,
    in_transit_units: int,
    daily_sales_velocity: float,
    baseline_velocity_30d: float,
    supplier_lead_time_days: int,
    bi_safety_stock_units: int,
    vendor_moq_units: int,
    case_pack_units: int,
    unit_cost_usd: float,
    target_cover_days: int = 21,
) -> Dict[str, Any]:
    """
    Deterministic Python replenishment & BI safety stock engine:
      - Reorder Point (ROP) = (Daily Sales Velocity * Supplier Lead Time Days) + BI Safety Stock
      - Net Available Inventory = On-Hand Units + In-Transit Units
      - Days of Stock Cover = On-Hand Units / Daily Sales Velocity
      - Demand Spike Multiplier = Daily Sales Velocity / 30D Baseline Velocity
      - Optimal Reorder Quantity rounded up to Vendor MOQ & Case Pack multiples
      - Routing Status: 'HUMAN_BUYER_REVIEW' if Demand Spike >= 2.2x or Promo Anomaly, else 'AUTO_PR_READY' if Net Available <= ROP
    """
    vel = max(daily_sales_velocity, 0.1)
    base_vel = max(baseline_velocity_30d, 0.1)

    rop_units = int(math.ceil((vel * supplier_lead_time_days) + bi_safety_stock_units))
    net_available_units = on_hand_units + in_transit_units
    days_of_cover = round(on_hand_units / vel, 1)
    net_days_of_cover = round(net_available_units / vel, 1)
    demand_spike_multiplier = round(vel / base_vel, 2)

    # Target stock covers lead time + target_cover_days + safety stock
    target_stock_level = int(math.ceil((vel * (supplier_lead_time_days + target_cover_days)) + bi_safety_stock_units))
    raw_deficit = max(0, target_stock_level - net_available_units)

    if raw_deficit > 0 or net_available_units <= rop_units:
        needed = max(raw_deficit, vendor_moq_units)
        pack = max(1, case_pack_units)
        optimal_reorder_qty = int(math.ceil(needed / pack) * pack)
        optimal_cases = optimal_reorder_qty // pack
    else:
        optimal_reorder_qty = 0
        optimal_cases = 0

    reorder_value_usd = round(optimal_reorder_qty * unit_cost_usd, 2)
    threshold_breach = net_available_units <= rop_units
    safety_stock_breach = on_hand_units <= bi_safety_stock_units

    if demand_spike_multiplier >= 2.2:
        routing_status = "HUMAN_BUYER_REVIEW"
        anomaly_flag = f"{demand_spike_multiplier}x Demand Spike Anomaly Detected"
        recommendation = (
            f"HOLD AUTO-PR: Current sales velocity ({vel:.0f} u/day) is {demand_spike_multiplier}x above 30D baseline "
            f"({base_vel:.0f} u/day). Verify whether surge is a one-off B2B bulk order or flash promotion before locking in "
            f"{optimal_reorder_qty:,} units (${reorder_value_usd:,.2f})."
        )
    elif threshold_breach:
        routing_status = "AUTO_PR_READY"
        anomaly_flag = "Normal Velocity Profile (Within 1.0x–1.4x Band)"
        recommendation = (
            f"AUTO-RELEASE ERP PR: Net available stock ({net_available_units:,} units) breached ROP ({rop_units:,} units) "
            f"with {days_of_cover} days on-hand cover vs. {supplier_lead_time_days}d supplier lead time. "
            f"Order {optimal_reorder_qty:,} units ({optimal_cases:,} cases) immediately."
        )
    else:
        routing_status = "HEALTHY_BUFFER"
        anomaly_flag = "Healthy Buffer Above ROP"
        recommendation = (
            f"NO ACTION REQUIRED: Net available inventory ({net_available_units:,} units) provides {net_days_of_cover} days cover, "
            f"comfortably above ROP ({rop_units:,} units)."
        )

    return {
        "rop_units": rop_units,
        "net_available_units": net_available_units,
        "days_of_cover": days_of_cover,
        "net_days_of_cover": net_days_of_cover,
        "demand_spike_multiplier": demand_spike_multiplier,
        "target_stock_level": target_stock_level,
        "optimal_reorder_qty": optimal_reorder_qty,
        "optimal_cases": optimal_cases,
        "reorder_value_usd": reorder_value_usd,
        "threshold_breach": threshold_breach,
        "safety_stock_breach": safety_stock_breach,
        "routing_status": routing_status,
        "anomaly_flag": anomaly_flag,
        "recommendation": recommendation,
    }


RAW_REORDER_GROUPS: List[Dict[str, Any]] = [
    {
        "id": "RO-2026-901",
        "sku_code": "SKU-OIL-5L-SUN",
        "title": "Fast-Moving Cooking Oils & Staples (GoldenSun 5L Refined Vegetable Oil)",
        "category": "Fast-Moving Cooking Oils & Staples",
        "location": "Central DC - Nairobi North & 14 Tier-1 Retail Branches",
        "warehouse_code": "WH-CDC-01",
        "preferred_vendor": "East Africa Edible Oils Refinery Ltd (VND-10042)",
        "vendor_sla_reliability": "98.4% On-Time Fill",
        "erp_pr_number": "PR-ERP-88410",
        "unit_of_measure": "5L Jerrycan",
        "case_pack_units": 4,
        "vendor_moq_units": 1200,
        "unit_cost_usd": 8.45,
        "retail_price_usd": 11.90,
        "on_hand_units": 1480,
        "in_transit_units": 400,
        "daily_sales_velocity": 420.0,
        "baseline_velocity_30d": 395.0,
        "supplier_lead_time_days": 5,
        "bi_safety_stock_units": 950,
        "target_cover_days": 14,
        "pr_approval_state": "PENDING_RELEASE",
        "stockout_risk_impact_usd": 28400.0,
        "branch_allocations": [
            {"branch": "Central DC Bulk Reserve", "on_hand": 620, "min_threshold": 1200, "daily_burn": 180, "status": "CRITICAL"},
            {"branch": "Westlands Hypermarket Branch", "on_hand": 290, "min_threshold": 450, "daily_burn": 95, "status": "BELOW_ROP"},
            {"branch": "Mombasa Road Mega Store", "on_hand": 310, "min_threshold": 420, "daily_burn": 85, "status": "BELOW_ROP"},
            {"branch": "Thika Road Mall Express", "on_hand": 260, "min_threshold": 300, "daily_burn": 60, "status": "BELOW_ROP"},
        ],
        "audit_trail": [
            "06:00 UTC — BI Poller ingested real-time POS scan velocity (420 u/day vs 395 u/day 30D mean).",
            "06:01 UTC — Net inventory (1,880 u) dropped below dynamic ROP (3,050 u); 3.5 days on-hand cover remaining.",
            "06:02 UTC — Deterministic Replenishment Engine staged PR-ERP-88410 for 6,984 units (1,746 cases) at $59,014.80.",
        ],
    },
    {
        "id": "RO-2026-902",
        "sku_code": "SKU-DAIRY-UHT-1L",
        "title": "Chilled Dairy & UHT Milk (Highland Farm Long-Life UHT Milk 1L)",
        "category": "Chilled Dairy & UHT Milk",
        "location": "Cold-Chain Hub #02 & 22 Urban Supermarket Branches",
        "warehouse_code": "WH-COLD-02",
        "preferred_vendor": "Highland Cooperative Creameries PLC (VND-20118)",
        "vendor_sla_reliability": "96.8% On-Time Fill",
        "erp_pr_number": "PR-ERP-88411",
        "unit_of_measure": "1L TetraPak",
        "case_pack_units": 12,
        "vendor_moq_units": 3600,
        "unit_cost_usd": 0.78,
        "retail_price_usd": 1.15,
        "on_hand_units": 4120,
        "in_transit_units": 0,
        "daily_sales_velocity": 1920.0,
        "baseline_velocity_30d": 600.0,
        "supplier_lead_time_days": 3,
        "bi_safety_stock_units": 1800,
        "target_cover_days": 10,
        "pr_approval_state": "BUYER_HOLD_SPIKE",
        "stockout_risk_impact_usd": 19850.0,
        "branch_allocations": [
            {"branch": "Cold-Chain Hub #02", "on_hand": 1950, "min_threshold": 4200, "daily_burn": 920, "status": "SPIKE_ALERT"},
            {"branch": "Kilimani Flagship Store", "on_hand": 840, "min_threshold": 1500, "daily_burn": 480, "status": "SPIKE_ALERT"},
            {"branch": "Karen Crossroads Branch", "on_hand": 710, "min_threshold": 900, "daily_burn": 290, "status": "BELOW_ROP"},
            {"branch": "Nakuru Regional Depot", "on_hand": 620, "min_threshold": 960, "daily_burn": 230, "status": "BELOW_ROP"},
        ],
        "audit_trail": [
            "06:10 UTC — POS & institutional invoice stream recorded 1,920 u/day burn vs 600 u/day 30D baseline.",
            "06:11 UTC — Demand Spike Guardrail triggered: 3.2x velocity multiplier exceeds 2.2x auto-release ceiling.",
            "06:12 UTC — Routed PR-ERP-88411 to HUMAN_BUYER_REVIEW to verify Back-to-School institutional catering spike.",
        ],
    },
    {
        "id": "RO-2026-903",
        "sku_code": "SKU-BEV-AQUA-1.5L",
        "title": "Beverage & Bottled Water (RiftValley Natural Spring Water 1.5L)",
        "category": "Beverage & Bottled Water",
        "location": "Central DC - Embakasi & Coastal Retail Network",
        "warehouse_code": "WH-CDC-01",
        "preferred_vendor": "RiftValley Springs Bottling Co. (VND-30904)",
        "vendor_sla_reliability": "99.1% On-Time Fill",
        "erp_pr_number": "PR-ERP-88412",
        "unit_of_measure": "1.5L PET Bottle",
        "case_pack_units": 12,
        "vendor_moq_units": 4800,
        "unit_cost_usd": 0.42,
        "retail_price_usd": 0.75,
        "on_hand_units": 5400,
        "in_transit_units": 1200,
        "daily_sales_velocity": 1350.0,
        "baseline_velocity_30d": 1220.0,
        "supplier_lead_time_days": 4,
        "bi_safety_stock_units": 2700,
        "target_cover_days": 14,
        "pr_approval_state": "PENDING_RELEASE",
        "stockout_risk_impact_usd": 16200.0,
        "branch_allocations": [
            {"branch": "Central DC - Embakasi", "on_hand": 2400, "min_threshold": 4500, "daily_burn": 610, "status": "CRITICAL"},
            {"branch": "Nyali Cinemax Coastal Branch", "on_hand": 1150, "min_threshold": 1600, "daily_burn": 310, "status": "BELOW_ROP"},
            {"branch": "Diani Beach Supermarket", "on_hand": 980, "min_threshold": 1250, "daily_burn": 245, "status": "BELOW_ROP"},
            {"branch": "JKIA Transit Convenience Hub", "on_hand": 870, "min_threshold": 1000, "daily_burn": 185, "status": "BELOW_ROP"},
        ],
        "audit_trail": [
            "06:15 UTC — Warm-weather seasonal lift holding steady at 1.11x baseline (1,350 u/day).",
            "06:16 UTC — Net available inventory (6,600 u) below dynamic ROP (8,100 u); 4.0 days on-hand cover.",
            "06:17 UTC — Staged PR-ERP-88412 as AUTO_PR_READY for 20,400 units (1,700 cases) at $8,568.00.",
        ],
    },
    {
        "id": "RO-2026-904",
        "sku_code": "SKU-HOME-DET-2KG",
        "title": "Home Care Detergents (SparkleClean Bio-Enzyme Laundry Powder 2kg)",
        "category": "Home Care Detergents",
        "location": "Central DC - Fast-Moving Non-Food Zone B",
        "warehouse_code": "WH-CDC-02",
        "preferred_vendor": "Unichem Home & Personal Care Ltd (VND-41209)",
        "vendor_sla_reliability": "95.2% On-Time Fill",
        "erp_pr_number": "PR-ERP-88413",
        "unit_of_measure": "2kg Pouch",
        "case_pack_units": 6,
        "vendor_moq_units": 900,
        "unit_cost_usd": 3.60,
        "retail_price_usd": 5.40,
        "on_hand_units": 920,
        "in_transit_units": 180,
        "daily_sales_velocity": 210.0,
        "baseline_velocity_30d": 195.0,
        "supplier_lead_time_days": 7,
        "bi_safety_stock_units": 550,
        "target_cover_days": 18,
        "pr_approval_state": "PENDING_RELEASE",
        "stockout_risk_impact_usd": 14900.0,
        "branch_allocations": [
            {"branch": "Central DC Non-Food Zone B", "on_hand": 380, "min_threshold": 980, "daily_burn": 92, "status": "CRITICAL"},
            {"branch": "Kisumu Mega Mall Branch", "on_hand": 210, "min_threshold": 360, "daily_burn": 48, "status": "BELOW_ROP"},
            {"branch": "Eldoret Highlands Store", "on_hand": 175, "min_threshold": 300, "daily_burn": 38, "status": "BELOW_ROP"},
            {"branch": "Buruburu Neighborhood Mart", "on_hand": 155, "min_threshold": 280, "daily_burn": 32, "status": "BELOW_ROP"},
        ],
        "audit_trail": [
            "06:22 UTC — Supplier lead time validated at 7 days; on-hand stock (920 u) covers only 4.4 days.",
            "06:23 UTC — Net available (1,100 u) breached ROP (2,020 u) with clean 1.08x velocity ratio.",
            "06:24 UTC — Staged PR-ERP-88413 as AUTO_PR_READY for 4,704 units (784 cases) at $16,934.40.",
        ],
    },
    {
        "id": "RO-2026-905",
        "sku_code": "SKU-PHARM-OTC-PARA",
        "title": "Pharmacy OTC Essentials (MediRelief Paracetamol 500mg 100-Tab Blister Pack)",
        "category": "Pharmacy OTC Essentials",
        "location": "GSDP Pharma Vault & 18 In-Store Pharmacy Counters",
        "warehouse_code": "WH-PHARM-01",
        "preferred_vendor": "BioMedica East Africa Pharmaceuticals (VND-50881)",
        "vendor_sla_reliability": "97.6% On-Time Fill",
        "erp_pr_number": "PR-ERP-88414",
        "unit_of_measure": "100-Tab Box",
        "case_pack_units": 24,
        "vendor_moq_units": 720,
        "unit_cost_usd": 1.95,
        "retail_price_usd": 3.40,
        "on_hand_units": 640,
        "in_transit_units": 0,
        "daily_sales_velocity": 165.0,
        "baseline_velocity_30d": 140.0,
        "supplier_lead_time_days": 6,
        "bi_safety_stock_units": 480,
        "target_cover_days": 21,
        "pr_approval_state": "PENDING_RELEASE",
        "stockout_risk_impact_usd": 21400.0,
        "branch_allocations": [
            {"branch": "GSDP Temperature-Controlled Vault", "on_hand": 240, "min_threshold": 720, "daily_burn": 70, "status": "CRITICAL"},
            {"branch": "Galleria Mall Pharmacy Counter", "on_hand": 150, "min_threshold": 280, "daily_burn": 36, "status": "BELOW_ROP"},
            {"branch": "Sarit Centre Health & Wellness", "on_hand": 135, "min_threshold": 260, "daily_burn": 32, "status": "BELOW_ROP"},
            {"branch": "Village Market Pharmacy", "on_hand": 115, "min_threshold": 210, "daily_burn": 27, "status": "BELOW_ROP"},
        ],
        "audit_trail": [
            "06:30 UTC — GSDP Pharma Vault telemetry shows 640 boxes on-hand (3.9 days cover vs 6-day lead time).",
            "06:31 UTC — Safety stock buffer (480 boxes) at imminent breach within 24 hours.",
            "06:32 UTC — Staged PR-ERP-88414 as AUTO_PR_READY for 4,320 units (180 cases) at $8,424.00.",
        ],
    },
    {
        "id": "RO-2026-906",
        "sku_code": "SKU-IND-PACK-FILM",
        "title": "Industrial Packaging Film (LLDPE 23-Micron Pallet Stretch Wrap 500mm Roll)",
        "category": "Industrial Packaging Film",
        "location": "Central DC Fulfillment & Co-Packing Operations",
        "warehouse_code": "WH-IND-04",
        "preferred_vendor": "PolyPack Extrusions & Polymers Ltd (VND-60312)",
        "vendor_sla_reliability": "99.4% On-Time Fill",
        "erp_pr_number": "PR-ERP-88415",
        "unit_of_measure": "15kg Jumbo Roll",
        "case_pack_units": 10,
        "vendor_moq_units": 300,
        "unit_cost_usd": 24.50,
        "retail_price_usd": 32.00,
        "on_hand_units": 780,
        "in_transit_units": 200,
        "daily_sales_velocity": 42.0,
        "baseline_velocity_30d": 40.0,
        "supplier_lead_time_days": 8,
        "bi_safety_stock_units": 220,
        "target_cover_days": 21,
        "pr_approval_state": "HEALTHY_MONITORED",
        "stockout_risk_impact_usd": 9500.0,
        "branch_allocations": [
            {"branch": "Central DC Palletizing Bays 1-8", "on_hand": 490, "min_threshold": 320, "daily_burn": 26, "status": "HEALTHY"},
            {"branch": "Mombasa Port Cross-Dock Facility", "on_hand": 180, "min_threshold": 140, "daily_burn": 10, "status": "HEALTHY"},
            {"branch": "Cold-Chain Repackaging Unit", "on_hand": 110, "min_threshold": 96, "daily_burn": 6, "status": "HEALTHY"},
        ],
        "audit_trail": [
            "06:40 UTC — Daily co-packing consumption stable at 42 rolls/day (1.05x baseline).",
            "06:41 UTC — Net available inventory (980 rolls) provides 23.3 days cover vs ROP of 556 rolls.",
            "06:42 UTC — No ERP Purchase Requisition needed; next scheduled ROP review in 9 days.",
        ],
    },
]


def build_seed_reorders() -> List[Dict[str, Any]]:
    enriched: List[Dict[str, Any]] = []
    for item in RAW_REORDER_GROUPS:
        copy_item = dict(item)
        metrics = compute_replenishment_metrics(
            on_hand_units=copy_item["on_hand_units"],
            in_transit_units=copy_item["in_transit_units"],
            daily_sales_velocity=copy_item["daily_sales_velocity"],
            baseline_velocity_30d=copy_item["baseline_velocity_30d"],
            supplier_lead_time_days=copy_item["supplier_lead_time_days"],
            bi_safety_stock_units=copy_item["bi_safety_stock_units"],
            vendor_moq_units=copy_item["vendor_moq_units"],
            case_pack_units=copy_item["case_pack_units"],
            unit_cost_usd=copy_item["unit_cost_usd"],
            target_cover_days=copy_item["target_cover_days"],
        )
        copy_item["metrics"] = metrics
        enriched.append(copy_item)
    return enriched
