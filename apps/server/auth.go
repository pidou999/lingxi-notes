package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = func() []byte {
	b := make([]byte, 32)
	rand.Read(b)
	return b
}()

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// ─── 注册 ────────────────────────────

func registerHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}
		if len(body.Username) < 2 || len(body.Password) < 4 {
			http.Error(w, `{"error":"用户名至少2位，密码至少4位"}`, 400)
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, `{"error":"注册失败"}`, 500)
			return
		}

		id := newID()
		_, err = db.Exec("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
			id, body.Username, string(hash))
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				http.Error(w, `{"error":"用户名已存在"}`, 409)
				return
			}
			http.Error(w, `{"error":"注册失败"}`, 500)
			return
		}

		token, _ := generateToken(id)
		writeJSON(w, 201, map[string]any{
			"token": token,
			"user":  User{ID: id, Username: body.Username},
		})
	}
}

// ─── 登录 ────────────────────────────

func loginHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}

		var id, hash string
		err := db.QueryRow("SELECT id, password_hash FROM users WHERE username = ?",
			body.Username).Scan(&id, &hash)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"用户名或密码错误"}`, 401)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"登录失败"}`, 500)
			return
		}

		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
			http.Error(w, `{"error":"用户名或密码错误"}`, 401)
			return
		}

		token, _ := generateToken(id)
		writeJSON(w, 200, map[string]any{
			"token": token,
			"user":  User{ID: id, Username: body.Username},
		})
	}
}

// ─── JWT ─────────────────────────────

func generateToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ─── 认证中间件 ─────────────────────

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"未认证"}`, 401)
			return
		}
		tokenStr := strings.TrimPrefix(auth, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			http.Error(w, `{"error":"令牌无效"}`, 401)
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		userID := claims["sub"].(string)
		r.Header.Set("X-User-ID", userID)
		next.ServeHTTP(w, r)
	})
}

// ─── 辅助 ────────────────────────────

func newID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func userID(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}
