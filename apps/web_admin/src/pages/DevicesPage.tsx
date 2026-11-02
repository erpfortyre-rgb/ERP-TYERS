import { useState } from "react";
import { FiPlus, FiEdit2, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import { mockDevices, mockStores } from "../mockData";
import type { Device } from "../types";

const emptyForm = {
  name: "",
  storeId: mockStores[0]?.id ?? "",
  invoicePrefix: "",
  macAddress: "",
  active: true,
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openRegister() {
    setEditId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(d: Device) {
    setEditId(d.id);
    setForm({ name: d.name, storeId: d.storeId, invoicePrefix: d.invoicePrefix, macAddress: d.macAddress, active: d.active });
    setErrors({});
    setShowModal(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Device name is required";
    if (!form.invoicePrefix.trim()) e.invoicePrefix = "Invoice prefix is required";
    if (!form.macAddress.trim()) e.macAddress = "MAC address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const store = mockStores.find((s) => s.id === form.storeId);
    if (editId) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === editId ? { ...d, ...form, storeName: store?.name ?? "" } : d,
        ),
      );
      toast.success("Device updated successfully");
    } else {
      const newDevice: Device = {
        id: `d${Date.now()}`,
        ...form,
        storeName: store?.name ?? "",
        lastSeen: new Date().toISOString(),
      };
      setDevices((prev) => [...prev, newDevice]);
      toast.success("Device registered successfully");
    }
    setShowModal(false);
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }

  const columns = [
    { key: "name", header: "Device Name" },
    { key: "storeName", header: "Store" },
    { key: "invoicePrefix", header: "Invoice Prefix" },
    { key: "macAddress", header: "MAC Address" },
    {
      key: "lastSeen",
      header: "Last Seen",
      render: (row: Device) => formatDate(row.lastSeen),
    },
    {
      key: "active",
      header: "Status",
      render: (row: Device) => (
        <span className={`badge ${row.active ? "badge-success" : "badge-error"}`}>
          {row.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: Device) => (
        <button className="btn btn-sm btn-icon" onClick={() => openEdit(row)} title="Edit">
          <FiEdit2 />
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Devices</h2>
          <div className="breadcrumb"><a href="/">Home</a> / Devices</div>
        </div>
        <button className="btn btn-primary" onClick={openRegister}>
          <FiPlus /> Register Device
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <DataTable
            columns={columns}
            data={devices}
            searchPlaceholder="Search devices..."
            searchKeys={["name", "storeName", "invoicePrefix"]}
          />
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? "Edit Device" : "Register Device"}</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Device Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label>Store</label>
                  <select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
                    {mockStores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Invoice Prefix *</label>
                  <input value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} placeholder="e.g., MN" />
                  {errors.invoicePrefix && <span className="error-text">{errors.invoicePrefix}</span>}
                </div>
                <div className="form-group">
                  <label>MAC Address *</label>
                  <input value={form.macAddress} onChange={(e) => setForm({ ...form, macAddress: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" />
                  {errors.macAddress && <span className="error-text">{errors.macAddress}</span>}
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <div className="toggle-wrapper">
                    <button type="button" className={`toggle ${form.active ? "active" : ""}`} onClick={() => setForm({ ...form, active: !form.active })} />
                    <span>{form.active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave}>{editId ? "Update" : "Register"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
