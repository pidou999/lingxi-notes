package config

import (
	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// Server
	APIHost string `env:"API_HOST" envDefault:"0.0.0.0"`
	APIPort string `env:"API_PORT" envDefault:"8080"`
	Env     string `env:"ENV" envDefault:"development"`

	// Database — 必须显式配置，不再内置硬编码凭据
	DatabaseURL string `env:"DATABASE_URL"`

	// Redis
	RedisURL string `env:"REDIS_URL" envDefault:"redis://localhost:6379/0"`

	// MinIO (Object Storage)
	MinIOEndpoint  string `env:"MINIO_ENDPOINT" envDefault:"localhost:9000"`
	MinIOAccessKey string `env:"MINIO_ACCESS_KEY"`
	MinIOSecretKey string `env:"MINIO_SECRET_KEY"`
	MinIOBucket    string `env:"MINIO_BUCKET" envDefault:"ainotes"`

	// CORS — 必须显式配置可信源，禁止通配符配合凭据
	CORSOrigins string `env:"CORS_ORIGINS"`

	// Behaviour
	RunMigrations bool `env:"RUN_MIGRATIONS" envDefault:"true"`
}

// Load reads configuration from environment variables, falling back to .env file.
func Load() (*Config, error) {
	// Best-effort load of .env file; don't error if absent in production
	_ = godotenv.Load()

	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
