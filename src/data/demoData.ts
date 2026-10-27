import { canonicalMasterSeed } from "./masterDataSeed"

export type Asset = {
  id: string
  serial: string
  tag?: string
  category: string
  group: string
  type: string
  brand: string
  model: string
  location: string
  businessUnit: string
  condition: string
  quantity: number
  uom: string
  updatedAt: string
  po?: string
  sap?: string
  value?: number
  description?: string
  demo?: boolean
}

export type TransactionStatus = "In Progress" | "Completed"

export type TransactionParty = {
  name: string
  nik: string
  department: string
}

export type TransactionAttachment = {
  id: string
  name: string
  size: number
  type: string
}

export type TransactionAssetItem = {
  rowId: string
  assetId: string
  itemName: string
  quantity: number
  serialNumber?: string
  referenceNumber?: string
  assetInformation?: string
  condition?: string
  remarks?: string
  specifications?: string
  justification?: string
  duration?: string
  purpose?: string
}

export type StatusHistoryEntry = {
  id: string
  previousStatus: TransactionStatus
  newStatus: TransactionStatus
  actorAccountId: string
  actorName: string
  actorNik: string
  timestamp: string
  notes?: string
}

export type Transaction = {
  id: string
  direction: "In" | "Out"
  date: string
  document: string
  assetId: string
  type: string
  quantity: number
  location: string
  businessUnit: string
  status: TransactionStatus
  user: string
  po?: string
  notes?: string
  requestDate?: string
  formIssueDate?: string
  party?: TransactionParty
  assets?: TransactionAssetItem[]
  supportingDocuments?: TransactionAttachment[]
  requestNumber?: string
  approverName?: string
  inventoryNotes?: string
  statusHistory?: StatusHistoryEntry[]
  inventoryAdjustmentApplied?: boolean
  inventoryAdjustedAt?: string
}

export type AuditItem = {
  assetId: string
  physicalQty: number | null
  actualLocation: string
  finding: string
  confirmed: boolean
  notes: string
  evidence?: string
}

export type Audit = {
  id: string
  name: string
  date: string
  auditor: string
  businessUnit: string
  location: string
  status: string
  items: AuditItem[]
}

export type MasterItem = {
  id: string
  name: string
  code: string
  parent?: string
  active?: boolean
  category_id?: string
  category_name?: string
  category_code?: string
  group_id?: string
  group_name?: string
  group_code?: string
  type_id?: string
  type_name?: string
  type_code?: string
  brand_id?: string
  brand_name?: string
  brand_code?: string
  model_id?: string
  model_name?: string
  model_code?: string
  asset_id?: string
  location_id?: string
  location_name?: string
  location_code?: string
  business_unit?: string
  condition_id?: string
  condition_name?: string
  status_code?: string
}

export const businessUnits = [
  "MBP",
  "HBI",
  "AL",
  "SMT",
  "BGN",
  "PBMM",
  "IMPT",
  "SDM",
  "IBT",
]
export const locations = [
  "Jakarta HQ",
  "Surabaya Office",
  "Cikarang Warehouse",
  "Balikpapan Site",
  "Medan Branch",
]

export const demoMaster: Record<string, MasterItem[]> = {
  ...canonicalMasterSeed,
  locations: locations.map((name, i) => ({
    id: `l${String(i + 1).padStart(4, "0")}`,
    name,
    code: ["JKT", "SBY", "CKR", "BPN", "MDN"][i],
    location_id: `l${String(i + 1).padStart(4, "0")}`,
    location_name: name,
    location_code: ["JKT", "SBY", "CKR", "BPN", "MDN"][i],
  })),
  conditions: ["Good", "Damaged", "Disposal"].map((name, i) => ({
    id: `s${String(i + 1).padStart(4, "0")}`,
    name,
    code: name.slice(0, 2).toUpperCase(),
    condition_id: `s${String(i + 1).padStart(4, "0")}`,
    condition_name: name,
    status_code: name.slice(0, 2).toUpperCase(),
  })),
}

