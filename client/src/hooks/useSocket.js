import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";

export function useSocket(roomId) {
  const { token } = useAuth();

  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token || !roomId) {
      setSocket(null);
      return;
    }

    const socketInstance = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
      {
        auth: {
          token,
        },
      }
    );

    setSocket(socketInstance);

    // Listen for successful connection
    socketInstance.on("connect", () => {
      console.log("Connected to Socket.io:", socketInstance.id);

      // Join the room after connecting
      socketInstance.emit("room:join", roomId);
    });

    // Listen for incoming messages
    const handleMessage = (message) => {
      setMessages((previousMessages) => [...previousMessages, message]);
    };

    socketInstance.on("chat:message", handleMessage);

    // Log connection errors
    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    // Cleanup when the component unmounts or dependencies change
    return () => {
      socketInstance.off("chat:message", handleMessage);
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [token, roomId]);

  // Send a message
  const sendMessage = useCallback(
    (text) => {
      if (!socket || !socket.connected) {
        console.error("Socket is not connected.");
        return;
      }

      if (typeof text !== "string" || !text.trim()) {
        return;
      }

      socket.emit("chat:message", {
        roomId,
        text: text.trim(),
      });
    },
    [socket, roomId]
  );

  return {
    messages,
    sendMessage,
  };
}