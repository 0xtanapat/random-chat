const NOT_CONNECTED = 1;
const CONNECTION_PENDING = 2;
const NO_USERNAME = 3;
const USERNAME_PENDING = 4;
const ROOM_PENDING = 5;
const CHAT_ON = 6;

let status = NOT_CONNECTED;

let username;

const connect = () => {
  if (status === CONNECTION_PENDING) return;

  status = CONNECTION_PENDING;
  const socket = io();
  document.socket = socket;
  let connection_error_pending = setTimeout(connectionError, 3000);
  socket.on("connection success", () => {
    document.removeEventListener("keydown", enterKeyConnectAttempt);
    clearTimeout(connection_error_pending);
    status = NO_USERNAME;
    let message =
      "<font size=\"3\"><span uk-icon='icon: check; ratio: 1.5'></span>You are connected!</font>";
    UIkit.notification({
      message: message,
      pos: "bottom-center",
      status: "success",
    });

    welcomPageOverlayOff();
    document.addEventListener("keydown", enterKeyUsernameProp);
    socket.on("accepted username", usrnm => {
      status = ROOM_PENDING;
      username = usrnm;
      initChat(socket, username);
      let message =
        "<font size=\"3\"><span uk-icon='icon: check; ratio: 1.5'></span> Welcome </font>" +
        username +
        '<font size="3"> !</font>';
      UIkit.notification({
        message: message,
        pos: "bottom-center",
        status: "success",
      });

      usernameFormPageOverlayOff();
      socket.on("joined room", data => {
        setTimeout(spinnerPageOverlayOff, 700);
        let message =
          "<font size=\"3\"><span uk-icon='icon: users; ratio: 1.5'></span>You are in room no.</font>" +
          data.room +
          '<font size="3"> !</font>';
        UIkit.notification({
          message: message,
          pos: "bottom-center",
          status: "success",
        });
        status = CHAT_ON;
        document.addEventListener("keydown", enterKeySendsMsg);
        updateInterlocutorStatus(data.interlocutor);
      });
    });

    socket.on("used username", () => {
      status = NO_USERNAME;
      let message =
        "<font size=\"3\"><span uk-icon='icon: warning; ratio: 1.5'></span>Username already exists!</font>";
      UIkit.notification({
        message: message,
        pos: "bottom-center",
        status: "warning",
      });
      document.addEventListener("keydown", enterKeyUsernameProp);
    });
  });
};

const enterKeyConnectAttempt = e => {
  if (e.key === "Enter") connectionAttempt();
};
document.addEventListener("keydown", enterKeyConnectAttempt);

const enterKeyUsernameProp = e => {
  if (e.key === "Enter") setUsername(document.socket);
};

const enterKeySendsMsg = e => {
  if (e.key === "Enter") sendMessage(document.socket);
};

const connectionError = () => {
  let message =
    "<font size=\"3\"><span uk-icon='icon: warning; ratio: 1.5'></span>It looks like you're having trouble logging in...</font>";
  UIkit.notification({
    message: message,
    pos: "bottom-center",
    status: "warning",
  });
};

const welcomPageOverlayOff = () => {
  document.getElementById("welcomePage").style.height = "0%";
};

const usernameFormPageOverlayOff = () => {
  document.getElementById("usernameFormPage").style.height = "0%";
};

const spinnerPageOverlayOff = () => {
  document.getElementById("spinnerPage").style.height = "0%";
};

const setUsername = socket => {
  document.removeEventListener("keydown", enterKeyUsernameProp);
  if (status === USERNAME_PENDING) return;

  let username = document.getElementById("usernameInputField").value;

  if (username == "") {
    let message =
      "<font size=\"3\"><span uk-icon='icon: question; ratio: 1.5'></span>Lol, you don't have a name?</font>";
    UIkit.notification({ message: message, pos: "bottom-center" });
  } else if (username.length > 14) {
    let message =
      "<font size=\"3\"><span uk-icon='icon: warning; ratio: 1.5'></span>Your username is too long</font>";
    UIkit.notification({ message: message, pos: "bottom-center" });
  } else {
    status = USERNAME_PENDING;
    let message =
      "<font size=\"3\"><span uk-icon='icon: cog; ratio: 1.5'></span>Checking username availability... </font>";
    UIkit.notification({ message: message, pos: "bottom-center" });
    socket.emit("username proposal", username);
  }
};