const seeds = [
  [
    "CPCCBOTMBP00001",
    "SN-LNV-92841",
    "Goods",
    "Computer",
    "Notebook",
    "Lenovo",
    "ThinkPad T14 Gen 4",
    "Jakarta HQ",
    "MBP",
    "Good",
  ],
  [
    "CPCCBOTMBP00002",
    "SN-DEL-77192",
    "Goods",
    "Computer",
    "Notebook",
    "Dell",
    "Latitude 5440",
    "Jakarta HQ",
    "MBP",
    "Good",
  ],
  [
    "CPCCDTCAL00003",
    "SN-OPT-19022",
    "Goods",
    "Computer",
    "Desktop",
    "Dell",
    "OptiPlex 7010",
    "Surabaya Office",
    "AL",
    "Good",
  ],
  [
    "GNWRTCIMPT00004",
    "FCZ2134A0KT",
    "Goods",
    "Network Device",
    "Router",
    "Cisco",
    "ISR 4331",
    "Cikarang Warehouse",
    "IMPT",
    "Good",
  ],
  [
    "GSTHDTHBI00005",
    "WD-WCC6Y7H92",
    "Goods",
    "Storage",
    "Internal HDD",
    "Western Digital",
    "SATA 500 GB Blue",
    "Jakarta HQ",
    "HBI",
    "Damaged",
  ],
  [
    "GPDMONSMT00006",
    "CN0M92P2",
    "Goods",
    "Peripheral Device",
    "Monitor",
    "Dell",
    "P2422H",
    "Surabaya Office",
    "SMT",
    "Good",
  ],
  [
    "GSPMOPBGN00007",
    "R58W31A54",
    "Goods",
    "Smartphone",
    "Mobile Phone",
    "Samsung",
    "Galaxy A54",
    "Balikpapan Site",
    "BGN",
    "Good",
  ],
  [
    "CPCTNRPBMM00008",
    "LOT-136-224",
    "Consumable",
    "Peripheral Consumable",
    "Toner",
    "HP",
    "LaserJet Toner 136A",
    "Cikarang Warehouse",
    "PBMM",
    "Good",
  ],
  [
    "SLIOSFSDM00009",
    "LIC-M365-188",
    "Software",
    "Application",
    "Office Suite",
    "Microsoft",
    "Microsoft 365 Business",
    "Jakarta HQ",
    "SDM",
    "Good",
  ],
  [
    "CPCCBOTIBT00010",
    "SN-LNV-55311",
    "Goods",
    "Computer",
    "Notebook",
    "Lenovo",
    "ThinkPad T14 Gen 4",
    "Medan Branch",
    "IBT",
    "Disposal",
  ],
] as string[][]

export const demoAssets: Asset[] = Array.from({ length: 36 }, (_, i) => {
  const s = seeds[i % seeds.length]
  const n = i + 1
  return {
    id:
      i < seeds.length
        ? s[0]
        : `${s[0].slice(0, -5)}${String(n).padStart(5, "0")}`,
    serial: i < seeds.length ? s[1] : `${s[1]}-${n}`,
    tag: `IT-${String(n).padStart(5, "0")}`,
    category: s[2],
    group: s[3],
    type: s[4],
    brand: s[5],
    model: s[6],
    location: locations[i % locations.length],
    businessUnit: businessUnits[i % businessUnits.length],
    condition: s[9],
    quantity: s[2] === "Consumable" ? 8 + i : 1,
    uom: s[2] === "Consumable" ? "PCS" : "UNIT",
    updatedAt: `2026-09-${String(17 - (i % 12)).padStart(2, "0")}`,
    po: `PO-2026-${String(1400 + i)}`,
    sap: `MAT-${String(78000 + i)}`,
    value: 3500000 + i * 275000,
    demo: true,
    description:
      "Seeded demonstration record based on the workbook domain schema.",
  }
})

export const demoTransactions: Transaction[] = [
  {
    id: "TRX-1001",
    direction: "In",
    date: "2026-09-17",
    document: "GR-2026-0917",
    assetId: "CPCCBOTMBP00001",
    type: "New Unit",
    quantity: 1,
    location: "Jakarta HQ",
    businessUnit: "MBP",
    status: "Completed",
    user: "Dimas Pratama",
    po: "PO-2026-1400",
  },
  {
    id: "TRX-1002",
    direction: "Out",
    date: "2026-09-16",
    document: "BAST-2026-442",
    assetId: "CPCCBOTMBP00002",
    type: "Handover",
    quantity: 1,
    location: "Jakarta HQ",
    businessUnit: "MBP",
    status: "Completed",
    user: "Sari Wulandari",
  },
  {
    id: "TRX-1003",
    direction: "Out",
    date: "2026-09-14",
    document: "SRV-2026-118",
    assetId: "GSTHDTHBI00005",
    type: "Service",
    quantity: 1,
    location: "Jakarta HQ",
    businessUnit: "HBI",
    status: "In Progress",
    user: "PT Service Teknologi",
  },
  {
    id: "TRX-1004",
    direction: "In",
    date: "2026-09-12",
    document: "RET-2026-027",
    assetId: "GPDMONSMT00006",
    type: "Return",
    quantity: 1,
    location: "Surabaya Office",
    businessUnit: "SMT",
    status: "Completed",
    user: "Rama Aditya",
  },
  {
    id: "TRX-1005",
    direction: "Out",
    date: "2026-09-10",
    document: "DSP-2026-014",
    assetId: "GSPMOPBGN00007",
    type: "Disposal",
    quantity: 1,
    location: "Balikpapan Site",
    businessUnit: "BGN",
    status: "In Progress",
    user: "Nina Larasati",
  },
]

export const demoAudits: Audit[] = [
  {
    id: "AUD-2026-001",
    name: "Q3 IT Asset Verification",
    date: "2026-09-15",
    auditor: "Andi Setiawan",
    businessUnit: "MBP",
    location: "Jakarta HQ",
    status: "In Progress",
    items: demoAssets
      .filter((a) => a.businessUnit === "MBP")
      .map((a, i) => ({
        assetId: a.id,
        physicalQty: i < 2 ? 1 : i === 2 ? 0 : null,
        actualLocation: i === 1 ? "Cikarang Warehouse" : a.location,
        finding:
          i === 0
            ? "Match"
            : i === 1
              ? "Fisik ada data berbeda"
              : i === 2
                ? "Fisik tidak ada"
                : "Unverified",
        confirmed: i < 3,
        notes: "",
      })),
  },
]
