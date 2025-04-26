package main

import (
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
)

func main() {
	// Initialize Redis
	initRedis()

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ReadTimeout:  time.Second * 10,
		WriteTimeout: time.Second * 10,
		// Enable case sensitive routing
		CaseSensitive: true,
		// Enable strict routing
		StrictRouting: true,
		// Server name header
		ServerHeader: "BlitzBoard",
		// App name header
		AppName: "BlitzBoard Backend",
	})

	// Configure CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins:     os.Getenv("ALLOWED_ORIGINS"), // Will be set in Render
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		MaxAge:           3600,
	}))

	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"time":   time.Now().UTC(),
		})
	})

	// WebSocket endpoint with document ID
	app.Use("/ws/:docID", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("docID", c.Params("docID"))
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/:docID", websocket.New(handleWebSocket))

	// Start server
	port := getPort()
	host := getHost()
	log.Printf("🚀 Server starting on %s:%s", host, port)
	log.Fatal(app.Listen(host + ":" + port))
}

func getPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return port
}

func getHost() string {
	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0" // Default to all interfaces
	}
	return host
}
