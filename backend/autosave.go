package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/joho/godotenv"
)

var (
	docContents   = make(map[string]string)
	docContentsMu sync.RWMutex
)

func init() {
	err := godotenv.Load()
	if err != nil {
		log.Println("⚠️  No .env file found, proceeding with system env variables...")
	}
}

func updateDocContent(docID, content string) {
	docContentsMu.Lock()
	docContents[docID] = content
	docContentsMu.Unlock()
}

func startAutoSave(docID string) {
	go func() {
		for {
			time.Sleep(10 * time.Second)

			docContentsMu.RLock()
			content := docContents[docID]
			docContentsMu.RUnlock()

			saveToSupabase(docID, content)
		}
	}()
}

func saveToSupabase(docID string, content string) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	apiKey := os.Getenv("SUPABASE_API_KEY")
	serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	url := fmt.Sprintf("%s/rest/v1/documents?id=eq.%s", supabaseURL, docID)

	payload := map[string]string{"content": content}
	jsonBody, _ := json.Marshal(payload)

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		log.Println("❌ Failed to create request:", err)
		return
	}

	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Println("❌ Supabase request error:", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("🛑 Supabase save failed for doc %s: %d\n", docID, resp.StatusCode)
	} else {
		log.Printf("✅ Autosaved doc %s\n", docID)
	}
}
