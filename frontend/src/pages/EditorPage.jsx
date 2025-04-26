import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import config from '../config';

// Generates a consistent color based on userID hash
function getUserColor(userID) {
  const colors = [
    '#F87171', // red
    '#FBBF24', // amber
    '#34D399', // green
    '#60A5FA', // blue
    '#A78BFA', // purple
    '#F472B6', // pink
    '#FACC15', // yellow
    '#2DD4BF', // teal
  ];
  let hash = 0;
  for (let i = 0; i < userID.length; i++) {
    hash = userID.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}


function EditorPage({ session }) {
  const { docID } = useParams();
  const userID = session?.user?.id;
  const userEmail = session?.user?.email;
  const userName = session?.user?.user_metadata?.name || userEmail;
  const [cursors, setCursors] = useState({});

  const [sharedUsers, setSharedUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [ownerID, setOwnerID] = useState('');
  const [sharedWith, setSharedWith] = useState([]);
  const [status, setStatus] = useState('Connecting...');
  const textAreaRef = useRef(null);

  const ws = useRef(null);
  const typingTimeout = useRef(null);
  const reconnectAttempts = useRef(0);

  const isOwner = userID === ownerID;
  const isSharedUser = sharedWith.includes(userEmail);
  const canEdit = isOwner || isSharedUser;

  useEffect(() => {
    const fetchDoc = async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('title, content, owner_id, shared_with')
        .eq('id', docID)
        .single();

      if (error) {
        console.error('❌ Error loading document:', error.message);
        setContent('// Failed to load document');
        return;
      }

      setTitle(data.title || 'Untitled');
      setContent(data.content || '');
      setOwnerID(data.owner_id);
      setSharedWith(data.shared_with || []);

      fetchSharedUserDetails(data.shared_with || []);
    };

    fetchDoc();
  }, [docID]);

  const fetchSharedUserDetails = async (emails) => {
    if (!emails || emails.length === 0) {
      setSharedUsers([]);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .in('email', emails);

    if (error) {
      console.error("❌ Failed to load shared user details:", error.message);
    } else {
      setSharedUsers(data);
    }
  };

  // ✨ Cursor Position Broadcasting
  useEffect(() => {
    const textarea = document.querySelector('textarea');
    if (!textarea || !canEdit) return;

    const handleCursorMove = () => {
      const position = textarea.selectionStart;
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: "cursor",
          userID,
          name: userName,
          position,
        }));
      }
    };

    textarea.addEventListener('keyup', handleCursorMove);
    textarea.addEventListener('click', handleCursorMove);

    return () => {
      textarea.removeEventListener('keyup', handleCursorMove);
      textarea.removeEventListener('click', handleCursorMove);
    };
  }, [userID, canEdit, userName]);

  // 🔌 WebSocket Connect + Presence Handling
  useEffect(() => {
    if (docID && userID) {
      fetchDoc();
      connectWebSocket();
    }

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, [docID, userID]);

  const connectWebSocket = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${config.wsProtocol}//${config.wsHost}${config.isProduction ? '' : ':' + config.wsPort}/ws/${docID}`;
    
    ws.current = new WebSocket(wsUrl);
    ws.current.onopen = () => {
      setStatus('Connected');
      reconnectAttempts.current = 0;
      
      // Send presence message
      ws.current.send(JSON.stringify({
        type: 'presence',
        userID,
        userName,
        color: getUserColor(userID)
      }));
    };

    ws.current.onclose = () => {
      setStatus('Disconnected');
      if (reconnectAttempts.current < 10) {
        reconnectAttempts.current += 1;
        setTimeout(connectWebSocket, 1000 * reconnectAttempts.current);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Error');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  };

  const handleWebSocketMessage = (message) => {
    // Handle presence messages
    if (message.type === 'presence') {
      setOnlineUsers(prev => {
        const updated = { ...prev };
        if (message.joined) {
          updated[message.userID] = message.name;
        } else {
          delete updated[message.userID];
        }
        return updated;
      });
      return;
    }

    // Handle cursor messages
    if (message.type === 'cursor') {
      setCursors(prev => ({
        ...prev,
        [message.userID]: {
          name: message.name,
          position: message.position,
          color: getUserColor(message.userID),
        },
      }));
      return;
    }

    // Handle edit messages
    if (message.userID !== userID && message.content) {
      setContent(message.content);
    }
  };

  const handleChange = (e) => {
    if (!canEdit) return;

    const newText = e.target.value;
    setContent(newText);

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "edit",
        userID,
        content: newText
      }));
      
    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => saveContent(newText), 1500);
  };

  const handleTitleChange = async (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    const { error } = await supabase
      .from('documents')
      .update({ title: newTitle })
      .eq('id', docID);

    if (error) console.error('❌ Error saving title:', error.message);
  };

  const saveContent = async (text) => {
    const { error } = await supabase
      .from('documents')
      .update({ content: text })
      .eq('id', docID);

    if (error) console.error('❌ Supabase save failed:', error.message);
  };

  const handleShare = async () => {
    const email = prompt("Enter the email of the user you'd like to share with:");
    if (!email) return;

    if (sharedWith.includes(email)) {
      alert("Already shared with this user.");
      return;
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      alert("❌ No user found with this email.");
      return;
    }

    const updatedList = [...sharedWith, email];
    const { error } = await supabase
      .from('documents')
      .update({ shared_with: updatedList })
      .eq('id', docID);

    if (error) {
      console.error("❌ Error updating document:", error.message);
      alert("Failed to share document.");
    } else {
      alert(`✅ Document shared with ${email}`);
      setSharedWith(updatedList);
      fetchSharedUserDetails(updatedList);
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col p-6 relative">
      <div className="flex justify-between items-center mb-4">
        <div>
          {isOwner ? (
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              className="text-xl font-bold bg-transparent border-b border-gray-500 outline-none"
            />
          ) : (
            <h2 className="text-xl font-semibold">{title}</h2>
          )}
        </div>
        <div className="text-right text-sm text-gray-400">
          <div>Status: {status}</div>
          <div>👤 {isOwner ? 'Owner' : isSharedUser ? 'Collaborator' : 'Read-only'}</div>
        </div>
      </div>
  
      {/* Container for textarea and cursor overlay */}
      <div className="relative flex-1">
        <textarea
          value={content}
          onChange={handleChange}
          readOnly={!canEdit}
          placeholder={
            canEdit ? 'Start typing your brilliant ideas...' : 'You can only view this document.'
          }
          className="w-full h-full bg-gray-800 text-white p-4 rounded resize-none focus:outline-none shadow-md"
          style={{ minHeight: '75vh', lineHeight: '1.5rem', fontFamily: 'monospace' }}
          ref={textAreaRef}
        />
  
        {/* 🖱️ Cursor Overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {Object.entries(cursors).map(([id, { name, position, color }]) => {
            if (!textAreaRef.current || position > content.length) return null;
  
            const textBeforeCursor = content.slice(0, position);
            const lines = textBeforeCursor.split('\n');
            const lineNumber = lines.length - 1;
            const charOffset = lines[lineNumber].length;
  
            const top = lineNumber * 24; // 24px line-height
            const left = charOffset * 8; // 8px per char (monospace approximation)
  
            return (
              <div
                key={id}
                className="absolute flex items-center text-xs"
                style={{ top, left }}
              >
                <div
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: color }}
                  title={name}
                />
                <span className="text-gray-400">{name}</span>
              </div>
            );
          })}
        </div>
      </div>
  
      <div className="flex items-center justify-between mt-4">
        {sharedUsers.length > 0 && (
          <div className="text-sm text-gray-400">
            👥 Shared with:
            <ul className="ml-4 list-disc">
              {sharedUsers.map((user) => (
                <li key={user.id}>
                  {user.name ? `${user.name} (${user.email})` : user.email}
                </li>
              ))}
            </ul>
          </div>
        )}
  
        {isOwner && (
          <button
            onClick={handleShare}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded shadow"
          >
            ➕ Share Document
          </button>
        )}
      </div>
  
      {/* 🧑‍🤝‍🧑 Active Collaborators */}
      {Object.keys(onlineUsers).length > 0 && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white rounded-xl px-4 py-2 shadow-lg z-50">
          <h4 className="text-sm font-semibold mb-1">🟢 Active Now:</h4>
          <ul className="text-xs space-y-1">
            {Object.entries(onlineUsers).map(([id, name]) => (
              <li key={id}>👤 {name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
  
}

export default EditorPage;
