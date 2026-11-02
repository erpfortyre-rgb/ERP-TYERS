import { useState } from "react";
import { FiInfo } from "react-icons/fi";
import DataTable from "../components/DataTable";
import { mockProducts } from "../mockData";
import type { Product } from "../types";

export default function ProductsPage() {
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = [...new Set(mockProducts.map((p) => p.category))];

  const filtered = categoryFilter
    ? mockProducts.filter((p) => p.category === categoryFilter)
    : mockProducts;

  const columns = [
    { key: "name", header: "Product Name" },
    {
      key: "category",
      header: "Category",
      render: (row: Product) => <span className="badge badge-blue">{row.category}</span>,
    },
    { key: "brand", header: "Brand" },
    { key: "hsnCode", header: "HSN" },
    {
      key: "mrp",
      header: "MRP",
      render: (row: Product) => `Rs ${row.mrp.toLocaleString("en-IN")}`,
    },
    {
      key: "sellingPrice",
      header: "Selling Price",
      render: (row: Product) => `Rs ${row.sellingPrice.toLocaleString("en-IN")}`,
    },
    {
      key: "stock",
      header: "Stock",
      render: (row: Product) => (
        <span className={`badge ${row.stock > 20 ? "badge-success" : row.stock > 5 ? "badge-warning" : "badge-error"}`}>
          {row.stock} {row.unit}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Products</h2>
          <div className="breadcrumb"><a href="/">Home</a> / Products</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
          <FiInfo /> Read-only view (synced from desktop POS)
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>Category:</label>
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            searchPlaceholder="Search products..."
            searchKeys={["name", "brand", "company", "hsnCode"]}
          />
        </div>
      </div>
    </>
  );
}
