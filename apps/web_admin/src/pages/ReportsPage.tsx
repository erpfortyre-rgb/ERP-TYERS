import {
  FiDollarSign,
  FiShoppingCart,
  FiFileText,
  FiAlertCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";

const reports = [
  {
    icon: <FiDollarSign />,
    title: "Sales Report",
    description: "View daily, weekly, and monthly sales across all stores. Includes item-wise and category-wise breakdowns.",
  },
  {
    icon: <FiShoppingCart />,
    title: "Purchase Report",
    description: "Track all purchases from suppliers. Filter by vendor, date range, and product category.",
  },
  {
    icon: <FiFileText />,
    title: "GST Report",
    description: "GSTR-1 and GSTR-3B reports for all stores. Includes HSN-wise summary and tax breakdowns.",
  },
  {
    icon: <FiAlertCircle />,
    title: "Outstanding Report",
    description: "View pending payments from customers and to suppliers. Age-wise analysis available.",
  },
];

export default function ReportsPage() {
  function handleClick(title: string) {
    toast("Report module will be connected to the backend API", { icon: "📊" });
    console.log("Open report:", title);
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Reports</h2>
          <div className="breadcrumb"><a href="/">Home</a> / Reports</div>
        </div>
      </div>

      <div className="reports-grid">
        {reports.map((r) => (
          <div className="report-card" key={r.title} onClick={() => handleClick(r.title)}>
            <div className="report-card-icon">{r.icon}</div>
            <div className="report-card-info">
              <h3>{r.title}</h3>
              <p>{r.description}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
