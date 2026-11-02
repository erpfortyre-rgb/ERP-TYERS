import { useState } from "react";
import { FiSave, FiUpload } from "react-icons/fi";
import toast from "react-hot-toast";
import { mockCompanySettings } from "../mockData";
import type { CompanySettings } from "../types";

export default function SettingsPage() {
  const [form, setForm] = useState<CompanySettings>(mockCompanySettings);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Company name is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (!/^\d{10}$/.test(form.phone)) e.phone = "Enter valid 10-digit phone";
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}$/.test(form.gstin))
      e.gstin = "Invalid GSTIN format";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    // In a real app, this would call the API
    toast.success("Settings saved successfully");
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Settings</h2>
          <div className="breadcrumb"><a href="/">Home</a> / Settings</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Company Information</div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>GSTIN</label>
              <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="e.g., 09ABCDE1234F1Z5" />
              {errors.gstin && <span className="error-text">{errors.gstin}</span>}
            </div>
            <div className="form-group full-width">
              <label>Address</label>
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} />
            </div>
            <div className="form-group">
              <label>Phone *</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
            <div className="form-group full-width">
              <label>Company Logo</label>
              <div style={{
                border: "2px dashed var(--color-border)",
                borderRadius: "var(--radius)",
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                color: "var(--color-text-secondary)",
                cursor: "pointer",
              }}
                onClick={() => toast("Logo upload will be available when backend is connected")}
              >
                <FiUpload size={24} />
                <span style={{ fontSize: 14 }}>Click to upload logo</span>
                <span style={{ fontSize: 12 }}>PNG, JPG up to 2MB</span>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              <FiSave /> Save Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
