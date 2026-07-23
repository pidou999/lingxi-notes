package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func listTagsHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)

		// 查询当前用户所有未删除笔记的 tags 字段
		rows, err := db.QueryContext(r.Context(), "SELECT tags FROM notes WHERE user_id = ? AND deleted_at IS NULL", uid)
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
				log.Printf("listTags scan error: %v", err)
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

		rows, err := db.QueryContext(r.Context(),
			`SELECT n.id, n.title, n.html, n.json, n.tags, n.created_at, n.updated_at 
			 FROM notes n 
			 JOIN json_each(n.tags) j ON j.value = ? 
			 WHERE n.user_id = ? AND n.deleted_at IS NULL 
			 ORDER BY n.updated_at DESC`,
			tag, uid)
		if err != nil {
			http.Error(w, `{"error":"查询失败"}`, 500)
			return
		}
		defer rows.Close()

		notes := []Note{}
		seen := make(map[string]bool)
		for rows.Next() {
			var n Note
			if err := rows.Scan(&n.ID, &n.Title, &n.HTML, &n.JSON, &n.Tags, &n.CreatedAt, &n.UpdatedAt); err != nil {
				log.Printf("listNotesByTag scan error: %v", err)
				continue
			}
			if !seen[n.ID] {
				seen[n.ID] = true
				notes = append(notes, n)
			}
		}

		writeJSON(w, 200, notes)
	}
}
