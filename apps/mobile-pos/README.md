# Shiv Shankar Tyres — Mobile POS (Flutter)

Android/web POS client for the tyre-shop ERP. It talks to the **cloud API server**
(`../erp-pos/cmd/apiserver`) — same Go business logic as the desktop app.

## What's built (foundation)
- **Login** — enter the server URL + email/password → gets an auth token (stored on device).
- **POS** — search products, tap to add to cart, adjust quantity, and finalize a **Cash Sale**
  which creates a real invoice through the cloud API (`FinalizeSale` engine).

## Run it
1. Start the backend (from `apps/erp-pos`):
   ```
   SST_DB_PATH="%APPDATA%/ShivShankarTyres/pos.db" SST_ADDR=":8099" go run ./cmd/apiserver
   ```
2. Run the app:
   ```
   cd apps/mobile-pos
   flutter run            # pick a device/emulator, or -d chrome for web
   ```
3. On the login screen set the **Server URL**:
   - Android emulator → `http://10.0.2.2:8099` (reaches the host machine) — this is the default.
   - Real phone on the same WiFi → `http://<PC-LAN-IP>:8099`.
   - Cloud → `https://your-api-domain`.
   - Default login: `owner@sst.local` / `admin`.

## Build an APK
```
flutter build apk --release      # output in build/app/outputs/flutter-apk/
```

## Next
- More screens (customers, invoices list, dashboard) against the same API.
- Barcode scanner, offline cache + sync, printing.
- Point the app at the deployed cloud server instead of the LAN IP.
