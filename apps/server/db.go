package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"

	_ "modernc.org/sqlite"
)

type DB = sql.DB

func initDB(path string) (*DB, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)"+
		"&_pragma=busy_timeout(5000)"+
		"&_pragma=foreign_keys(ON)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // SQLite 不适合多连接

	if err := migrate(db); err != nil {
		return nil, err
	}
	return db, nil
}

func migrate(db *DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS notes (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		title TEXT NOT NULL DEFAULT '',
		html TEXT NOT NULL DEFAULT '',
		json TEXT NOT NULL DEFAULT '{}',
		tags TEXT NOT NULL DEFAULT '[]',
		deleted_at TEXT DEFAULT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS providers (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		type TEXT NOT NULL DEFAULT 'custom',
		name TEXT NOT NULL,
		base_url TEXT NOT NULL DEFAULT '',
		api_key TEXT NOT NULL DEFAULT '',
		protocol TEXT NOT NULL DEFAULT 'OpenAI',
		models TEXT NOT NULL DEFAULT '[]',
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
		CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
		CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at);
		CREATE INDEX IF NOT EXISTS idx_providers_user ON providers(user_id);
		`
	if _, err := db.Exec(schema); err != nil {
		return err
	}

	// 兼容旧表：检查并添加 deleted_at 列
	if _, err := db.Exec("ALTER TABLE notes ADD COLUMN deleted_at TEXT DEFAULT NULL"); err != nil {
		// 列已存在时忽略错误
	}

	// 清理过期回收站（超过30天）
	if _, err := db.Exec("DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')"); err != nil {
		// 忽略
	}

	log.Println("数据库迁移完成")
	return nil
}

// 辅助：时间戳
func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// JSON 辅助
func mustMarshal(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
