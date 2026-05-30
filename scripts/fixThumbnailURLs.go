package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	// Get DATABASE_URI from environment variables
	databaseURI := os.Getenv("DATABASE_URI")
	if databaseURI == "" {
		log.Fatalf("DATABASE_URI is not set in the environment")
	}

	// Connect to the PostgreSQL database
	db, err := sql.Open("postgres", databaseURI)
	if err != nil {
		log.Fatalf("Error connecting to the database: %v", err)
	}
	defer db.Close()

	// Query the media table
	rows, err := db.Query("SELECT id, sizes_thumbnail_url FROM media")
	if err != nil {
		log.Fatalf("Error querying the media table: %v", err)
	}
	defer rows.Close()

	// Print rows from the media table
	var to_update = []struct {
	  id int
		new_thumbnail_url string
	}{}
	
	
	for rows.Next() {
	  var id int
		var sizes_thumbnail_url string

		err := rows.Scan(&id, &sizes_thumbnail_url)
		if err != nil {
			log.Fatalf("Error scanning row: %v", err)
		}

		var new_sizes_thumbnail_url = sizes_thumbnail_url[:strings.LastIndex(sizes_thumbnail_url, ".")] + ".webp"
		
		to_update = append(to_update, struct {
			id                int
			new_thumbnail_url string
		}{
			id:                id,
			new_thumbnail_url: new_sizes_thumbnail_url,
		})

		fmt.Printf("URL: %s \nNEW URL: %s\n", sizes_thumbnail_url, new_sizes_thumbnail_url)
	}
	
	// Update the media table with the new thumbnail URLs
	for _, item := range to_update {
		_, err := db.Exec("UPDATE media SET sizes_thumbnail_url = $1 WHERE id = $2", item.new_thumbnail_url, item.id)
		if err != nil {
			log.Fatalf("Error updating row with id %d: %v", item.id, err)
		}
		fmt.Printf("Updated id %d with new URL: %s\n", item.id, item.new_thumbnail_url)
	}

	// Check for errors from iterating over rows
	if err = rows.Err(); err != nil {
		log.Fatalf("Error iterating over rows: %v", err)
	}
}
