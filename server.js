/*******************************************/
/* /////////// Server creation \\\\\\\\\\\ */
/*******************************************/
const express = require("express");
const path = require("path");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(path.join(__dirname, "public")));

app.use("/", require("./routes/router"));

/*******************************************/
/* ///////////// pseudo-DB \\\\\\\\\\\\\\\ */
/*******************************************/
let chat_rooms = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
let nb_chat_rooms = chat_rooms.length;

let users = [];

/*******************************************/
/* /////////////// Utils \\\\\\\\\\\\\\\\\ */
/*******************************************/
const searchForChatRoom = (
  socket,
  room_index = 0,
  first_connection = false
) => {
  let room = chat_rooms[room_index];
  io.in(room).clients((error, clients) => {
    if (error) console.log(error);
    if (clients.length < 2) {
      changeRoom(socket, room, first_connection, () => {});
    } else if (room_index + 1 < nb_chat_rooms) {
      searchForChatRoom(socket, room_index + 1, first_connection);
    } else {
      console.log(
        "no available room found for socket " +
          socket.id +
          ", searching again in 3s"
      );
      setTimeout(searchForChatRoom, 3000, socket, 0, first_connection);
    }
  });
};

const changeRoom = (socket, room, first_connection = false, callback) => {
  findEmittingRoom(
    socket,
    socket_room => {
      if (socket_room != undefined && !first_connection) {
        socket.leave(socket_room, () => {
          console.log("socket " + socket.id + " left room " + room);
          io.to(socket.id).emit("left room", socket_room);
          joinRoom(socket, room, first_connection, callback);
        });
      } else joinRoom(socket, room, first_connection, callback);
    },
    first_connection
  );
};

const joinRoom = (socket, room, first_connection, callback) => {
  socket.join(room, () => {
    console.log("socket " + socket.id + " joined room " + room);
    changeRoomOfUserInDB(socket, room, () => {
      if (room != "general") {
        emitNewRoomDetailsToSocket(socket, first_connection, room);
        broadcastSocketDetailsToNewRoom(socket, room);
      }
    });
    callback();
  });
};

const changeRoomOfUserInDB = (socket, room, callback) => {
  getUserFromSocket(socket, user => {
    if (user === undefined) {
      console.log("Error: user is undefined in changeRoomToUserObjInDB!");
    } else {
      user.room = room;
    }
    callback();
  });
};

const getUserFromSocket = (socket, callback) => {
  let user = users.find(usr => usr.id === socket.id);
  callback(user);
};

const broadcastSocketDetailsToNewRoom = (socket, new_room) => {
  let usrnm = findUsername(socket.id);
  socket.broadcast.to(new_room).emit("join new room", {
    id: socket.id,
    username: usrnm,
  });
};

const emitNewRoomDetailsToSocket = (socket, first_connection, new_room) => {
  getInterloc(socket, first_connection, interloc => {
    getUsernamefromgetInterlocReturn(interloc, usrnm => {
      io.to(socket.id).emit("joined room", {
        room: new_room,
        interlocutor: usrnm,
      });
    });
  });
};

const getInterloc = (socket, first_connection, callback) => {
  findEmittingRoom(
    socket,
    emitting_room => {
      if (emitting_room != undefined) {
        let interloc_id;
        io.in(emitting_room).clients((error, clients) => {
          if (error) console.log(error);
          for (let client of clients) {
            if (client != socket.id) {
              interloc_id = client;
              let usrnm;
              if (interloc_id != undefined) usrnm = findUsername(interloc_id);
              else usrnm = undefined;
              var interloc = { id: interloc_id, username: usrnm };
              return callback(interloc);
            }
          }
          return callback(undefined);
        });
      } else {
        if (!first_connection)
          console.log(
            "Error: couldn't find emitting room for socket " +
              socket.id +
              " in getInterloc!"
          );
        return callback(undefined);
      }
    },
    first_connection
  );
};

const getUsernamefromgetInterlocReturn = (interloc, callback) => {
  let usrnm = undefined;
  if (interloc !== undefined) usrnm = interloc.username;
  callback(usrnm);
};

