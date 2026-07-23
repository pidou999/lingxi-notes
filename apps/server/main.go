package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func dirOf(exec string) string {
	return filepath.Dir(exec)
}

func joinPath(dir, name string) string {
	return filepath.Join(dir, name)
}

// rateLimiter 是注册/登录接口的简易内存限流（按客户端 IP）。
// 仅用于防御暴力破解；多实例部署可换为共享存储（如 Redis）。
type rateLimiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	limit  int
	window time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{hits: make(map[string][]time.Time), limit: limit, window: window}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-rl.window)
	prev := rl.hits[ip]
	kept := prev[:0]
	for _, t := range prev {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	rl.hits[ip] = kept
	if len(kept) >= rl.limit {
		return false
	}
	rl.hits[ip] = append(rl.hits[ip], now)
	return true
}

// rateLimit 中间件：对注册/登录等认证端点做按 IP 限流。
func rateLimit(lim *rateLimiter) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if i := strings.LastIndex(ip, ":"); i >= 0 {
				ip = ip[:i]
			}
			if !lim.allow(ip) {
				http.Error(w, `{"error":"尝试过于频繁，请稍后再试"}`, 429)
				return
			}
			next(w, r)
		}
	}
}

func main() {
	prod := flag.Bool("prod", false, "生产模式：嵌入静态文件并监听 8877 端口")
	flag.Parse()

	// 数据库路径（和可执行文件同级）
	exec, _ := os.Executable()
	dir := dirOf(exec)
	dbPath := joinPath(dir, "lingxi.db")

	db, err := initDB(dbPath)
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer db.Close()

	r := chi.NewRouter()

	// 中间件
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	lim := newRateLimiter(20, time.Minute) // 每 IP 每分钟最多 20 次认证尝试

	// 公开路由（限流）
	r.Post("/api/v1/auth/register", rateLimit(lim)(registerHandler(db)))
	r.Post("/api/v1/auth/login", rateLimit(lim)(loginHandler(db)))

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
		r.Post("/api/v1/trash/restore-all", restoreAllTrashHandler(db))
		r.Post("/api/v1/trash/empty", emptyTrashHandler(db))
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
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 优雅关闭：监听 SIGINT/SIGTERM
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("灵犀 API 服务启动于 %s %s", addr, map[bool]string{false: "(开发模式)", true: "(生产模式)"}[*prod])
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()

	<-stop
	log.Println("正在关闭服务...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("优雅关闭出错: %v", err)
	}
	log.Println("服务已停止")
}
