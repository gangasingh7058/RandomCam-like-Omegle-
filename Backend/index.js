const express = require('express');
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { type } = require('os');

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Welcome to the Backend!');
});

server.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});

// WebSocket server (separate port)
const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' }, () => {
  console.log('WebSocket server running on port 8080');
});

// Globals
let users = [];
let queue = [];
let GLOBAL_ROOM_ID = 1;
const room_map = new Map();

// User class
class User {
  constructor(socket) {
    this.socket = socket;
    this.id = uuidv4();
    this.name = `User-${this.id}`;
  }
}

// Add a user
const AddUser = (ws) => {
  if (users.some(u => u.socket === ws)) return; // Prevent double adding

  const user = new User(ws);
  ws.user = user;
  users.push(user);
  queue.push(user);
  console.log(`User added: ${user.name}`);
};

// Delete a user
const DeleteUser = (userId) => {
  users = users.filter(user => user.id !== userId);
  queue = queue.filter(user => user.id !== userId);
  console.log(`User deleted: ${userId}`);
};

// Create a room
const MakeRoom = (user1, user2) => {
  const roomId = GLOBAL_ROOM_ID++;
  const room = {
    id: roomId,
    users: [user1.id, user2.id],
    sockets: [user1.socket, user2.socket],
  };
  room_map.set(roomId, room);

  user1.socket.roomId = roomId;
  user2.socket.roomId = roomId;

  console.log(`Room created: ${roomId} with ${user1.name} and ${user2.name}`);
  return room;
};

// Connect two users in a room
const connectUsers = (user1, user2) => {
  const room = MakeRoom(user1, user2);

  if (user1.socket.readyState === WebSocket.OPEN) {
    user1.socket.send(JSON.stringify({ type: "send-offer", otherside: user2.id }));
  }
  // if (user2.socket.readyState === WebSocket.OPEN) {
  //   user2.socket.send(JSON.stringify({ type: "send-offer", otherside: user1.id }));
  // }
};

// Handle "next" button
const handleNext = async (ws) => {
  const roomId = ws.roomId;
  if (!roomId || !room_map.has(roomId)) return;

  const room = room_map.get(roomId);
  const user1 = room.sockets[0].user;
  const user2 = room.sockets[1].user;

  room_map.delete(roomId);
  user1.socket.roomId = null;
  user2.socket.roomId = null;

  // // Add both back to queue (only if not already queued)
  // if (!queue.find(u => u.id === user1.id)) {
  //   queue.push(user1);
  // }
  // if (!queue.find(u => u.id === user2.id)) {
  //   queue.push(user2);
  // }
  
  DeleteUser(user1.id);
  DeleteUser(user2.id);

  const otheruser=ws.user!=user1?user1:user2;
  otheruser.socket.send(JSON.stringify({type:"other-did-next"}))
  console.log(`Users ${user1.name} and ${user2.name} returned to queue (next)`);
};

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      console.error('Invalid JSON:', message);
      return;
    }    

    switch (data.type) {
      case 'new-user':
        AddUser(ws);
        ws.send(JSON.stringify({ type: 'user-added', id: ws.user.id }));
        break;

      case 'delete-user':
        if (ws.user) DeleteUser(ws.user.id);
        ws.send(JSON.stringify({ type: 'user-deleted', id: ws.user?.id }));
        ws.user = null;
        break;

      case 'next':
        handleNext(ws);
        break;

      // WebRTC signaling
      case 'offer': {
        const otherUser = users.find(u => u.id === data.otherside);
        if (otherUser?.socket.readyState === WebSocket.OPEN) {
          otherUser.socket.send(JSON.stringify({
            type: "send-answer",
            otherside: ws.user.id,
            sdp: data.sdp
          }));
        }
        break;
      }

      case 'answer': {
        const otherUser = users.find(u => u.id === data.otherside);
        if (otherUser?.socket.readyState === WebSocket.OPEN) {
          otherUser.socket.send(JSON.stringify({
            type: "other-side-answer",
            otherside: ws.user.id,
            sdp: data.sdp
          }));
        }
        break;
      }

      case 'onice-connection': {
        const otherUser = users.find(u => u.id === data.otherside);
        if (otherUser?.socket.readyState === WebSocket.OPEN) {
          otherUser.socket.send(JSON.stringify({
            type: "ice-connection",
            otherside: ws.user.id,
            iceconnections: data.iceconnections
          }));
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const user = ws.user;
    if (!user) return;

    DeleteUser(user.id);

    // Handle other connected user
    const roomId = ws.roomId;
    if (roomId && room_map.has(roomId)) {
      const room = room_map.get(roomId);
      room_map.delete(roomId);

      const otherSocket = room.sockets.find(s => s !== ws);
      const otherUser = otherSocket?.user;

      if (otherUser) {
        queue.push(otherUser);
        otherSocket.roomId = null;

        if (otherSocket.readyState === WebSocket.OPEN) {
          otherSocket.send(JSON.stringify({ type: 'partner-disconnected' }));
        }
        console.log(`User ${otherUser.name} requeued after disconnect`);
      }
    }

    console.log(`User disconnected: ${user.name}`);
  });
});

// Match users from queue
async function matchUsersLoop() {
  while (true) {
    while (queue.length >= 2) {
      const user1 = queue.shift();
      const user2 = queue.shift();
      if (user1 && user2) {
        connectUsers(user1, user2);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

matchUsersLoop();
