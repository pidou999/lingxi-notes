package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	// 数据库路径（和可执行文件同级）
	exec, _ := os.Executable()
	dir := filepath.Dir(exec)
	dbPath := filepath.Join(dir, "lingxi.db")

	db, err := initDB(dbPath)
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer db.Close()

	r := chi.NewRouter()

	// 中间件
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// 公开路由
	r.Post("/api/v1/auth/register", registerHandler(db))
	r.Post("/api/v1/auth/login", loginHandler(db))

	// 认证路由
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		r.Get("/api/v1/notes", listNotesHandler(db))
		r.Post("/api/v1/notes", createNoteHandler(db))
		r.Get("/api/v1/notes/{id}", getNoteHandler(db))
		r.Put("/api/v1/notes/{id}", updateNoteHandler(db))
		r.Delete("/api/v1/notes/{id}", deleteNoteHandler(db))

		r.Get("/api/v1/providers", listProvidersHandler(db))
		r.Post("/api/v1/providers", createProviderHandler(db))
		r.Put("/api/v1/providers/{id}", updateProviderHandler(db))
		r.Delete("/api/v1/providers/{id}", deleteProviderHandler(db))
	})

	addr := ":8888"
	log.Printf("灵犀 API 服务启动于 %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
