import { useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import { mockStores } from "../mockData";
import type { Store } from "../types";

const emptyForm = {
  name: "",
  code: "",
  address: "",
  phone: "",
  gstin: "",
  active: true,
};

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>(mockStores);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(s: Store) {
    setEditId(s.id);
    setForm({ name: s.name, code: s.code, address: s.address, phone: s.phone, gstin: s.gstin, active: s.active });
    setErrors({});
    setShowModal(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.code.trim()) e.code = "Code is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (!/^(\+91\s?)?\d{10}$/.test(form.phone.replace(/[\s-]/g, ''))) e.phone = "Enter valid phone (10 digits, optional +91)";
    if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}$/.test(form.gstin))
      e.gstin = "Invalid GSTIN format";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    if (editId) {
      setStores((prev) =>
        prev.map((s) =>
          s.id === editId ? { ...s, ...form } : s,
        ),
      );
      toast.success("Store updated successfully");
    } else {
      const newStore: Store = {
        id: `s${Date.now()}`,
        ...form,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setStores((prev) => [...prev, newStore]);
      toast.success("Store created successfully");
    }
    setShowModal(false);
  }

  function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this store?")) {
      setStores((prev) => prev.filter((s) => s.id !== id));
      toast.success("Store deleted");
    }
  }

  const columns = [
    { key: "name", header: "Name" },
    { key: "code", header: "Code" },
    { key: "phone", header: "Phone" },
    { key: "gstin", header: "GSTIN" },
    {
      key: "active",
      header: "Status",
      render: (row: Store) => (
        <span className={`badge ${row.active ? "badge-success" : "badge-error"}`}>
          {row.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: Store) => (
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn btn-sm btn-icon" onClick={() => openEdit(row)} title="Edit">
            <FiEdit2 />
          </button>
          <button className="btn btn-sm btn-icon btn-danger" onClick={() => handleDelete(row.id)} title="Delete">
            <FiTrash2 />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Stores</h2>
          <div className="breadcrumb"><a href="/">Home</a> / Stores</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus /> Add Store
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <DataTable
            columns={columns}
            data={stores}
            searchPlaceholder="Search stores..."
            searchKeys={["name", "code", "gstin"]}
          />
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? "Edit Store" : "Create Store"}</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Store Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label>Code *</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g., SST-MAIN" />
                  {errors.code && <span className="error-text">{errors.code}</span>}
                </div>
                <div className="form-group full-width">
                  <label>Address</label>
                  <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" />
                  {errors.phone && <span className="error-text">{errors.phone}</span>}
                </div>
                <div className="form-group">
                  <label>GSTIN</label>
                  <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="e.g., 09ABCDE1234F1Z5" />
                  {errors.gstin && <span className="error-text">{errors.gstin}</span>}
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
                <button className="btn btn-primary" onClick={handleSave}>{editId ? "Update" : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
