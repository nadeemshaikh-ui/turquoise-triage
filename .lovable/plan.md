

# Restoree 360 — Phase 1: UI & Lead Engine

## 1. Design System & Theme
- Bright white background with **Vibrant Turquoise (#40E0D0)** and **Deep Teal** accents
- **28px border-radius** on all cards, buttons, inputs for friendly-luxury feel
- Clean, high-contrast typography with professional spacing
- Turquoise/Gold badge styling for Gold Tier leads

## 2. Dashboard (Home Screen)
- **Gold Tier Leads** pinned at top with turquoise/gold badges (Luxury Bags & Signature services > ₹6000)
- **New Leads pipeline** showing recent intakes with status indicators (New → In Progress → Completed)
- **Quick Stats bar**: Today's orders, active leads, revenue snapshot
- Quick-action button: **"+ New Lead"**

## 3. Lead Intake Form (Multi-Step Triage)
- **Step 1 — Service Selection**: Browse the full catalog organized by category tabs:
  - **Cleaning**: Sneaker Deep Clean, Signature Clean, Boots/Heeled Shoes, Suede/Nubuck Special
  - **Repair & Structural**: Sole Pasting (Full/Minor), Heel Tip, Stitching/Patching, Zip/Hardware
  - **Restoration & Color**: Leather Peeling, Full Color Restoration, Suede Dyeing, Mid-sole Unyellowing
  - **Luxury Bags**: Deep Cleaning, Structural Realignment, Edge Painting, Color Change
  - **Custom**: "Create Custom Service" button with name & price fields
- **Step 2 — Customer Details**: Name, phone, optional email
- **Step 3 — Photos & Assessment**:
  - **3 mandatory photo uploads** for Restoration & Bag services (stored in Lovable Cloud storage)
  - **Consultative Price Range** displayed for Peeling (₹2,500–₹5,000) and Bag Restoration (₹5,000–₹9,500)
  - Executive enters final quoted price
- **Step 4 — TAT & Confirmation**:
  - Default TAT auto-filled (4–5 days Cleaning, 10–15 days others)
  - Executive can **manually override TAT** for this specific order
  - Review summary → Submit

## 4. Lead List & Management
- Filterable list of all leads with status, service type, price, and TAT
- **Gold Tier** leads auto-scored and pinned to top
- Click to view full lead details, photos, and order history
- Status updates: New → In Progress → Ready for Pickup → Completed

## 5. Backend (Lovable Cloud)
- **Database tables**: Leads, Services catalog, Customers, Photos metadata
- **Storage bucket**: Customer photos for restoration/bag services
- **Authentication**: Team login so multiple staff can access the system

## 6. Services Management
- Admin page to view/edit the full service catalog
- Add/edit/remove custom services with name, category, default price, and default TAT

