package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Queryer is the minimal interface satisfied by both *pgxpool.Pool and pgx.Tx.
// Use it in helper functions so they work with transactions transparently.
type Queryer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

// ensure *DB implements Queryer at compile time.
var _ Queryer = (*DB)(nil)

// Query delegates to db.Pool.Query.
func (db *DB) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return db.Pool.Query(ctx, sql, args...)
}

// QueryRow delegates to db.Pool.QueryRow.
func (db *DB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return db.Pool.QueryRow(ctx, sql, args...)
}

// Exec delegates to db.Pool.Exec.
func (db *DB) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return db.Pool.Exec(ctx, sql, args...)
}
