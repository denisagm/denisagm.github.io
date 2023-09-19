const app = require('express')();
const http = require('http').createServer(app);
const short = require('short-uuid');
const { Server } = require("socket.io");
require('dotenv').config()

const io = new Server(http, {
  cors: {
    origin: process.env.ORIGIN || 'http://localhost:8080',
    methods: ["GET", "POST"]
  },
});

let players = [];

io.on('connection', (socket) => {
  let roomId = socket.handshake.query['roomId'];
  console.log(`A user connected ${socket.id}${roomId ? ` to room: ${roomId}`: ''}`);
  if (!roomId) {
    roomId = short.generate();
    socket.emit('room', roomId);
  }
  socket.join(roomId);

  players.push({id: socket.id, name: socket.id, roomId: roomId});
  socket.on('name', (name) => {
    let player = players.find(p => p.id == socket.id);
    console.log(`User entered name ${name}`);
    if (player) {
      console.log(`Changing name from ${player.name} to ${name}`)
      player.name = name;
    }
    updateClientsInRoom(roomId);
  });

  socket.on('vote', (vote) => {
    let player = players.find(p => p.id == socket.id);
    if (player) {
      player.vote = vote;
    }
    console.log(`Player ${player.name} voted ${player.vote}`);

    const playersInRoom = players.filter(p => p.roomId == roomId);
    if (playersInRoom.every(p => p.vote)) {
      io.to(roomId).emit('show');
    }
    updateClientsInRoom(roomId);
  });

  socket.on('show', () => {
    io.to(roomId).emit('show');
  });

  socket.on('restart', () => {
    restartGame(roomId);
  });

  socket.on('disconnect', (reason) => {
    const player = players.find(player => player.id === socket.id);
    console.log(`Player ${player.name} has disconnected because reason:`, reason);
    players = players.filter(player => player.id !== socket.id);
    // socket.leave(roomId); // keep user in room if he reconnects, right ?
    updateClientsInRoom(roomId);
   });

  // keeping the connection alive
  socket.on('pong', () => {
   // let player = players.find(p => p.id == socket.id);
  });
  socket.on('ping', (cb) => {
    let player = players.find(p => p.id == socket.id);
    console.log('received ping / emit pong', player.name);
    socket.emit('pong');
  });
});

// keeping the connection alive
setInterval(() => {
  // io.emit('ping');
  logRooms();
}, 8000);

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

console.log(process.env.ORIGIN);
http.listen(process.env.PORT || 3000, () => {
  console.log(`listening on *:${process.env.PORT || 3000}`);
});

function updateClientsInRoom(roomId) {
  const roomPlayers = players.filter(p => p.roomId == roomId);
  io.to(roomId).emit('update', roomPlayers);
}

function restartGame(roomId) {
  const roomPlayers = players.filter(p => p.roomId == roomId);
  roomPlayers.forEach(p => p.vote = undefined);
  console.log(`Restarted game with Players: ${roomPlayers.map(p => p.name).join(", ")}`);
  io.to(roomId).emit('restart');
  io.to(roomId).emit('update', roomPlayers);
}

function logRooms() {
  const rooms = players.map(e => e.roomId);
  if (rooms) {
    const filteredRooms = rooms.filter((val, i, arr) => arr.indexOf(val) == i);
    for (const room of filteredRooms) {
      const playersInRoom = players.filter(p => p.roomId == room).map(p => p.name || p.id);
      console.log(`Room: ${room} - Players: ${playersInRoom.join(", ")}`);
    }
  }
}
