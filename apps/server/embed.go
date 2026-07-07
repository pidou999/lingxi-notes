package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

//go:embed static
var staticFS embed.FS

// staticFileHandler 返回一个处理函数，尝试从 embed.FS 提供静态文件
// 如果 embed 中没有找到，则 fallback 到文件系统的 static 目录（用于开发）
func staticFileHandler() http.HandlerFunc {
	// 优先尝试 embed
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		log.Printf("警告: 无法加载内嵌静态文件: %v", err)
	}

	// 同时尝试文件系统路径（运行时可能更新）
	exec, _ := os.Executable()
	dir := filepath.Dir(exec)
	fsPath := filepath.Join(dir, "static")

	fileServer := http.FileServer(http.FS(sub))

	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		// 如果是静态文件请求，直接从 embed 提供
		if path == "" {
			path = "index.html"
		}

		// 检查 embed 中是否存在
		if sub != nil {
			_, err := sub.Open(path)
			if err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
			// 无后缀且不是 API 路径 → SPA fallback: 尝试 index.html
			if !strings.Contains(path, ".") && !strings.HasPrefix(path, "api/") {
				r.URL.Path = "/index.html"
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Fallback 到文件系统
		fsSub, err := fs.Sub(os.DirFS(fsPath), ".")
		if err == nil {
			fsServer := http.FileServer(http.FS(fsSub))
			fsServer.ServeHTTP(w, r)
			return
		}

		http.NotFound(w, r)
	}
}
