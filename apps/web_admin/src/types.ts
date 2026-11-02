export interface User {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Manager" | "Cashier";
  storeId: string;
  storeName: string;
  active: boolean;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  gstin: string;
  active: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  invoicePrefix: string;
  macAddress: string;
  lastSeen: string;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  company: string;
  hsnCode: string;
  mrp: number;
  sellingPrice: number;
  stock: number;
  unit: string;
}

export interface SyncRecord {
  id: string;
  deviceId: string;
  deviceName: string;
  storeName: string;
  lastSync: string;
  pendingItems: number;
  status: "synced" | "pending" | "error";
}

export interface CompanySettings {
  name: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
}
