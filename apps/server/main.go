package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
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
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:8877"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           86400,
	}))

	// 公开路由
	r.Post("/api/auth/register", registerHandler(db))
	r.Post("/api/auth/login", loginHandler(db))

	// 认证路由
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		r.Get("/api/notes", listNotesHandler(db))
		r.Post("/api/notes", createNoteHandler(db))
		r.Get("/api/notes/{id}", getNoteHandler(db))
		r.Put("/api/notes/{id}", updateNoteHandler(db))
		r.Delete("/api/notes/{id}", deleteNoteHandler(db))

		r.Get("/api/providers", listProvidersHandler(db))
		r.Post("/api/providers", createProviderHandler(db))
		r.Put("/api/providers/{id}", updateProviderHandler(db))
		r.Delete("/api/providers/{id}", deleteProviderHandler(db))
	})

	addr := ":8888"
	log.Printf("灵犀 API 服务启动于 %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
