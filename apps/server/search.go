package main

import (
	"log"
	"net/http"
	"strings"
)

func searchHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)
		q := r.URL.Query().Get("q")
		if q == "" {
			writeJSON(w, 200, []Note{})
			return
		}

		// 转义 LIKE 通配符，防止用户通过 % _ \ 操纵查询或匹配异常
		escaped := strings.NewReplacer("%", "\\%", "_", "\\_", "\\", "\\\\").Replace(q)
		pattern := "%" + escaped + "%"
		rows, err := db.QueryContext(r.Context(),
			"SELECT id, title, html, json, tags, created_at, updated_at FROM notes WHERE user_id = ? AND deleted_at IS NULL AND (title LIKE ? ESCAPE '\\' OR html LIKE ? ESCAPE '\\') ORDER BY updated_at DESC",
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
				log.Printf("search scan error: %v", err)
				continue
			}
			notes = append(notes, n)
		}

		writeJSON(w, 200, notes)
	}
}
