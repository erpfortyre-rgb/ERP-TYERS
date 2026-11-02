import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  FiGrid,
  FiUsers,
  FiHome,
  FiMonitor,
  FiPackage,
  FiBarChart2,
  FiRefreshCw,
  FiSettings,
  FiBell,
  FiLogOut,
  FiMenu,
  FiX,
} from "react-icons/fi";

const navItems = [
  { to: "/", icon: <FiGrid />, label: "Dashboard" },
  { to: "/users", icon: <FiUsers />, label: "Users" },
  { to: "/stores", icon: <FiHome />, label: "Stores" },
  { to: "/devices", icon: <FiMonitor />, label: "Devices" },
  { to: "/products", icon: <FiPackage />, label: "Products" },
  { to: "/reports", icon: <FiBarChart2 />, label: "Reports" },
  { to: "/sync", icon: <FiRefreshCw />, label: "Sync Monitor" },
  { to: "/settings", icon: <FiSettings />, label: "Settings" },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <h1>Shiv Shankar Tyres</h1>
          <span>Admin Panel</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-wrapper">
        <header className="header">
          <div className="header-left">
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
          <div className="header-right">
            <button className="header-icon-btn" aria-label="Notifications">
              <FiBell />
            </button>
            <div className="header-user">
              <div className="header-user-avatar">NC</div>
              <span>Nilesh (Owner)</span>
            </div>
            <button className="header-icon-btn" aria-label="Logout">
              <FiLogOut />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
