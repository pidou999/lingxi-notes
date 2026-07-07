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

	// Database
	DatabaseURL string `env:"DATABASE_URL" envDefault:"postgres://ainotes:ainotes@localhost:5432/ainotes?sslmode=disable"`

	// Redis
	RedisURL string `env:"REDIS_URL" envDefault:"redis://localhost:6379/0"`

	// MinIO (Object Storage)
	MinIOEndpoint  string `env:"MINIO_ENDPOINT" envDefault:"localhost:9000"`
	MinIOAccessKey string `env:"MINIO_ACCESS_KEY" envDefault:"ainotes"`
	MinIOSecretKey string `env:"MINIO_SECRET_KEY" envDefault:"ainotes_secret"`
	MinIOBucket    string `env:"MINIO_BUCKET" envDefault:"ainotes"`

	// CORS
	CORSOrigins string `env:"CORS_ORIGINS" envDefault:"http://localhost:3000"`

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
