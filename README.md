# BlitzBoard - Real-time Collaborative Text Editor

BlitzBoard is a modern, real-time collaborative text editor built with React, Go, WebSocket, and Supabase. It allows multiple users to edit documents simultaneously with features like real-time cursor tracking, presence indicators, and automatic saving.

## 🚀 Features

- **Real-time Collaboration**: Multiple users can edit the same document simultaneously
- **Live Cursor Tracking**: See where other users are typing in real-time
- **Presence Indicators**: Know who's currently viewing/editing the document
- **Automatic Saving**: Changes are automatically saved to the database
- **Document Sharing**: Share documents with other users
- **User Authentication**: Secure login and user management
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

### Frontend (React)

- Built with React and Vite
- Uses Tailwind CSS for styling
- WebSocket client for real-time communication
- Supabase client for authentication and data storage

### Backend (Go)

- Go server using Fiber framework
- WebSocket server for real-time communication
- Redis for pub/sub messaging
- Supabase integration for data persistence

### Key Components

1. **WebSocket Server (`ws.go`)**

   - Handles real-time communication between clients
   - Manages client connections and disconnections
   - Broadcasts changes to all connected clients
   - Tracks user presence and cursor positions

2. **Autosave System (`autosave.go`)**

   - Automatically saves document changes to Supabase
   - Implements debouncing to prevent excessive saves
   - Handles concurrent access safely

3. **Redis Integration (`redis.go`)**

   - Pub/sub system for message broadcasting
   - Ensures reliable message delivery
   - Handles connection management

4. **Editor Page (`EditorPage.jsx`)**
   - Rich text editor interface
   - Real-time cursor tracking
   - User presence indicators
   - Document sharing functionality

## 🔧 Technical Stack

### Frontend

- React
- Vite
- Tailwind CSS
- WebSocket Client
- Supabase Client

### Backend

- Go
- Fiber Framework
- WebSocket
- Redis
- Supabase

## 🛠️ Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- Go (v1.16 or higher)
- Redis server
- Supabase account

### Backend Setup

1. Navigate to the backend directory
2. Create a `.env` file with the following variables:
   ```
   REDIS_URL=your_redis_url
   REDIS_PASSWORD=your_redis_password
   SUPABASE_URL=your_supabase_url
   SUPABASE_API_KEY=your_supabase_api_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```
3. Run `go mod download` to install dependencies
4. Start the server with `go run main.go`

### Frontend Setup

1. Navigate to the frontend directory
2. Create a `.env` file with:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Run `npm install` to install dependencies
4. Start the development server with `npm run dev`

## 🔒 Security Features

- User authentication through Supabase
- Secure WebSocket connections
- Role-based access control for documents
- Environment variable management
- Input validation and sanitization

## 📝 Usage

1. Create an account or log in
2. Create a new document or open an existing one
3. Share the document with other users
4. Start collaborating in real-time!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
