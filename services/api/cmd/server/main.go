package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/user/ai-notes/internal/config"
	"github.com/user/ai-notes/internal/handler"
	"github.com/user/ai-notes/internal/middleware"
	"github.com/user/ai-notes/pkg/db"
)

func main() {
	// ── Config ──────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	// ── Logger ──────────────────────────────────────────────────────────
	logLevel := slog.LevelInfo
	if cfg.Env == "development" {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	})))
	logger := slog.Default()

	// ── Database ────────────────────────────────────────────────────────
	ctx := context.Background()
	database, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()
	logger.Info("connected to database")

	// ── Migrations ──────────────────────────────────────────────────────
	if cfg.RunMigrations {
		if err := db.MigrateUp(cfg.DatabaseURL, "migrations"); err != nil {
			logger.Error("database migration failed", "error", err)
			os.Exit(1)
		}
		logger.Info("database migrations applied")
	}

	// ── Router ──────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// --- Global middleware ---
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   parseOrigins(cfg.CORSOrigins),
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "X-Request-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.StructuredLogger(logger))
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(chimw.Throttle(100))

	// --- Routes ---
	r.Route("/api", func(r chi.Router) {
		healthHandler := handler.NewHealthHandler(database)
		r.Get("/health", healthHandler.Health)
	})

	// ── HTTP Server ─────────────────────────────────────────────────────
	addr := cfg.APIHost + ":" + cfg.APIPort
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown via OS signal
	go func() {
		logger.Info("server starting", "addr", addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server fatal", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	logger.Info("shutting down server", "signal", sig.String())

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("server forced shutdown", "error", err)
	}
	logger.Info("server stopped")
}

// parseOrigins splits a comma-separated origin list, trimming whitespace.
// It returns a slice with a single wildcard entry if the input is empty.
func parseOrigins(s string) []string {
	if strings.TrimSpace(s) == "" {
		return []string{"*"}
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}
