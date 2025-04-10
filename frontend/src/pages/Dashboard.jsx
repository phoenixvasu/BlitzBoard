import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

function Dashboard({ session }) {
  const [documents, setDocuments] = useState([]);
  const [owners, setOwners] = useState({});
  const navigate = useNavigate();
  const userID = session.user.id;
  const userEmail = session.user.email;

  useEffect(() => {
    if (userID) fetchDocuments();
  }, [userID]);

  const formatTimeAgo = (timestamp) => {
    const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    if (diff < 60) return 'Active now';
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `Last edited ${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Last edited ${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `Last edited ${days} day${days > 1 ? 's' : ''} ago`;
  };

  const fetchDocuments = async () => {
    try {
      const { data: ownedDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', userID);

      const { data: sharedDocs, error: sharedError } = await supabase
        .from('documents')
        .select('*')
        .filter('shared_with', 'cs', `{${userEmail}}`);

      if (sharedError) console.error("❌ Shared docs fetch error:", sharedError.message);

      const docMap = new Map();
      if (ownedDocs) ownedDocs.forEach(doc => docMap.set(doc.id, doc));
      if (sharedDocs) sharedDocs.forEach(doc => docMap.set(doc.id, doc));
      const combinedDocs = Array.from(docMap.values()).sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
      );
      setDocuments(combinedDocs);

      const otherOwnerIDs = [
        ...new Set(combinedDocs.filter(doc => doc.owner_id !== userID).map(doc => doc.owner_id))
      ];

      if (otherOwnerIDs.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', otherOwnerIDs);

        const ownerMap = {};
        usersData.forEach(user => {
          ownerMap[user.id] = user.name || user.email;
        });
        setOwners(ownerMap);
      }
    } catch (err) {
      console.error("💥 Unexpected error in fetchDocuments:", err);
    }
  };

  const createNewDoc = async () => {
    const id = uuidv4();
    const { error } = await supabase.from('documents').insert([
      {
        id,
        title: '',
        content: '',
        updated_at: new Date().toISOString(),
        owner_id: userID,
        shared_with: [],
      },
    ]);

    if (error) {
      console.error('❌ Error creating document:', error.message);
      alert('Error creating document.');
      return;
    }

    navigate(`/editor/${id}`);
  };

  const handleShare = async (docID, currentSharedWith) => {
    const email = prompt("Enter the email of the user you'd like to share with:");
    if (!email) return;
  
    if (currentSharedWith.includes(email)) {
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
  
    const updatedList = [...currentSharedWith, email];
    const { error } = await supabase
      .from('documents')
      .update({ shared_with: updatedList })
      .eq('id', docID);
  
    if (error) {
      console.error("❌ Error updating document:", error.message);
      alert("Failed to share document.");
    } else {
      alert(`✅ Document shared with ${email}`);
      fetchDocuments(); // Refresh the dashboard
    }
  };
  

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen text-white px-6 py-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-bold">📚 Your BlitzBoard</h1>
          <p className="text-gray-400 mt-1">Welcome, {userEmail}</p>
        </div>
        <button
          onClick={logout}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-semibold"
        >
          Logout
        </button>
      </div>

      {/* Create Button */}
      <div className="mb-8">
        <button
          onClick={createNewDoc}
          className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl text-lg font-medium transition"
        >
          ➕ Create New Document
        </button>
      </div>

      {/* Document List */}
      {documents.length === 0 ? (
        <p className="text-gray-400 text-center mt-20">📭 No documents yet. Start by creating one!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {documents.map((doc) => {
            const contentPreview = (doc.content || '')
              .split('\n')
              .slice(0, 2)
              .join(' ')
              .trim()
              .slice(0, 140) + (doc.content.length > 140 ? '...' : '');

            const displayTitle = doc.title?.trim() || doc.content?.split('\n')[0]?.slice(0, 50) || 'Untitled';

            return (
              <div
                key={doc.id}
                className="bg-gray-800 hover:bg-gray-700 transition rounded-2xl shadow-lg p-5 flex flex-col justify-between min-h-[180px]"
              >
                <div>
                  <h2 className="text-xl font-semibold mb-1 line-clamp-1">{displayTitle}</h2>
                  <p className="text-gray-300 text-sm mb-3 line-clamp-2">{contentPreview || 'No content yet...'}</p>
                </div>

                <div className="mt-auto">
                  <p className="text-xs text-gray-400 mb-1">
                    🧠 Owner:{' '}
                    {doc.owner_id === userID ? 'You' : owners[doc.owner_id] || doc.owner_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-gray-500">{formatTimeAgo(doc.updated_at)}</p>

                  <div className="mt-4 flex gap-3">
  <button
    onClick={() => navigate(`/editor/${doc.id}`)}
    className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-sm font-medium"
  >
    ✏️ Edit
  </button>
  {doc.owner_id === userID && (
  <button
    onClick={() => handleShare(doc.id, doc.shared_with || [])}
    className="bg-purple-600 hover:bg-purple-700 px-4 py-1.5 rounded text-sm font-medium"
  >
    📤 Share
  </button>
)}

</div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