const displayed_messages = document.getElementById("messages");

const sendMessage = socket => {
  let inputField = document.getElementById("userMessageInputField");
  let message = inputField.value;

  if (message == "") return;
  socket.emit("chat message", message);
  inputField.value = "";
  appendNewMessage(displayed_messages, message, true, username);
};

const getConnectedCount = socket => {
  socket.emit("connected count");
};

const connectionAttempt = () => {
  document.removeEventListener("keydown", enterKeyConnectAttempt);
  connect();
};

const checkUserIsTyping = socket => {
  let searchTimeout;
  document.getElementById("userMessageInputField").onkeypress = () => {
    if (searchTimeout != undefined) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      socket.emit("user typing");
    }, 250);
  };
};

const appendNewMessage = (displayed_messages, new_msg, source, username) => {
  let new_message_instance = document.createElement("div");
  let new_sub_msg_inst = document.createElement("div");
  new_message_instance.appendChild(new_sub_msg_inst);

  if (source) {
    new_message_instance.className += "outgoing_msg";
    new_sub_msg_inst.className += "sub_outgoing_msg";
  } else {
    new_message_instance.className += "incoming_msg";
    new_sub_msg_inst.className += "sub_incoming_msg";
  }

  new_sub_msg_inst.appendChild(document.createTextNode(new_msg));
  displayed_messages.appendChild(new_message_instance);
  // scroll to bottom
  displayed_messages.scrollTo(0, document.body.scrollHeight);
};

const updatePeopleCounter = count => {
  let people_counter = document.getElementById("peopleCounter");
  if (count > 1) {
    people_counter.innerText = count + " people online!";
  } else {
    people_counter.innerText = "It's so lonely here... :(";
  }
};

const updateInterlocutorStatus = interlocutor => {
  let interlocPrinter = document.getElementById("interloc");
  if (interlocutor == undefined) {
    interlocPrinter.innerText = "No one here just yet";
  } else {
    interlocPrinter.innerText = "You're talking with " + interlocutor;
  }
};

const resize_msg_input_area = () => {
  const text = document.getElementById("userMessageInputField");
  text.setAttribute(
    "style",
    "height:" + text.scrollHeight + "px; overflow-y:hidden;"
  );
  text.addEventListener(
    "input",
    () => {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
      if (this.value == "\n") this.value = "";
    },
    false
  );
};

const listenToIncomingMessages = socket => {
  socket.on("chat message", data => {
    appendNewMessage(displayed_messages, data.message, false, data.sender);
  });

  socket.on("user typing", () => {
    let notif =
      "<font size=\"2\"><span uk-icon='icon: commenting'></span>" +
      UIkit.notification({ message: notif, pos: "bottom-center" });
  });

  socket.on("join room", data => {
    let notif =
      "<font size=\"2\"><span uk-icon='icon: user'></span> " +
      data.newcommer +
      " has joined the room!</font>";
    UIkit.notification({ message: notif, pos: "top-right" });
    updatePeopleCounter(data.peoplecount);
  });

  socket.on("leave room", data => {
    let notif =
      "<font size=\"2\"><span uk-icon='icon: user'></span> " +
      data.leaver +
      " has left the room!</font>";
    UIkit.notification({ message: notif, pos: "top-right" });
    const count = data.peoplecount - 1;
    updatePeopleCounter(count);
  });

  socket.on("connected count", count => {
    updatePeopleCounter(count);
  });

  socket.on("join new room", data => {
    updateInterlocutorStatus(data.username);
  });

  socket.on("leaving", data => {
    updateInterlocutorStatus(data.username);
  });
};

const initChat = socket => {
  /* Get the number of people that connected */
  getConnectedCount(socket);
  /* Listen to incoming messages */
  listenToIncomingMessages(socket);
  /* Check if user is typing */
  checkUserIsTyping(socket);
  /* Dynamic text input area*/
  resize_msg_input_area();
};
