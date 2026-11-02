import { useState } from "react";
import { FiSearch } from "react-icons/fi";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
}

export default function DataTable<T extends object>({
  columns,
  data,
  searchPlaceholder = "Search...",
  searchKeys,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? data.filter((row) => {
        const term = search.toLowerCase();
        const rec = row as Record<string, unknown>;
        if (searchKeys) {
          return searchKeys.some((key) =>
            String(rec[key as string]).toLowerCase().includes(term),
          );
        }
        return Object.values(rec).some((val) =>
          String(val).toLowerCase().includes(term),
        );
      })
    : data;

  return (
    <>
      <div className="table-toolbar">
        <div className="search-input">
          <FiSearch />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {filtered.length} of {data.length} records
        </span>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: 32, color: "var(--color-text-secondary)" }}
                >
                  No records found
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
