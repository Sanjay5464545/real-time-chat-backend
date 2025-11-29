// Import all required packages
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { Expo } = require('expo-server-sdk');
require('dotenv').config();

// Import Models
const Message = require('./models/Message');
const Room = require('./models/Room');
const User = require('./models/User');

// Create Expo SDK instance for push notifications
const expo = new Expo();

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "https://chat-frontend1.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.log('❌ MongoDB Error:', err));

// Test route
app.get('/', (req, res) => {
  res.send('Chat Server is Running! 🚀');
});

// Store online users with push tokens
const onlineUsers = {};

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('🔌 New user connected:', socket.id);

  // Event: Register push token
  socket.on('registerPushToken', ({ pushToken }) => {
    socket.pushToken = pushToken;
    if (onlineUsers[socket.id]) {
      onlineUsers[socket.id].pushToken = pushToken;
    }
    console.log('🔔 Push token registered:', pushToken);
  });

  // Event 1: User joins a room
  socket.on('joinRoom', async ({ username, room }) => {
    try {
      socket.join(room);
      socket.username = username;
      socket.room = room;

      // Add user to online users
      onlineUsers[socket.id] = { 
        username, 
        room, 
        socketId: socket.id,
        pushToken: socket.pushToken || null
      };

      // Get online users in this room
      const roomUsers = Object.values(onlineUsers).filter(user => user.room === room);

      // Load chat history from database
      const messages = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);

      // Send chat history to the user who just joined
      socket.emit('chatHistory', messages);

      // Notify everyone in the room that user joined
      io.to(room).emit('message', {
        username: 'System',
        message: `${username} has joined the room`,
        timestamp: new Date(),
        isSystem: true
      });

      // Send updated online users list to everyone in the room
      io.to(room).emit('onlineUsers', roomUsers);

      console.log(`✅ ${username} joined room: ${room}`);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  // Event 2: Send message with push notifications
  socket.on('sendMessage', async ({ username, room, message }) => {
    try {
      // Save message to database
      const newMessage = new Message({
        username,
        room,
        message,
        timestamp: new Date()
      });

      await newMessage.save();

      // Broadcast message to everyone in the room
      io.to(room).emit('message', {
        username,
        message,
        timestamp: newMessage.timestamp
      });

      console.log(`💬 ${username} sent message in ${room}: ${message}`);

      // Send push notifications to users in the room (except sender)
      const roomUsers = Object.values(onlineUsers).filter(
        user => user.room === room && user.username !== username && user.pushToken
      );

      if (roomUsers.length > 0) {
        const notifications = [];
        
        for (let user of roomUsers) {
          // Check if push token is valid
          if (!Expo.isExpoPushToken(user.pushToken)) {
            console.error(`❌ Invalid push token: ${user.pushToken}`);
            continue;
          }

          notifications.push({
            to: user.pushToken,
            sound: 'default',
            title: `${username} in ${room}`,
            body: message,
            data: { room, username }
          });
        }

        // Send notifications in chunks
        const chunks = expo.chunkPushNotifications(notifications);
        
        for (let chunk of chunks) {
          try {
            await expo.sendPushNotificationsAsync(chunk);
            console.log('🔔 Push notifications sent!');
          } catch (error) {
            console.error('❌ Error sending push notifications:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Event 3: Typing indicator
  socket.on('typing', ({ username, room, isTyping }) => {
    socket.to(room).emit('userTyping', { username, isTyping });
  });

  // Event 4: User disconnects
  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    
    if (user) {
      const { username, room } = user;
      
      // Remove user from online users
      delete onlineUsers[socket.id];

      // Get updated online users in this room
      const roomUsers = Object.values(onlineUsers).filter(u => u.room === room);

      // Notify everyone in the room
      io.to(room).emit('message', {
        username: 'System',
        message: `${username} has left the room`,
        timestamp: new Date(),
        isSystem: true
      });

      // Send updated online users list
      io.to(room).emit('onlineUsers', roomUsers);

      console.log(`👋 ${username} disconnected from ${room}`);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
