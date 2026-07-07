package main

import (
	"database/sql"
	"encoding/json"
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
		rows, err := db.Query(
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
			if err := rows.Scan(&p.ID, &p.Type, &p.Name, &p.BaseURL, &p.APIKey, &p.Protocol, &p.Models); err != nil {
				continue
			}
			list = append(list, p)
		}
		writeJSON(w, 200, list)
	}
}

func createProviderHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		id := newID()
		_, err := db.Exec(
			"INSERT INTO providers (id, user_id, type, name, base_url, api_key, protocol, models) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			id, userID(r), p.Type, p.Name, p.BaseURL, p.APIKey, p.Protocol, p.Models)
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
		id := chi.URLParam(r, "id")
		var p Provider
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}

		// 确认存在
		var exists string
		err := db.QueryRow("SELECT id FROM providers WHERE id = ? AND user_id = ?", id, userID(r)).Scan(&exists)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"服务商不存在"}`, 404)
			return
		}

		_, err = db.Exec(
			"UPDATE providers SET type=?, name=?, base_url=?, api_key=?, protocol=?, models=? WHERE id=? AND user_id=?",
			p.Type, p.Name, p.BaseURL, p.APIKey, p.Protocol, p.Models, id, userID(r))
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
		res, err := db.Exec("DELETE FROM providers WHERE id = ? AND user_id = ?", id, userID(r))
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
