import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "../../styles/Messages.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");

  // 🔍 simple search term that filters conversation list
  const [searchTerm, setSearchTerm] = useState("");

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: null, // "message" | "chat"
    message: null,
  });

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const chatEndRef = useRef(null);
  const chatBodyRef = useRef(null); // <-- NEW: ref to chat container
  const token = localStorage.getItem("token");

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialUserIdFromURL = searchParams.get("userId"); // /messages?userId=5

  // Auto-scroll to bottom whenever messages change — scroll only the chat container
  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    // immediate jump to bottom of the chat container (keeps scroll inside the container)
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!token) {
      setError("You must be logged in to view messages.");
      return;
    }
    fetchCurrentUser();
    fetchConversations(); // initial load (also handles ?userId=)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, location.search]);

  // Close context menu on click / scroll
  useEffect(() => {
    const hideMenu = () => {
      setContextMenu((prev) =>
        prev.visible ? { ...prev, visible: false } : prev
      );
    };

    window.addEventListener("click", hideMenu);
    window.addEventListener("scroll", hideMenu);

    return () => {
      window.removeEventListener("click", hideMenu);
      window.removeEventListener("scroll", hideMenu);
    };
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) {
        throw new Error("Failed to load current user.");
      }
      const data = await resp.json();
      setCurrentUser(data.user || data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching current user.");
    }
  };

  const fetchMessages = async (userId) => {
    try {
      setLoadingMessages(true);
      const resp = await fetch(`${API_BASE}/api/messages/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) {
        throw new Error("Failed to load messages.");
      }
      const data = await resp.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching messages.");
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const resp = await fetch(`${API_BASE}/api/messages/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) {
        throw new Error("Failed to load conversations.");
      }
      const data = await resp.json();
      setConversations(data);

      // If opened from /messages?userId=XYZ:
      if (initialUserIdFromURL) {
        const idNum = Number(initialUserIdFromURL);
        if (!idNum) return;

        // 1) Already in conversations
        const existing = data.find((c) => c.user_id === idNum);
        if (existing) {
          setSelectedUser(existing);
          fetchMessages(existing.user_id);
          return;
        }

        // 2) Not in conversations yet → fetch user info
        const respUser = await fetch(`${API_BASE}/api/users/${idNum}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (respUser.ok) {
          const userPayload = await respUser.json();
          const u = userPayload.user || userPayload;

          const virtualConv = {
            user_id: u.id,
            username: u.username,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            last_message: null,
            last_message_time: null,
            unread_count: 0,
          };

          setConversations((prev) => {
            if (prev.some((c) => c.user_id === virtualConv.user_id)) return prev;
            return [virtualConv, ...prev];
          });

          setSelectedUser(virtualConv);
          fetchMessages(u.id);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching conversations.");
    } finally {
      setLoadingConversations(false);
    }
  };

  // 🔁 Lightweight refresh for "liveliness" (no loading spinners)
  const refreshConversations = async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setConversations(data);
    } catch (err) {
      console.error("Error refreshing conversations:", err);
    }
  };

  const refreshMessages = async () => {
    if (!token || !selectedUser) return;
    try {
      const resp = await fetch(
        `${API_BASE}/api/messages/${selectedUser.user_id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!resp.ok) return;
      const data = await resp.json();

      // Avoid unnecessary state updates if nothing changed
      setMessages((prev) => {
        if (prev.length === data.length) {
          const lastPrev = prev[prev.length - 1];
          const lastNew = data[data.length - 1];
          if (
            lastPrev &&
            lastNew &&
            lastPrev.id === lastNew.id &&
            lastPrev.message === lastNew.message
          ) {
            return prev;
          }
        }
        return data;
      });
    } catch (err) {
      console.error("Error refreshing messages:", err);
    }
  };

  // 🕒 Poll every 3s for new messages / updated conversations
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refreshConversations();
      if (selectedUser) {
        refreshMessages();
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedUser]);

  const handleSelectConversation = (convUser) => {
    setSelectedUser(convUser);
    setError("");
    setEditingMessageId(null);
    setContextMenu({ visible: false, x: 0, y: 0, type: null, message: null });
    fetchMessages(convUser.user_id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedUser) {
      setError("Please select a conversation first.");
      return;
    }

    const trimmed = newMessage.trim();
    if (!trimmed) return;

    try {
      setSending(true);
      const resp = await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reciever_id: selectedUser.user_id,
          message: trimmed,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to send message.");
      }

      const created = await resp.json();

      // Append new message to chat
      setMessages((prev) => [...prev, created]);

      // Update conversations list
      setConversations((prev) => {
        const exists = prev.some((c) => c.user_id === selectedUser.user_id);

        const updatedEntry = {
          ...selectedUser,
          last_message: created.message,
          last_message_time: created.created_at,
          unread_count: selectedUser.unread_count ?? 0,
        };

        if (!exists) {
          return [updatedEntry, ...prev];
        }

        const updated = prev.map((c) =>
          c.user_id === selectedUser.user_id ? updatedEntry : c
        );

        updated.sort((a, b) => {
          if (!a.last_message_time && !b.last_message_time) return 0;
          if (!a.last_message_time) return 1;
          if (!b.last_message_time) return -1;
          return new Date(b.last_message_time) - new Date(a.last_message_time);
        });

        return updated;
      });

      setSelectedUser((prev) =>
        prev
          ? {
              ...prev,
              last_message: created.message,
              last_message_time: created.created_at,
            }
          : prev
      );

      setNewMessage("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error sending message.");
    } finally {
      setSending(false);
    }
  };

  // ----- Search: filter conversations live -----

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredConversations = normalizedSearch
    ? conversations.filter((conv) => {
        const text = (
          conv.display_name ||
          conv.username ||
          ""
        ).toLowerCase();
        return text.includes(normalizedSearch);
      })
    : conversations;

  // ----- Right-click handlers -----

  const handleMessageContextMenu = (e, msg) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: "message",
      message: msg,
    });
  };

  const handleChatBodyContextMenu = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: "chat",
      message: null,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, type: null, message: null });
  };

  // ----- Edit message -----

  const startEditMessage = () => {
    if (!contextMenu.message) return;
    setEditingMessageId(contextMenu.message.id);
    setEditingText(contextMenu.message.message || "");
    closeContextMenu();
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleEditMessageSubmit = async (e, messageId) => {
    e.preventDefault();
    const trimmed = editingText.trim();
    if (!trimmed) return;

    try {
      const resp = await fetch(`${API_BASE}/api/messages/${messageId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update message.");
      }

      const updated = await resp.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === updated.id ? { ...m, message: updated.message } : m
        )
      );

      await refreshConversations();

      setEditingMessageId(null);
      setEditingText("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error updating message.");
    }
  };

  // ----- Delete message -----

  const handleDeleteMessage = async () => {
    const msg = contextMenu.message;
    if (!msg) return;

    try {
      const resp = await fetch(`${API_BASE}/api/messages/${msg.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to delete message.");
      }

      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      closeContextMenu();

      await refreshConversations();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error deleting message.");
    }
  };

  // ----- Delete entire chat -----

  const handleDeleteChat = async () => {
    if (!selectedUser) return;
    try {
      const resp = await fetch(
        `${API_BASE}/api/messages/chat/${selectedUser.user_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to delete chat.");
      }

      closeContextMenu();
      setMessages([]);
      setSelectedUser(null);

      await refreshConversations();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error deleting chat.");
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatLastMessageTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const getInitials = (user) => {
    const name = user.display_name || user.username || "";
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Check if a message is authored by current user
  const isMyMessage = (msg) =>
    currentUser && msg.sender_id === currentUser.id;

  return (
    <div className="messages-page">
      <div className="messages-layout">
        {/* Sidebar */}
        <aside className="messages-sidebar">
          <div className="messages-sidebar-header">
            <h2>Messages</h2>
            <span className="messages-sidebar-subtitle">
              Chat with your friends
            </span>
          </div>

          {/* 🔍 Live filter for conversations */}
          <div className="messages-search">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>

          {loadingConversations ? (
            <div className="messages-sidebar-loading">Loading chats...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="messages-sidebar-empty">
              {normalizedSearch
                ? `No users found for "${normalizedSearch}".`
                : (
                  <>
                    No conversations yet.
                    <br />
                    Start messaging users from their profile.
                  </>
                )}
            </div>
          ) : (
            <ul className="messages-conversation-list">
              {filteredConversations.map((conv) => (
                <li
                  key={conv.user_id}
                  className={`messages-conversation-item ${
                    selectedUser && selectedUser.user_id === conv.user_id
                      ? "active"
                      : ""
                  }`}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <div className="messages-conversation-avatar">
                    {conv.avatar_url ? (
                      <img src={conv.avatar_url} alt={conv.username} />
                    ) : (
                      <span>{getInitials(conv)}</span>
                    )}
                  </div>
                  <div className="messages-conversation-main">
                    <div className="messages-conversation-top">
                      <span className="messages-conversation-name">
                        {conv.display_name || conv.username}
                      </span>
                      {conv.last_message_time && (
                        <span className="messages-conversation-time">
                          {formatLastMessageTime(conv.last_message_time)}
                        </span>
                      )}
                    </div>
                    <div className="messages-conversation-bottom">
                      <span className="messages-conversation-preview">
                        {conv.last_message || "Start a conversation"}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="messages-conversation-unread">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Main chat area */}
        <main className="messages-main">
          {error && (
            <div className="messages-alert messages-alert-error">{error}</div>
          )}

          <div className="messages-main-inner">
            {!selectedUser ? (
              <div className="messages-empty-state">
                <div className="messages-empty-icon">💬</div>
                <h3>Select a conversation</h3>
                <p>Choose someone from the left to start chatting.</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <header className="messages-chat-header">
                  <div className="messages-chat-header-left">
                    <div className="messages-chat-avatar">
                      {selectedUser.avatar_url ? (
                        <img
                          src={selectedUser.avatar_url}
                          alt={selectedUser.username}
                        />
                      ) : (
                        <span>{getInitials(selectedUser)}</span>
                      )}
                    </div>
                    <div className="messages-chat-user">
                      <span className="messages-chat-name">
                        {selectedUser.display_name || selectedUser.username}
                      </span>
                      <span className="messages-chat-username">
                        @{selectedUser.username}
                      </span>
                    </div>
                  </div>
                </header>

                {/* Messages list */}
                <div
                  className="messages-chat-body"
                  onContextMenu={handleChatBodyContextMenu}
                  ref={chatBodyRef} // <-- NEW: attach container ref
                >
                  {loadingMessages ? (
                    <div className="messages-chat-loading">
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="messages-chat-empty">
                      No messages yet. Say hi 👋
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const mine = isMyMessage(msg);
                      const isEditing = editingMessageId === msg.id;

                      return (
                        <div
                          key={msg.id}
                          className={`messages-bubble-row ${
                            mine ? "mine" : "theirs"
                          }`}
                          onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                        >
                          {!mine && (
                            <div className="messages-bubble-avatar">
                              {selectedUser.avatar_url ? (
                                <img
                                  src={selectedUser.avatar_url}
                                  alt={selectedUser.username}
                                />
                              ) : (
                                <span>{getInitials(selectedUser)}</span>
                              )}
                            </div>
                          )}
                          <div className="messages-bubble">
                            {isEditing ? (
                              <form
                                className="messages-edit-form"
                                onSubmit={(e) =>
                                  handleEditMessageSubmit(e, msg.id)
                                }
                              >
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) =>
                                    setEditingText(e.target.value)
                                  }
                                  autoFocus
                                  onBlur={cancelEdit}
                                />
                              </form>
                            ) : (
                              <p className="messages-bubble-text">
                                {msg.message}
                              </p>
                            )}
                            <span className="messages-bubble-time">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Message input */}
                <form
                  className="messages-input-bar"
                  onSubmit={handleSendMessage}
                >
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Right-click context menu */}
          {contextMenu.visible && (
            <div
              className="messages-context-menu"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              {contextMenu.type === "message" && contextMenu.message && (
                <>
                  {currentUser &&
                    contextMenu.message.sender_id === currentUser.id && (
                      <>
                        <button
                          type="button"
                          className="messages-context-item"
                          onClick={startEditMessage}
                        >
                          Edit message
                        </button>
                        <button
                          type="button"
                          className="messages-context-item danger"
                          onClick={handleDeleteMessage}
                        >
                          Delete message
                        </button>
                        <hr className="messages-context-divider" />
                      </>
                    )}
                  <button
                    type="button"
                    className="messages-context-item danger"
                    onClick={handleDeleteChat}
                  >
                    Delete entire chat
                  </button>
                </>
              )}

              {contextMenu.type === "chat" && (
                <button
                  type="button"
                  className="messages-context-item danger"
                  onClick={handleDeleteChat}
                >
                  Delete entire chat
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
