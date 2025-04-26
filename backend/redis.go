package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
)

var (
	redisClient *redis.Client
	ctx         = context.Background()
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
		log.Fatal("❌ Redis configuration missing. Please set REDIS_URL and REDIS_PASSWORD environment variables")
	}

	// Check if we're using Upstash Redis (contains .upstash.io)
	isUpstash := strings.Contains(redisURL, ".upstash.io")

	var options *redis.Options
	if isUpstash {
		// Upstash Redis configuration
		options = &redis.Options{
			Addr:         redisURL,
			Password:     redisPassword,
			DB:           0,
			MinIdleConns: 1,
			MaxRetries:   3,
			DialTimeout:  10 * time.Second,
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 30 * time.Second,
			PoolSize:     10,
			PoolTimeout:  30 * time.Second,
			TLSConfig:    nil, // Upstash handles TLS
		}
	} else {
		// Local Redis configuration
		options = &redis.Options{
			Addr:         redisURL,
			Password:     redisPassword,
			DB:           0,
			MinIdleConns: 1,
			MaxRetries:   3,
			DialTimeout:  5 * time.Second,
			ReadTimeout:  3 * time.Second,
			WriteTimeout: 3 * time.Second,
			PoolSize:     10,
			PoolTimeout:  30 * time.Second,
		}
	}

	redisClient = redis.NewClient(options)

	// Test the connection
	_, connErr := redisClient.Ping(ctx).Result()
	if connErr != nil {
		log.Fatalf("❌ Failed to connect to Redis: %v", connErr)
	}

	log.Println("✅ Connected to Redis successfully")

	// Start connection monitoring
	go monitorRedisConnection()
}

func monitorRedisConnection() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		_, err := redisClient.Ping(ctx).Result()
		if err != nil {
			log.Printf("⚠️ Redis connection lost: %v", err)
			// Attempt to reconnect
			initRedis()
		}
	}
}

func getRedisClient() *redis.Client {
	if redisClient == nil {
		log.Fatal("❌ Redis client not initialized")
	}
	return redisClient
}
