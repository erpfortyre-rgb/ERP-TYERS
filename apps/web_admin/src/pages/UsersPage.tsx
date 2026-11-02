import { useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import { mockUsers, mockStores } from "../mockData";
import type { User } from "../types";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "Cashier" as User["role"],
  storeId: mockStores[0]?.id ?? "",
  active: true,
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
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

  function openEdit(u: User) {
    setEditId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      storeId: u.storeId,
      active: u.active,
    });
    setErrors({});
    setShowModal(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!editId && !form.password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const store = mockStores.find((s) => s.id === form.storeId);
    if (editId) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editId
            ? { ...u, name: form.name, email: form.email, role: form.role, storeId: form.storeId, storeName: store?.name ?? "", active: form.active }
            : u,
        ),
      );
      toast.success("User updated successfully");
    } else {
      const newUser: User = {
        id: `u${Date.now()}`,
        name: form.name,
        email: form.email,
        role: form.role,
        storeId: form.storeId,
        storeName: store?.name ?? "",
        active: form.active,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setUsers((prev) => [...prev, newUser]);
      toast.success("User created successfully");
    }
    setShowModal(false);
  }

  function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted");
    }
  }

  const columns = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    {
      key: "role",
      header: "Role",
      render: (row: User) => <span className="badge badge-blue">{row.role}</span>,
    },
    { key: "storeName", header: "Store" },
    {
      key: "active",
      header: "Status",
      render: (row: User) => (
        <span className={`badge ${row.active ? "badge-success" : "badge-error"}`}>
          {row.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: User) => (
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
          <h2>Users</h2>
          <div className="breadcrumb"><a href="/">Home</a> / Users</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus /> Add User
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <DataTable
            columns={columns}
            data={users}
            searchPlaceholder="Search users..."
            searchKeys={["name", "email", "role", "storeName"]}
          />
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? "Edit User" : "Create User"}</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  {errors.email && <span className="error-text">{errors.email}</span>}
                </div>
                <div className="form-group">
                  <label>{editId ? "Password (leave blank to keep)" : "Password *"}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  {errors.password && <span className="error-text">{errors.password}</span>}
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}>
                    <option value="Owner">Owner</option>
                    <option value="Manager">Manager</option>
                    <option value="Cashier">Cashier</option>
                  </select>
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
                  <label>Status</label>
                  <div className="toggle-wrapper">
                    <button
                      type="button"
                      className={`toggle ${form.active ? "active" : ""}`}
                      onClick={() => setForm({ ...form, active: !form.active })}
                    />
                    <span>{form.active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave}>
                  {editId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
