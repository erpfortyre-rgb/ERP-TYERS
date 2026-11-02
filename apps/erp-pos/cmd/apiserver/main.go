// Command apiserver is the cloud backend for the Shiv Shankar Tyres ERP.
//
// It reuses the SAME business logic (internal/...) as the Wails desktop app but
// serves it over a JSON/HTTP API, so the Flutter Android POS and the React web
// admin can connect to one shared backend. It does NOT import Wails, so it
// cross-compiles to Linux for a cloud VPS:
//
//	GOOS=linux GOARCH=amd64 go build -o apiserver ./cmd/apiserver
//
// Config via env:
//	SST_DB_PATH   path to the SQLite database (default ./data/pos.db)
//	SST_ADDR      listen address (default :8080)
//	SST_SECRET    HMAC secret for auth tokens (set a strong value in production)
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"erp-pos/internal/auth"
	"erp-pos/internal/billing"
	"erp-pos/internal/database"
	"erp-pos/internal/models"
)

type server struct {
	auth   *auth.Service
	engine *billing.Engine
	secret []byte
}

func main() {
	dbPath := env("SST_DB_PATH", filepath.Join("data", "pos.db"))
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		log.Fatalf("create data dir: %v", err)
	}
	db, err := database.Open(dbPath) // opens SQLite (WAL) + runs migrations
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	s := &server{
		auth:   auth.NewService(db),
		engine: billing.NewEngine(db),
		secret: []byte(env("SST_SECRET", "dev-insecure-secret-change-me")),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/healthz", s.healthz)
	mux.HandleFunc("/api/login", s.login)
	mux.HandleFunc("/api/products", s.requireAuth(s.products))
	mux.HandleFunc("/api/product/barcode", s.requireAuth(s.productByBarcode))
	mux.HandleFunc("/api/dashboard", s.requireAuth(s.dashboard))
	mux.HandleFunc("/api/invoices", s.requireAuth(s.invoices))
	mux.HandleFunc("/api/sales", s.requireAuth(s.createSale))
	mux.HandleFunc("/api/me", s.requireAuth(s.me))

	addr := env("SST_ADDR", ":8080")
	log.Printf("Shiv Shankar Tyres API server listening on %s (db=%s)", addr, dbPath)
	log.Fatal(http.ListenAndServe(addr, cors(mux)))
}

// ─── helpers ────────────────────────────────────────────────────────────────

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

// cors allows the Flutter/web clients to call the API from any origin and
// answers preflight (OPTIONS) requests.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ─── auth tokens (stdlib HMAC, no external deps) ─────────────────────────────
// Token format: "<userID>|<expUnix>.<hex hmac>"

func (s *server) sign(payload string) string {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(payload))
	return hex.EncodeToString(m.Sum(nil))
}

func (s *server) makeToken(userID string) string {
	payload := fmt.Sprintf("%s|%d", userID, time.Now().Add(12*time.Hour).Unix())
	return payload + "." + s.sign(payload)
}

// verifyToken returns the userID when the token is valid and unexpired.
func (s *server) verifyToken(tok string) (string, bool) {
	i := strings.LastIndex(tok, ".")
	if i < 0 {
		return "", false
	}
	payload, sig := tok[:i], tok[i+1:]
	if !hmac.Equal([]byte(sig), []byte(s.sign(payload))) {
		return "", false
	}
	parts := strings.SplitN(payload, "|", 2)
	if len(parts) != 2 {
		return "", false
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return "", false
	}
	return parts[0], true
}

// auth wraps a handler, requiring a valid Bearer token.
func (s *server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		tok := strings.TrimPrefix(h, "Bearer ")
		if tok == h || tok == "" {
			writeErr(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		uid, ok := s.verifyToken(tok)
		if !ok {
			writeErr(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		r.Header.Set("X-User-ID", uid)
		next(w, r)
	}
}

// ─── handlers ────────────────────────────────────────────────────────────────

func (s *server) healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "shiv-shankar-tyres-api", "time": time.Now().UTC()})
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "use POST")
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		PIN      string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	var user *auth.UserInfo
	var err error
	if body.PIN != "" {
		user, err = s.auth.LoginByPIN(body.PIN)
	} else {
		user, err = s.auth.LoginByPassword(body.Email, body.Password)
	}
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": s.makeToken(user.ID), "user": user})
}

func (s *server) me(w http.ResponseWriter, r *http.Request) {
	u, err := s.auth.GetCurrentUser(r.Header.Get("X-User-ID"))
	if err != nil {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *server) products(w http.ResponseWriter, r *http.Request) {
	list, err := s.engine.SearchProducts(r.URL.Query().Get("q"), 100)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *server) productByBarcode(w http.ResponseWriter, r *http.Request) {
	p, err := s.engine.FindByBarcode(r.URL.Query().Get("code"))
	if err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *server) dashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := s.engine.GetDashboardStats()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *server) invoices(w http.ResponseWriter, r *http.Request) {
	list, err := s.engine.GetInvoices(100)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *server) createSale(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "use POST")
		return
	}
	var draft models.SaleDraft
	if err := json.NewDecoder(r.Body).Decode(&draft); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	inv, err := s.engine.FinalizeSale(draft)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, inv)
}
