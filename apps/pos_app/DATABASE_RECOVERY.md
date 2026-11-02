 # Local database and recovery

The application stores its SQLCipher database in the platform application
support directory under `data/pos_app.sqlite3`. The 256-bit database key is
generated on first launch and kept in the operating system secure storage
(Windows secure storage or Android Keystore-backed storage). The key is never
written into the project, database, diagnostics, or logs.

The encrypted database and its key are a pair. Copying only the database file
to a new machine or user profile will not make it readable. If secure storage
is cleared, the application refuses to create a replacement key for an
existing database, so it will not silently overwrite or initialize that data.
Recovery requires a separately protected backup that preserves the database
and its key together. This phase does not implement backup export or key
migration; retain the original device/profile until an approved recovery
process is available.

The database uses versioned migrations and verifies the SQLCipher runtime at
startup. A wrong key or corrupt database prevents startup of local data access;
the app does not retry with plaintext SQLite.
