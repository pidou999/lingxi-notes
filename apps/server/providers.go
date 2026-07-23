package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Provider struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Name     string `json:"name"`
	BaseURL  string `json:"baseUrl"`
	APIKey   string `json:"apiKey"`
	Protocol string `json:"protocol"`
	Models   string `json:"models"`
}

func listProvidersHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)
		rows, err := db.QueryContext(r.Context(),
			"SELECT id, type, name, base_url, api_key, protocol, models FROM providers WHERE user_id = ? ORDER BY created_at",
			uid)
		if err != nil {
			http.Error(w, `{"error":"查询失败"}`, 500)
			return
		}
		defer rows.Close()

		list := []Provider{}
		for rows.Next() {
			var p Provider
			var encryptedKey string
			if err := rows.Scan(&p.ID, &p.Type, &p.Name, &p.BaseURL, &encryptedKey, &p.Protocol, &p.Models); err != nil {
				log.Printf("listProviders scan error: %v", err)
				continue
			}
			// 解密失败返回空字符串，绝不回退返回加密数据（避免泄漏内部结构）
			key, derr := decryptAPIKey(encryptedKey)
			if derr != nil {
				log.Printf("provider %s 密钥解密失败: %v", p.ID, derr)
				key = ""
			}
			p.APIKey = key
			list = append(list, p)
		}
		writeJSON(w, 200, list)
	}
}

func createProviderHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var p Provider
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}
		if p.Models == "" {
			p.Models = "[]"
		}
		if p.Protocol == "" {
			p.Protocol = "OpenAI"
		}

		encryptedKey, err := encryptAPIKey(p.APIKey)
		if err != nil {
			http.Error(w, `{"error":"创建失败"}`, 500)
			return
		}

		id := newID()
		_, err = db.ExecContext(r.Context(),
			"INSERT INTO providers (id, user_id, type, name, base_url, api_key, protocol, models) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			id, userID(r), p.Type, p.Name, p.BaseURL, encryptedKey, p.Protocol, p.Models)
		if err != nil {
			http.Error(w, `{"error":"创建失败"}`, 500)
			return
		}

		p.ID = id
		writeJSON(w, 201, p)
	}
}

func updateProviderHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		id := chi.URLParam(r, "id")
		var p Provider
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}

		var exists string
		var currentKey string
		err := db.QueryRowContext(r.Context(), "SELECT id, api_key FROM providers WHERE id = ? AND user_id = ?", id, userID(r)).Scan(&exists, &currentKey)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"服务商不存在"}`, 404)
			return
		}

		var encryptedKey string
		if p.APIKey != "" {
			encryptedKey, err = encryptAPIKey(p.APIKey)
			if err != nil {
				http.Error(w, `{"error":"更新失败"}`, 500)
				return
			}
		} else {
			encryptedKey = currentKey
		}

		_, err = db.ExecContext(r.Context(),
			"UPDATE providers SET type=?, name=?, base_url=?, api_key=?, protocol=?, models=? WHERE id=? AND user_id=?",
			p.Type, p.Name, p.BaseURL, encryptedKey, p.Protocol, p.Models, id, userID(r))
		if err != nil {
			http.Error(w, `{"error":"更新失败"}`, 500)
			return
		}

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

func deleteProviderHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		res, err := db.ExecContext(r.Context(), "DELETE FROM providers WHERE id = ? AND user_id = ?", id, userID(r))
		if err != nil {
			http.Error(w, `{"error":"删除失败"}`, 500)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, `{"error":"服务商不存在"}`, 404)
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}
