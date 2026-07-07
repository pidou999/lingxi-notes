package main

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// listTrashHandler — 列出已删除（回收站）笔记
func listTrashHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)
		rows, err := db.Query(
			"SELECT id, title, html, json, tags, created_at, updated_at, deleted_at FROM notes WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
			uid)
		if err != nil {
			http.Error(w, `{"error":"查询失败"}`, 500)
			return
		}
		defer rows.Close()

		type TrashNote struct {
			Note
			DeletedAt string `json:"deletedAt"`
		}

		notes := []TrashNote{}
		for rows.Next() {
			var n Note
			var deletedAt *string
			if err := rows.Scan(&n.ID, &n.Title, &n.HTML, &n.JSON, &n.Tags, &n.CreatedAt, &n.UpdatedAt, &deletedAt); err != nil {
				continue
			}
			d := ""
			if deletedAt != nil {
				d = *deletedAt
			}
			notes = append(notes, TrashNote{Note: n, DeletedAt: d})
		}
		writeJSON(w, 200, notes)
	}
}

// restoreNoteHandler — 恢复笔记
func restoreNoteHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		res, err := db.Exec("UPDATE notes SET deleted_at=NULL, updated_at=? WHERE id=? AND user_id=? AND deleted_at IS NOT NULL",
			now(), id, userID(r))
		if err != nil {
			http.Error(w, `{"error":"恢复失败"}`, 500)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, `{"error":"笔记不存在或未删除"}`, 404)
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

// permanentDeleteHandler — 永久删除
func permanentDeleteHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		res, err := db.Exec("DELETE FROM notes WHERE id=? AND user_id=? AND deleted_at IS NOT NULL",
			id, userID(r))
		if err != nil {
			http.Error(w, `{"error":"删除失败"}`, 500)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, `{"error":"笔记不存在或未删除"}`, 404)
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

// cleanExpiredTrashHandler — 清理过期回收站（超过30天）
func cleanExpiredTrashHandler(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := userID(r)
		threshold := time.Now().Add(-30 * 24 * time.Hour).UTC().Format(time.RFC3339)
		res, err := db.Exec("DELETE FROM notes WHERE user_id=? AND deleted_at IS NOT NULL AND deleted_at < ?",
			uid, threshold)
		if err != nil {
			http.Error(w, `{"error":"清理失败"}`, 500)
			return
		}
		affected, _ := res.RowsAffected()
		writeJSON(w, 200, map[string]any{"status": "ok", "deleted": affected})
	}
}
