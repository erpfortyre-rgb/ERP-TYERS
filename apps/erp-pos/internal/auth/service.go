package auth

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
)

type Service struct {
	db *sql.DB
}

type UserInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	RoleName    string `json:"roleName"`
	Permissions string `json:"permissions"`
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// LoginByPIN authenticates a user by 4-digit PIN (for counter staff).
func (s *Service) LoginByPIN(pin string) (*UserInfo, error) {
	hash := HashPIN(pin)
	var u UserInfo
	err := s.db.QueryRow(`
		SELECT u.id, u.name, COALESCE(u.email,''), COALESCE(r.name,'') as role_name, COALESCE(r.permissions,'{}') as permissions
		FROM users u
		LEFT JOIN roles r ON u.role_id = r.id
		WHERE u.pin_hash = ? AND u.is_active = 1
	`, hash).Scan(&u.ID, &u.Name, &u.Email, &u.RoleName, &u.Permissions)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invalid PIN")
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// LoginByPassword authenticates a user by email and password (for owner/admin).
func (s *Service) LoginByPassword(email, password string) (*UserInfo, error) {
	hash := HashPassword(password)
	var u UserInfo
	err := s.db.QueryRow(`
		SELECT u.id, u.name, COALESCE(u.email,''), COALESCE(r.name,'') as role_name, COALESCE(r.permissions,'{}') as permissions
		FROM users u
		LEFT JOIN roles r ON u.role_id = r.id
		WHERE u.email = ? AND u.password_hash = ? AND u.is_active = 1
	`, email, hash).Scan(&u.ID, &u.Name, &u.Email, &u.RoleName, &u.Permissions)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invalid email or password")
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// GetCurrentUser returns user info for session validation on app startup.
func (s *Service) GetCurrentUser(userID string) (*UserInfo, error) {
	var u UserInfo
	err := s.db.QueryRow(`
		SELECT u.id, u.name, COALESCE(u.email,''), COALESCE(r.name,'') as role_name, COALESCE(r.permissions,'{}') as permissions
		FROM users u
		LEFT JOIN roles r ON u.role_id = r.id
		WHERE u.id = ? AND u.is_active = 1
	`, userID).Scan(&u.ID, &u.Name, &u.Email, &u.RoleName, &u.Permissions)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ListUsers returns all users for admin display.
func (s *Service) ListUsers() ([]UserInfo, error) {
	rows, err := s.db.Query(`
		SELECT u.id, u.name, COALESCE(r.name,'') as role_name, COALESCE(r.permissions,'{}')
		FROM users u
		LEFT JOIN roles r ON u.role_id = r.id
		WHERE u.tenant_id = COALESCE((SELECT value FROM settings WHERE key='active_tenant_id'), (SELECT id FROM tenants LIMIT 1))
		ORDER BY u.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []UserInfo
	for rows.Next() {
		var u UserInfo
		if err := rows.Scan(&u.ID, &u.Name, &u.RoleName, &u.Permissions); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// HashPIN hashes a 4-digit PIN for storage/comparison.
func HashPIN(pin string) string {
	h := sha256.Sum256([]byte("sst-pin:" + pin))
	return hex.EncodeToString(h[:])
}

// HashPassword hashes a password for storage/comparison.
func HashPassword(pw string) string {
	h := sha256.Sum256([]byte("sst-pw:" + pw))
	return hex.EncodeToString(h[:])
}
