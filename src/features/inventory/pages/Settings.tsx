"use client"

import { useInventory } from "@/context/InventoryContext"
import { Button, PageHeader, Select } from "@/components/ui"

export default function Settings() {
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed, notify } =
    useInventory()
  return (
    <div className="page">
      <PageHeader
        title="Preferences"
        subtitle="Configure your personal workspace experience."
      />
      <section className="settings-card">
        <h2>Appearance</h2>
        <p>Preferences are stored locally in this browser.</p>
        <Select
          label="Color theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value as "light" | "dark")}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <label className="toggle-row">
          <span>
            <strong>Collapse sidebar</strong>
            <small>Use the compact navigation by default.</small>
          </span>
          <input
            type="checkbox"
            checked={sidebarCollapsed}
            onChange={(e) => setSidebarCollapsed(e.target.checked)}
          />
        </label>
        <Button variant="secondary" onClick={() => notify("Preferences saved")}>
          Save preferences
        </Button>
      </section>
    </div>
  )
}
