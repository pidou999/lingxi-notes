package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	prod := flag.Bool("prod", false, "生产模式：嵌入静态文件并监听 8877 端口")
	flag.Parse()

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

	// 代理路由（公开，AI 功能可能未登录使用）
	r.Post("/api/proxy/fetch-models", proxyFetchModelsHandler)
	r.Post("/api/proxy/test-connection", proxyTestConnectionHandler)
	r.Post("/api/proxy/chat", proxyChatHandler)

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

		r.Get("/api/v1/tags", listTagsHandler(db))
		r.Get("/api/v1/tags/{tag}", listNotesByTagHandler(db))

		r.Get("/api/v1/search", searchHandler(db))

		// 回收站
		r.Get("/api/v1/trash", listTrashHandler(db))
		r.Post("/api/v1/trash/{id}/restore", restoreNoteHandler(db))
		r.Delete("/api/v1/trash/{id}", permanentDeleteHandler(db))
		r.Post("/api/v1/trash/clean", cleanExpiredTrashHandler(db))
	})

	// 生产模式：嵌入静态文件
	if *prod {
		log.Println("生产模式 - 嵌入静态前端文件")
		r.HandleFunc("/*", staticFileHandler())
	}

	addr := ":8888"
	if *prod {
		addr = ":8877"
	}
	log.Printf("灵犀 API 服务启动于 %s %s", addr, map[bool]string{false: "(开发模式)", true: "(生产模式)"}[*prod])
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
