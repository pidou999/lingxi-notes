package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// jwtSecret MUST be provided via JWT_SECRET. A random fallback would make
// tokens invalid after every restart and inconsistent across instances, so we
// fail fast at startup if it is missing or too short.
var jwtSecret = func() []byte {
	v := os.Getenv("JWT_SECRET")
	if len(v) < 16 {
		log.Fatalf("JWT_SECRET 未配置或长度不足（需 >= 16 字节）。请在环境变量中设置强随机密钥，例如：openssl rand -hex 32")
	}
	return []byte(v)
}()

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// ─── 注册 ────────────────────────────

func registerHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
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
		_, err = db.ExecContext(r.Context(), "INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
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
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}

		var id, hash string
		err := db.QueryRowContext(r.Context(), "SELECT id, password_hash FROM users WHERE username = ?",
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

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"令牌无效"}`, 401)
			return
		}
		userID, ok := claims["sub"].(string)
		if !ok {
			http.Error(w, `{"error":"令牌无效"}`, 401)
			return
		}
		r.Header.Set("X-User-ID", userID)
		next.ServeHTTP(w, r)
	})
}

// ─── 辅助 ────────────────────────────

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand 实际不会失败；极端情况下退化为时间派生，避免空 ID
		log.Printf("newID rand read error: %v", err)
		return hex.EncodeToString([]byte(time.Now().Format("20060102150405.000000000")))
	}
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

// cryptoKey encrypts stored provider API keys. It MUST be stable across
// restarts (otherwise previously encrypted keys can never be decrypted), so a
// missing or malformed CRYPTO_KEY is a fatal startup error — no silent
// fallback to a random key.
var cryptoKey = func() []byte {
	v := os.Getenv("CRYPTO_KEY")
	if v == "" {
		log.Fatalf("CRYPTO_KEY 未配置。请设置 32 字节（64 个十六进制字符）密钥，例如：openssl rand -hex 32。缺失会导致已加密的 API Key 无法解密。")
	}
	key, err := hex.DecodeString(v)
	if err != nil || len(key) != 32 {
		log.Fatalf("CRYPTO_KEY 格式错误：必须是 64 个十六进制字符（32 字节）。当前值：%s", v)
	}
	return key
}()

func encryptAPIKey(key string) (string, error) {
	block, err := aes.NewCipher(cryptoKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(key), nil)
	return hex.EncodeToString(ciphertext), nil
}

func decryptAPIKey(encrypted string) (string, error) {
	data, err := hex.DecodeString(encrypted)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(cryptoKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", err
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
