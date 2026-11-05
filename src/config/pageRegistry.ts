export const pageRegistry = [
  { id: "dashboard", path: "/", label: "Dashboard" },
  { id: "asset-inventory", path: "/assets", label: "Asset Inventory" },
  { id: "goods-in", path: "/goods-in", label: "Assets In" },
  { id: "goods-out", path: "/goods-out", label: "Assets Out" },
  { id: "stock-opname", path: "/audits", label: "Stock Opname" },
  { id: "master-data", path: "/master-data", label: "Master Data" },
  { id: "reports", path: "/reports", label: "Reports & Export" },
  { id: "settings", path: "/settings", label: "Preferences" },
] as const

export type PagePermission = (typeof pageRegistry)[number]["id"]
