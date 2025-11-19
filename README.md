# Real-Time Chat Application - Backend

Node.js backend server for a real-time chat application with Socket.io and MongoDB.

## Features

- Real-time messaging using Socket.io
- MongoDB integration for message persistence
- Room-based chat system
- Online users tracking
- Typing indicators
- Chat history loading

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **MongoDB** - Database for message storage
- **Mongoose** - MongoDB ODM

## Installation

1. Clone the repository
2. Install dependencies:


npm install


3. Create `.env` file:

MONGO_URI=your_mongodb_connection_string
PORT=5000


4. Start the server:


npm run dev


Server will run on `http://localhost:5000`

## Socket Events

### Client → Server:
- `joinRoom` - Join a specific chat room
- `sendMessage` - Send a message to room
- `typing` - Notify typing status

### Server → Client:
- `message` - Receive new message
- `chatHistory` - Load previous messages
- `onlineUsers` - Get list of online users
- `userTyping` - Receive typing notification

## Author

MCA Graduate 2024
