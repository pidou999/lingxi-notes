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

// hasEmbeddedStatic 检查嵌入式静态文件是否包含 index.html（有实际内容）
func hasEmbeddedStatic() bool {
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		return false
	}
	_, err = sub.Open("index.html")
	return err == nil
}

// staticFileHandler 返回一个处理函数，尝试从 embed.FS 提供静态文件
// 如果 embed 中没有实际静态文件，则 fallback 到文件系统的 static 目录
func staticFileHandler() http.HandlerFunc {
	// 优先尝试 embed
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		log.Printf("警告: 无法加载内嵌静态文件: %v", err)
		return staticFileSystemFallback()
	}

	if !hasEmbeddedStatic() {
		log.Println("提示: 内嵌静态文件为空，尝试文件系统")
		return staticFileSystemFallback()
	}

	fileServer := http.FileServer(http.FS(sub))

	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// 检查 embed 中是否存在
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

		http.NotFound(w, r)
	}
}

// staticFileSystemFallback 从文件系统提供静态文件
func staticFileSystemFallback() http.HandlerFunc {
	exec, _ := os.Executable()
	dir := filepath.Dir(exec)
	fsPath := filepath.Join(dir, "static")

	// 检查文件系统
	if _, err := os.Stat(filepath.Join(fsPath, "index.html")); os.IsNotExist(err) {
		return func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "前端静态文件未构建。请先运行 build.bat", 500)
		}
	}

	fsys := os.DirFS(fsPath)
	fileServer := http.FileServer(http.FS(fsys))

	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		_, err := fs.Stat(fsys, path)
		if err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		// SPA fallback
		if !strings.Contains(path, ".") && !strings.HasPrefix(path, "api/") {
			r.URL.Path = "/index.html"
			fileServer.ServeHTTP(w, r)
			return
		}
		http.NotFound(w, r)
	}
}
