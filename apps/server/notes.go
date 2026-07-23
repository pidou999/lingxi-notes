package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Note struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	HTML      string `json:"html"`
	JSON      string `json:"json"`
	Tags      string `json:"tags"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func listNotesHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)
		rows, err := db.QueryContext(r.Context(),
			"SELECT id, title, html, json, tags, created_at, updated_at FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC",
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
				log.Printf("listNotes scan error: %v", err)
				continue
			}
			notes = append(notes, n)
		}
		writeJSON(w, 200, notes)
	}
}

func createNoteHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var body struct {
			ID    string `json:"id"`
			Title string `json:"title"`
			HTML  string `json:"html"`
			JSON  string `json:"json"`
			Tags  string `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}
		if len(body.Title) > 500 {
			http.Error(w, `{"error":"标题长度不能超过500字符"}`, 400)
			return
		}
		if len(body.HTML) > 1000000 {
			http.Error(w, `{"error":"内容长度不能超过1MB"}`, 400)
			return
		}
		if body.JSON == "" {
			body.JSON = "{}"
		}
		if body.Tags == "" {
			body.Tags = "[]"
		}

		id := body.ID
		if id == "" {
			id = newID()
		}
		now := now()
		_, err := db.ExecContext(r.Context(),
			"INSERT INTO notes (id, user_id, title, html, json, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			id, userID(r), body.Title, body.HTML, body.JSON, body.Tags, now, now)
		if err != nil {
			http.Error(w, `{"error":"创建失败"}`, 500)
			return
		}

		writeJSON(w, 201, Note{
			ID:        id,
			Title:     body.Title,
			HTML:      body.HTML,
			JSON:      body.JSON,
			Tags:      body.Tags,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
}

func getNoteHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var n Note
		err := db.QueryRowContext(r.Context(),
			"SELECT id, title, html, json, tags, created_at, updated_at FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
			id, userID(r),
		).Scan(&n.ID, &n.Title, &n.HTML, &n.JSON, &n.Tags, &n.CreatedAt, &n.UpdatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"笔记不存在"}`, 404)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"查询失败"}`, 500)
			return
		}
		writeJSON(w, 200, n)
	}
}

func updateNoteHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		id := chi.URLParam(r, "id")
		var body struct {
			Title *string `json:"title"`
			HTML  *string `json:"html"`
			JSON  *string `json:"json"`
			Tags  *string `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"请求格式错误"}`, 400)
			return
		}
		if body.Title != nil && len(*body.Title) > 500 {
			http.Error(w, `{"error":"标题长度不能超过500字符"}`, 400)
			return
		}
		if body.HTML != nil && len(*body.HTML) > 1000000 {
			http.Error(w, `{"error":"内容长度不能超过1MB"}`, 400)
			return
		}

		// 读取当前值
		var cur Note
		err := db.QueryRowContext(r.Context(),
			"SELECT id, title, html, json, tags FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
			id, userID(r),
		).Scan(&cur.ID, &cur.Title, &cur.HTML, &cur.JSON, &cur.Tags)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"笔记不存在"}`, 404)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"查询失败"}`, 500)
			return
		}

		title := cur.Title
		html := cur.HTML
		jsonStr := cur.JSON
		tags := cur.Tags
		if body.Title != nil {
			title = *body.Title
		}
		if body.HTML != nil {
			html = *body.HTML
		}
		if body.JSON != nil {
			jsonStr = *body.JSON
		}
		if body.Tags != nil {
			tags = *body.Tags
		}

		_, err = db.ExecContext(r.Context(),
			"UPDATE notes SET title=?, html=?, json=?, tags=?, updated_at=? WHERE id=? AND user_id=?",
			title, html, jsonStr, tags, now(), id, userID(r))
		if err != nil {
			http.Error(w, `{"error":"更新失败"}`, 500)
			return
		}

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

func deleteNoteHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		// 软删除：设置 deleted_at
		res, err := db.ExecContext(r.Context(), "UPDATE notes SET deleted_at=? WHERE id=? AND user_id=?", now(), id, userID(r))
		if err != nil {
			http.Error(w, `{"error":"删除失败"}`, 500)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, `{"error":"笔记不存在"}`, 404)
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}
