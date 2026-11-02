import { useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import { mockSyncRecords } from "../mockData";
import type { SyncRecord } from "../types";

export default function SyncMonitorPage() {
  const [records] = useState<SyncRecord[]>(mockSyncRecords);

  function formatDate(iso: string): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }

  function handleRefresh() {
    toast.success("Sync status refreshed");
  }

  const totalPending = records.reduce((sum, r) => sum + r.pendingItems, 0);
  const errorCount = records.filter((r) => r.status === "error").length;

  const columns = [
    { key: "deviceName", header: "Device" },
    { key: "storeName", header: "Store" },
    {
      key: "lastSync",
      header: "Last Sync",
      render: (row: SyncRecord) => formatDate(row.lastSync),
    },
    {
      key: "pendingItems",
      header: "Pending Items",
      render: (row: SyncRecord) => (
        <span style={{ fontWeight: 600 }}>{row.pendingItems}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: SyncRecord) => {
        const cls = row.status === "synced" ? "badge-success" : row.status === "pending" ? "badge-warning" : "badge-error";
        const label = row.status === "synced" ? "Synced" : row.status === "pending" ? "Pending" : "Error";
        return <span className={`badge ${cls}`}>{label}</span>;
      },
    },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Sync Monitor</h2>
          <div className="breadcrumb"><a href="/">Home</a> / Sync Monitor</div>
        </div>
        <button className="btn btn-primary" onClick={handleRefresh}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-icon blue"><FiRefreshCw /></div>
          <div className="stat-card-info">
            <h3>{records.length}</h3>
            <p>Total Devices</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon orange"><FiRefreshCw /></div>
          <div className="stat-card-info">
            <h3>{totalPending}</h3>
            <p>Pending Items</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red"><FiRefreshCw /></div>
          <div className="stat-card-info">
            <h3>{errorCount}</h3>
            <p>Devices with Errors</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <DataTable
            columns={columns}
            data={records}
            searchPlaceholder="Search devices..."
            searchKeys={["deviceName", "storeName"]}
          />
        </div>
      </div>
    </>
  );
}
