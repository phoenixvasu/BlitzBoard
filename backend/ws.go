package main

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"
)

type Client struct {
	conn     *websocket.Conn
	write    chan []byte
	docID    string
	userID   string
	lastPing time.Time
}

type Message struct {
	Type     string `json:"type"` // "edit", "presence", "cursor", "ping"
	UserID   string `json:"userID,omitempty"`
	Name     string `json:"name,omitempty"`     // for presence
	Joined   bool   `json:"joined,omitempty"`   // for presence
	Content  string `json:"content,omitempty"`  // for edits
	Position int    `json:"position,omitempty"` // for cursor
}

var (
	clients        = make(map[string]map[*Client]bool) // docID -> clients
	clientsMu      sync.RWMutex
	subscribedDocs = make(map[string]bool)
	subscribedMu   sync.Mutex
)

func handleWebSocket(conn *websocket.Conn) {
	docID := conn.Params("docID")
	if docID == "" {
		log.Println("❌ No document ID provided")
		conn.Close()
		return
	}

	log.Printf("🆕 WebSocket connection: docID=%s\n", docID)

	// Get Redis client
	rdb := getRedisClient()

	client := &Client{
		conn:     conn,
		write:    make(chan []byte, 256),
		docID:    docID,
		lastPing: time.Now(),
	}

	// Register client
	clientsMu.Lock()
	if clients[docID] == nil {
		clients[docID] = make(map[*Client]bool)
	}
	clients[docID][client] = true
	log.Printf("👥 Client added to doc %s | total clients: %d\n", docID, len(clients[docID]))
	clientsMu.Unlock()

	// Start ping ticker
	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	// Subscribe to Redis channel for this doc (only once)
	subscribedMu.Lock()
	if !subscribedDocs[docID] {
		subscribedDocs[docID] = true
		log.Printf("🔄 Starting Redis subscriber for doc %s\n", docID)
		go subscribeAndBroadcast(docID)
	}
	subscribedMu.Unlock()

	// Write loop
	go func() {
		for {
			select {
			case msg, ok := <-client.write:
				if !ok {
					return
				}
				if err := client.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					log.Println("❌ Error writing to WebSocket:", err)
					return
				}
			case <-pingTicker.C:
				if time.Since(client.lastPing) > 60*time.Second {
					log.Println("⚠️ Client ping timeout")
					return
				}
				if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					log.Println("❌ Error sending ping:", err)
					return
				}
			}
		}
	}()

	// Read loop
	autosaveStarted := false
	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("🔌 WebSocket read error (disconnected?):", err)
			break
		}

		if messageType == websocket.PingMessage {
			client.lastPing = time.Now()
			continue
		}

		log.Printf("📥 Received from client (doc %s): %s\n", docID, msg)

		var parsed Message
		if err := json.Unmarshal(msg, &parsed); err != nil {
			log.Println("❌ Invalid JSON:", err)
			continue
		}

		// Store userID for this client
		if parsed.UserID != "" {
			client.userID = parsed.UserID
		}

		switch parsed.Type {
		case "presence":
			log.Printf("👀 Presence update: %s joined=%v\n", parsed.UserID, parsed.Joined)
			if err := rdb.Publish(context.Background(), "doc:"+docID, msg).Err(); err != nil {
				log.Println("❌ Redis publish error (presence):", err)
			}

		case "edit":
			if parsed.UserID == "" || parsed.Content == "" {
				log.Println("⚠️ Missing userID/content in edit message")
				continue
			}

			log.Printf("💾 Updating in-memory doc %s with content: %.30s\n", docID, parsed.Content)
			updateDocContent(docID, parsed.Content)

			if !autosaveStarted {
				startAutoSave(docID)
				autosaveStarted = true
				log.Printf("⏱️ Started autosave loop for doc %s\n", docID)
			}

			if err := rdb.Publish(context.Background(), "doc:"+docID, msg).Err(); err != nil {
				log.Println("❌ Redis publish error (edit):", err)
			}

		case "cursor":
			if parsed.UserID == "" {
				log.Println("⚠️ Missing userID in cursor message")
				continue
			}
			log.Printf("🖱️ Cursor update from user %s at position %d\n", parsed.UserID, parsed.Position)
			if err := rdb.Publish(context.Background(), "doc:"+docID, msg).Err(); err != nil {
				log.Println("❌ Redis publish error (cursor):", err)
			}

		case "ping":
			client.lastPing = time.Now()
			// Send pong response
			if err := conn.WriteMessage(websocket.PongMessage, nil); err != nil {
				log.Println("❌ Error sending pong:", err)
				return
			}

		default:
			log.Println("⚠️ Unknown message type:", parsed.Type)
		}
	}

	// Cleanup on disconnect
	log.Printf("❎ Cleaning up client on doc %s\n", docID)
	client.conn.Close()
	close(client.write)

	clientsMu.Lock()
	delete(clients[docID], client)
	log.Printf("👤 Client removed. Remaining on doc %s: %d\n", docID, len(clients[docID]))
	clientsMu.Unlock()
}

func subscribeAndBroadcast(docID string) {
	// Get Redis client
	rdb := getRedisClient()

	pubsub := rdb.Subscribe(context.Background(), "doc:"+docID)
	defer pubsub.Close()

	log.Printf("📻 Subscribed to Redis channel doc:%s\n", docID)

	// Wait for confirmation of subscription
	_, err := pubsub.Receive(context.Background())
	if err != nil {
		log.Println("❌ Redis subscribe error:", err)
		return
	}

	ch := pubsub.Channel()
	for msg := range ch {
		log.Printf("🔁 Redis -> Broadcast to doc %s: %s\n", docID, msg.Payload)

		clientsMu.RLock()
		for client := range clients[docID] {
			select {
			case client.write <- []byte(msg.Payload):
				log.Println("➡️ Message queued for client")
			default:
				log.Println("⚠️ Client write channel full, skipping")
			}
		}
		clientsMu.RUnlock()
	}
}
