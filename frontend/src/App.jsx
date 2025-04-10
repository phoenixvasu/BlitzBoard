import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; // (create this next)
import EditorPage from './pages/EditorPage';

// export default function App() {
//   return (
//     <div className="min-h-screen bg-red-500 text-white flex items-center justify-center">
//       <h1 className="text-4xl font-bold">Tailwind is working 🎉</h1>
//     </div>
//   );
// }

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={session ? <Dashboard session={session} /> : <Login />} />
        <Route path="/editor/:docID" element={<EditorPage session={session}/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
