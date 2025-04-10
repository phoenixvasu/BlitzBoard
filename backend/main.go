package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
)

func main() {
	// Initialize Redis (placeholder, define this in your code)
	initRedis()

	app := fiber.New()

	// ✅ Add CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*", // Or "http://localhost:5173" for specific frontend
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	// ✅ Health check route
	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	// ✅ WebSocket upgrade middleware (before handler)
	app.Use("/ws/:docID", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// ✅ WebSocket route
	app.Get("/ws/:docID", websocket.New(handleWebSocket))

	log.Println("🚀 Server listening on http://localhost:8080")
	log.Fatal(app.Listen("0.0.0.0:8080"))
}
