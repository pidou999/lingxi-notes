package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"

	"github.com/joho/godotenv"

	"github.com/user/ai-notes/internal/config"
	"github.com/user/ai-notes/pkg/db"
)

func main() {
	var direction string
	flag.StringVar(&direction, "direction", "up", "migration direction (up | down)")
	flag.Parse()

	// Best-effort load of .env so DATABASE_URL is picked up.
	_ = godotenv.Load()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		if cfg, err := config.Load(); err == nil && cfg.DatabaseURL != "" {
			databaseURL = cfg.DatabaseURL
		}
	}
	if databaseURL == "" {
		slog.Error("DATABASE_URL 未配置：请通过环境变量或 .env 显式设置数据库连接串")
		os.Exit(1)
	}

	migrationsPath := "migrations"

	switch direction {
	case "up":
		if err := db.MigrateUp(databaseURL, migrationsPath); err != nil {
			slog.Error("migration up failed", "error", err)
			os.Exit(1)
		}
		fmt.Println("✓ All pending migrations applied")
	case "down":
		if err := db.MigrateDown(databaseURL, migrationsPath); err != nil {
			slog.Error("migration down failed", "error", err)
			os.Exit(1)
		}
		fmt.Println("✓ Last migration rolled back")
	default:
		fmt.Fprintf(os.Stderr, "unknown direction %q — use 'up' or 'down'\n", direction)
		os.Exit(1)
	}
}
