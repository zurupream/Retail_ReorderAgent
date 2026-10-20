# Live Inventory Threshold & Autonomous Reorder Agent (`Retail_ReorderAgent` — Agent #09)

Enterprise Retail, Distribution & Manufacturing supply-chain workbench that continuously monitors live warehouse and retail branch stock against BI safety thresholds, executes deterministic Reorder Point (`ROP`) math, enforces `3.2x` demand spike guardrails, and releases ERP Purchase Requisitions.

## Core Capabilities
1. **Live Inventory & BI Threshold Monitor**: Tracks on-hand and in-transit stock across 6 core SKU groups (`Fast-Moving Cooking Oils & Staples`, `Chilled Dairy & UHT Milk`, `Beverage & Bottled Water`, `Home Care Detergents`, `Pharmacy OTC Essentials`, `Industrial Packaging Film`).
2. **Deterministic Replenishment & Demand Spike Engine**:
   - `Reorder Point (ROP) = (Daily Sales Velocity × Supplier Lead Time Days) + BI Safety Stock`
   - `Days of Stock Cover = On-Hand Units / Daily Sales Velocity`
   - Flags `3.2x` velocity surges (`RO-2026-902`) for `HUMAN_BUYER_REVIEW` while clean breaches route to `AUTO_PR_READY`.
   - Rounds optimal order quantities to Vendor MOQ and Case Pack multiples.
3. **Supply Chain & Replenishment AI Co-Pilot**: Powered by Vertex AI `gemini-2.5-flash` with deterministic replenishment fallback.
4. **ERP Purchase Requisition Authorization**: Print-ready executive Purchase Requisition authorization (`window.print()`).
