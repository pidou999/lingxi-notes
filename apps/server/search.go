package main

import (
	"net/http"
)

func searchHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)
		q := r.URL.Query().Get("q")
		if q == "" {
			writeJSON(w, 200, []Note{})
			return
		}

		// LIKE 搜索标题和内容，按更新时间倒序
		pattern := "%" + q + "%"
		rows, err := db.Query(
			"SELECT id, title, html, json, tags, created_at, updated_at FROM notes WHERE user_id = ? AND deleted_at IS NULL AND (title LIKE ? OR html LIKE ?) ORDER BY updated_at DESC",
			uid, pattern, pattern)
		if err != nil {
			http.Error(w, `{"error":"搜索失败"}`, 500)
			return
		}
		defer rows.Close()

		notes := []Note{}
		for rows.Next() {
			var n Note
			if err := rows.Scan(&n.ID, &n.Title, &n.HTML, &n.JSON, &n.Tags, &n.CreatedAt, &n.UpdatedAt); err != nil {
				continue
			}
			notes = append(notes, n)
		}

		writeJSON(w, 200, notes)
	}
}
