package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	redisClient *redis.Client
	ctx         = context.Background()
)

func initRedis() {
	opt, err := redis.ParseURL(os.Getenv("REDIS_URL"))
	if err != nil {
		log.Fatalf("❌ Failed to parse Redis URL: %v", err)
	}

	redisClient = redis.NewClient(opt)

	// Test the connection
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("❌ Failed to connect to Redis: %v", err)
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
