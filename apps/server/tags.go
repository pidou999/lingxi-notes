package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func listTagsHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)

		// 查询当前用户所有笔记的 tags 字段
		rows, err := db.Query("SELECT tags FROM notes WHERE user_id = ?", uid)
		if err != nil {
			http.Error(w, `{"error":"查询失败"}`, 500)
			return
		}
		defer rows.Close()

		// 聚合：tag → 出现次数
		counts := make(map[string]int)
		for rows.Next() {
			var raw string
			if err := rows.Scan(&raw); err != nil {
				continue
			}
			var tags []string
			if err := json.Unmarshal([]byte(raw), &tags); err != nil {
				continue
			}
			for _, t := range tags {
				counts[t]++
			}
		}

		// 转成数组
		type TagItem struct {
			Name  string `json:"name"`
			Count int    `json:"count"`
		}
		result := make([]TagItem, 0, len(counts))
		for name, count := range counts {
			result = append(result, TagItem{Name: name, Count: count})
		}

		writeJSON(w, 200, result)
	}
}

func listNotesByTagHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tag := chi.URLParam(r, "tag")
		uid := userID(r)

		rows, err := db.Query(
			"SELECT id, title, html, json, tags, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC",
			uid)
		if err != nil {
			http.Error(w, `{"error":"查询失败"}`, 500)
			return
		}
		defer rows.Close()

		notes := []Note{}
		for rows.Next() {
			var n Note
			if err := rows.Scan(&n.ID, &n.Title, &n.HTML, &n.JSON, &n.Tags, &n.CreatedAt, &n.UpdatedAt); err != nil {
				continue
			}
			// 过滤包含指定标签的笔记
			var tags []string
			if err := json.Unmarshal([]byte(n.Tags), &tags); err != nil {
				continue
			}
			for _, t := range tags {
				if t == tag {
					notes = append(notes, n)
					break
				}
			}
		}

		writeJSON(w, 200, notes)
	}
}
