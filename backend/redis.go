package main

import (
	"crypto/tls"
	"context"
	"log"
	"os"

	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
)

var (
	ctx = context.Background()
	rdb *redis.Client
)

func initRedis() {
	// Load .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	redisURL := os.Getenv("REDIS_URL")
	redisPassword := os.Getenv("REDIS_PASSWORD")

	if redisURL == "" || redisPassword == "" {
		log.Fatal("REDIS_URL or REDIS_PASSWORD not set in environment")
	}

	rdb = redis.NewClient(&redis.Options{
		Addr:     redisURL,
		Password: redisPassword,
		DB:       0,
		TLSConfig: &tls.Config{},
	})

	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("❌ Could not connect to Redis: %v", err)
	}

	log.Println("✅ Connected to Redis")
}