const findEmittingRoom = (socket, callback, first_connection = false) => {
  let rooms = Object.keys(socket.rooms);
  let emitting_room = undefined;
  for (let room of rooms) {
    if (room != socket.id && room != "general") {
      emitting_room = room;
      break;
    }
  }
  if (emitting_room === undefined && !first_connection) {
    console.log(
      "Error: couldn't find emitting room for socket " +
        socket.id +
        " in findEmittingRoom!"
    );
  } else emitting_room;
  callback(emitting_room);
};

const findUsername = socket_id => {
  if (socket_id === undefined) {
    console.log("Error: socket is undefined in findUsername!");
    return undefined;
  } else
    for (let i = 0; i < users.length; i++) {
      if (users[i].id == socket_id) {
        return users[i].username;
      }
    }
};

const disconnectionHandler = socket => {
  createLeavingMessageInfo(socket, (room, usrnm) => {
    sendLeavingMessage(socket, room);
    updatePeopleCounters(usrnm);
    removeUserOfDB(socket);
  });
};

const createLeavingMessageInfo = (socket, callback) => {
  getUserFromSocket(socket, user => {
    if (user === undefined) {
      callback(undefined, undefined);
      console.log(
        "Error: could not find user while creating leaving message for socket " +
          socket.id +
          "!"
      );
    } else callback(user.room, user.username);
  });
};

const sendLeavingMessage = (socket, room) => {
  if (room === undefined) {
    console.log(
      "Error: no leaving message sent to (unknown) former room of socket " +
        socket.id +
        "!"
    );
  } else {
    socket.broadcast.to(room).emit("leaving", {
      id: socket.id,
      username: undefined,
    });
  }
};

const removeUserOfDB = socket => {
  for (let i = 0; i < users.length; i++) {
    if (users[i].id == socket.id) {
      users.splice(i, 1);
      break;
    }
  }
};

const updatePeopleCounters = usrnm => {
  io.in("general").clients((error, clients) => {
    if (error) console.log(error);
    io.to("general").emit("leave room", {
      leaver: usrnm,
      peoplecount: clients.length,
    });
  });
};

/*******************************************/
/* ///////////// Entry point \\\\\\\\\\\\\ */
/*******************************************/
io.on("connect", socket => {
  users.push({ id: socket.id, username: undefined, room: undefined });

  console.log("-> socket " + socket.id + " just connected ->");

  io.to(socket.id).emit("connection success");

  changeRoom(socket, "general", true, () => {
    io.in("general").clients((error, clients) => {
      if (error) console.log(error);
      socket.broadcast.to("general").emit("join room", {
        newcommer: socket.id,
        peoplecount: clients.length,
      });
    });
  });

  socket.on("username proposal", username => {
    if (users.some(user => user.username == username)) {
      io.to(socket.id).emit("used username");
    } else {
      getUserFromSocket(socket, user => {
        if (user === undefined) {
          console.log(
            "Error: couldn't find user with id " + socket.id + " in DB!"
          );
          io.to(socket.id).emit("error finding user in DB");
        } else {
          user.username = username;
          io.to(socket.id).emit("accepted username", username);

          searchForChatRoom(socket, 0, true);
        }
      });
    }
  });

  socket.on("connected count", () => {
    io.in("general").clients((error, clients) => {
      if (error) console.log(error);
      io.to(socket.id).emit("connected count", clients.length);
    });
  });

  socket.on("chat message", msg => {
    findEmittingRoom(socket, emitting_room => {
      let username = findUsername(socket);
      if (emitting_room != undefined) {
        socket.broadcast.to(emitting_room).emit("chat message", {
          message: msg,
          sender: username,
        });
      } else {
        console.log(
          "Error: could not find emitting room while chat message received!"
        );
        io.to(socket.id).emit("message sending error");
      }
    });
  });

  socket.on("user typing", () => {
    findEmittingRoom(socket, emitting_room => {
      if (emitting_room != undefined) {
        socket.broadcast.to(emitting_room).emit("user typing");
      } else {
        console.log(
          "Error: could not find emitting room while user typing message received!"
        );
      }
    });
  });

  socket.on("disconnect", reason => {
    console.log(
      "<- socket " + socket.id + " just left ; cause: " + reason + " <-"
    );
    disconnectionHandler(socket);
  });
});

/*******************************************/
/* //////////// server start \\\\\\\\\\\\\ */
/*******************************************/
let port = 8080;

http.listen(port, () => {
  const DASHES = "-----------------------\n";
  console.log(DASHES + "Listening on port 8080\n" + DASHES);
});

module.exports = app;
