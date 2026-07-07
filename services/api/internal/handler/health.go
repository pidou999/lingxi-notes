package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/user/ai-notes/pkg/db"
)

// HealthHandler exposes health-check endpoints.
type HealthHandler struct {
	db *db.DB
}

// NewHealthHandler creates a handler that checks database connectivity.
func NewHealthHandler(database *db.DB) *HealthHandler {
	return &HealthHandler{db: database}
}

// Health responds with the overall service health.
//
//	GET /api/health -> { "status": "ok", "database": "ok", "timestamp": "..." }
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	var dbStatus = "ok"
	if err := h.db.HealthCheck(r.Context()); err != nil {
		dbStatus = "error"
	}

	httpStatus := http.StatusOK
	respStatus := "ok"
	if dbStatus != "ok" {
		httpStatus = http.StatusServiceUnavailable
		respStatus = "degraded"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":    respStatus,
		"database":  dbStatus,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
