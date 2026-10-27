"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageMinus,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from "lucide-react"
import { businessUnits } from "../data/demoData"
import { useInventory } from "../context/InventoryContext"
import { useAuth } from "../auth/AuthContext"
import { Badge, Button, ConfirmDialog, IconButton, Select } from "./ui"
import { cn } from "../utils/helpers"
import { AssetDrawer } from "./assets"
import { ProfileEditor } from "./ProfileEditor"

const navigation = [
  {
    group: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Asset Management",
    items: [
      { to: "/assets", label: "Asset Inventory", icon: Boxes },
      { to: "/goods-in", label: "Goods In", icon: PackagePlus },
      { to: "/goods-out", label: "Goods Out", icon: PackageMinus },
      { to: "/audits", label: "Stock Opname", icon: ClipboardCheck },
    ],
  },
  {
    group: "Administration",
    items: [
      { to: "/master-data", label: "Master Data", icon: Database },
      { to: "/reports", label: "Reports & Export", icon: BarChart3 },
    ],
  },
]

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

export function AppLayout({ children }: { children: ReactNode }) {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    theme,
    setTheme,
    businessUnit,
    setBusinessUnit,
    assets,
    transactions,
    setSelectedAsset,
    toast,
  } = useInventory()
  const { currentUser, logout, isPending } = useAuth()
  const [mobile, setMobile] = useState(false)
  const [search, setSearch] = useState("")
  const [alerts, setAlerts] = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const title =
    navigation
      .flatMap((group) => group.items)
      .find((item) => item.to === pathname)?.label ??
    (pathname === "/settings"
      ? "Preferences"
      : pathname === "/accounts"
        ? "Account Management"
        : "IT Inventory")

  const results = useMemo(() => {
    if (search.length < 2) return []
    const query = search.toLowerCase()
    const assetMatches = assets
      .filter((asset) =>
        [asset.id, asset.serial, asset.model, asset.brand, asset.location].some(
          (value) => value.toLowerCase().includes(query),
        ),
      )
      .slice(0, 5)
      .map((asset) => ({
        id: asset.id,
        title: asset.id,
        subtitle: `${asset.brand} ${asset.model}`,
        type: "asset",
      }))
    const transactionMatches = transactions
      .filter((transaction) =>
        transaction.document.toLowerCase().includes(query),
      )
      .slice(0, 3)
      .map((transaction) => ({
        id: transaction.id,
        title: transaction.document,
        subtitle: `${transaction.direction} · ${transaction.assetId}`,
        type: "transaction",
      }))
    return [...assetMatches, ...transactionMatches]
  }, [search, assets, transactions])

  const openDestination = (result: typeof results[number]) => {
    if (result.type === "asset") {
      setSelectedAsset(assets.find((asset) => asset.id === result.id) ?? null)
    } else {
      router.push(result.subtitle.startsWith("In") ? "/goods-in" : "/goods-out")
    }
    setSearch("")
  }

  return (
    <div className={cn("app-shell", sidebarCollapsed && "sidebar-collapsed")}>
      <aside className={cn("sidebar", mobile && "mobile-open")}>
        <div className="brand">
          <span className="brand-mark">
            <Boxes size={19} />
          </span>
          {!sidebarCollapsed && (
            <div>
              <strong>IT Inventory</strong>
              <small>Asset Management</small>
            </div>
          )}
          <IconButton
            label="Close navigation"
            className="mobile-close"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </IconButton>
        </div>
        <nav>
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              {!sidebarCollapsed && <span>{group.group}</span>}
              {group.items.map((item) => (
                <Link
                  className={pathname === item.to ? "active" : ""}
                  title={sidebarCollapsed ? item.label : undefined}
                  key={item.to}
                  href={item.to}
                  onClick={() => setMobile(false)}
                >
                  <item.icon size={18} />
                  <em>{item.label}</em>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Badge tone="info">Protected</Badge>
          {!sidebarCollapsed && <small>{currentUser.role} session</small>}
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <IconButton
            label="Toggle sidebar"
            className="desktop-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </IconButton>
          <IconButton
            label="Open navigation"
            className="mobile-toggle"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </IconButton>
          <div className="topbar-title">
            <small>IT Inventory</small>
            <strong>{title}</strong>
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              aria-label="Global search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assets, serials, documents..."
            />
            {search.length >= 2 && (
              <div className="search-results">
                {results.length ? (
                  results.map((result) => (
                    <Button
                      variant="ghost"
                      key={result.id}
                      onClick={() => openDestination(result)}
                    >
                      <strong>{result.title}</strong>
                      <span>{result.subtitle}</span>
                    </Button>
                  ))
                ) : (
                  <p>No matching records</p>
                )}
              </div>
            )}
          </div>
          <Select
            aria-label="Business unit"
            className="unit-switcher"
            value={businessUnit}
            onChange={(event) => setBusinessUnit(event.target.value)}
            options={["All Business Units", ...businessUnits]}
          />
          <div className="topbar-menu">
            <IconButton
              label="Notifications"
              onClick={() => setAlerts(!alerts)}
            >
              <Bell size={18} />
              <i className="notify-dot" />
            </IconButton>
            {alerts && (
              <div className="popover notification-popover">
                <strong>Notifications</strong>
                <p>3 audit findings need attention.</p>
                <p>Goods-Out DSP-2026-014 is pending.</p>
              </div>
            )}
          </div>
          <IconButton
            label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </IconButton>
          <div className="topbar-menu">
            <Button
              variant="ghost"
              className="user-menu"
              aria-expanded={profileMenu}
              onClick={() => setProfileMenu(!profileMenu)}
            >
              <ProfileAvatar
                name={currentUser.name}
                photo={currentUser.profile_photo}
              />
              <span>{currentUser.name}</span>
              <ChevronDown size={15} />
            </Button>
            {profileMenu && (
              <div className="popover profile-popover">
                <Button
                  variant="ghost"
                  className="profile-summary"
                  onClick={() => {
                    setProfileOpen(true)
                    setProfileMenu(false)
                  }}
                >
                  <ProfileAvatar
                    name={currentUser.name}
                    photo={currentUser.profile_photo}
                    large
                  />
                  <span>
                    <strong>{currentUser.name}</strong>
                    <small>NIK: {currentUser.nik}</small>
                    <Badge
                      tone={currentUser.role === "Admin" ? "info" : "neutral"}
                    >
                      {currentUser.role}
                    </Badge>
                  </span>
                </Button>
                <div className="profile-menu-actions">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      router.push("/settings")
                      setProfileMenu(false)
                    }}
                  >
                    <Settings size={16} /> Settings
                  </Button>
                  {currentUser.role === "Admin" && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        router.push("/accounts")
                        setProfileMenu(false)
                      }}
                    >
                      <ShieldCheck size={16} /> Account Management
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLogoutOpen(true)
                      setProfileMenu(false)
                    }}
                  >
                    <LogOut size={16} /> Logout
                  </Button>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <AssetDrawer />
      <ProfileEditor open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ConfirmDialog
        open={logoutOpen}
        title="Sign out?"
        description="You will need to sign in again to access the inventory system."
        confirmLabel={isPending ? "Signing out..." : "Logout"}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void logout()}
      />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export function ProfileAvatar({
  name,
  photo,
  large = false,
}: {
  name: string
  photo?: string
  large?: boolean
}) {
  return (
    <span className={cn("avatar", large && "avatar-large")}>
      {photo ? (
        <Image
          src={photo}
          alt={`${name} profile`}
          width={large ? 44 : 28}
          height={large ? 44 : 28}
        />
      ) : (
        initials(name) || <UserRound size={large ? 20 : 14} />
      )}
    </span>
  )
}
