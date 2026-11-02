import {
  FiDollarSign,
  FiUsers,
  FiMonitor,
  FiRefreshCw,
  FiBarChart2,
} from "react-icons/fi";
import { dashboardStats } from "../mockData";

function formatCurrency(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

export default function Dashboard() {
  const maxSale = Math.max(1, ...dashboardStats.monthlySales.map((m) => m.amount));

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Dashboard</h2>
          <div className="breadcrumb">Home</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue"><FiDollarSign /></div>
          <div className="stat-card-info">
            <h3>{formatCurrency(dashboardStats.totalSales)}</h3>
            <p>Total Sales (This Month)</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><FiUsers /></div>
          <div className="stat-card-info">
            <h3>{dashboardStats.totalUsers}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon orange"><FiMonitor /></div>
          <div className="stat-card-info">
            <h3>{dashboardStats.activeDevices}</h3>
            <p>Active Devices</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon red"><FiRefreshCw /></div>
          <div className="stat-card-info">
            <h3>{dashboardStats.pendingSyncs}</h3>
            <p>Pending Syncs</p>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <span>Monthly Sales</span>
            <FiBarChart2 style={{ color: "var(--color-text-secondary)" }} />
          </div>
          <div className="card-body">
            <div className="simple-bar-chart">
              {dashboardStats.monthlySales.map((m) => (
                <div className="bar-item" key={m.month}>
                  <div className="bar-value">{formatCurrency(m.amount)}</div>
                  <div
                    className="bar"
                    style={{ height: `${(m.amount / maxSale) * 100}%` }}
                  />
                  <div className="bar-label">{m.month}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Top Selling Products</div>
          <div className="card-body">
            <ul className="top-list">
              {dashboardStats.topProducts.map((p, i) => (
                <li key={p.name}>
                  <span className="rank">{i + 1}</span>
                  <span className="item-name">{p.name}</span>
                  <span className="item-value">{p.sold} sold</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Store-wise Sales</div>
        <div className="card-body">
          <div className="simple-bar-chart" style={{ height: 120 }}>
            {dashboardStats.storeWiseSales.map((s) => (
              <div className="bar-item" key={s.store}>
                <div className="bar-value">{formatCurrency(s.amount)}</div>
                <div
                  className="bar"
                  style={{
                    height: `${(s.amount / Math.max(1, ...dashboardStats.storeWiseSales.map((x) => x.amount))) * 100}%`,
                    background: s.store === "Main Branch" ? "var(--color-accent)" : "var(--color-success)",
                  }}
                />
                <div className="bar-label">{s.store}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
