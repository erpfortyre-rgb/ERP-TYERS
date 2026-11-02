import type { User, Store, Device, Product, SyncRecord, CompanySettings } from "./types";

export const mockStores: Store[] = [
  {
    id: "s1",
    name: "Shiv Shankar Tyres - Main Store",
    code: "SST",
    address: "Mancherial, Telangana",
    phone: "+91 7877288109",
    gstin: "",
    active: true,
    createdAt: "2026-10-26",
  },
];

export const mockUsers: User[] = [
  {
    id: "user-owner",
    name: "Nilesh",
    email: "owner@sst.local",
    role: "Owner",
    storeId: "s1",
    storeName: "Main Store",
    active: true,
    createdAt: "2026-10-26",
  },
];

export const mockDevices: Device[] = [
  {
    id: "d1",
    name: "Counter 1",
    storeId: "s1",
    storeName: "Main Store",
    invoicePrefix: "SST-1",
    macAddress: "",
    lastSeen: "2026-10-28T10:30:00",
    active: true,
  },
];

export const mockProducts: Product[] = [];

export const mockSyncRecords: SyncRecord[] = [
  {
    id: "sr1",
    deviceId: "d1",
    deviceName: "Counter 1",
    storeName: "Main Store",
    lastSync: "",
    pendingItems: 0,
    status: "pending",
  },
];

export const mockCompanySettings: CompanySettings = {
  name: "Shiv Shankar Tyres",
  gstin: "",
  address: "Mancherial, Telangana",
  phone: "+91 7877288109",
  email: "",
  logoUrl: "",
};

export const dashboardStats = {
  totalSales: 0,
  totalUsers: 1,
  activeDevices: 1,
  pendingSyncs: 0,
  monthlySales: [] as { month: string; amount: number }[],
  topProducts: [] as { name: string; sold: number }[],
  storeWiseSales: [
    { store: "Main Store", amount: 0 },
  ],
};
