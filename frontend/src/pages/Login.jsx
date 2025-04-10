import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FcGoogle } from 'react-icons/fc';

const Login = () => {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });

    if (error) console.error('Login error:', error.message);
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;

        const { data: existing, error: lookupError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (lookupError && lookupError.code !== 'PGRST116') {
          console.error('❌ Error checking user existence:', lookupError.message);
          return;
        }

        if (!existing) {
          const { error: insertError } = await supabase.from('users').insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || 'Unnamed',
          });

          if (insertError) {
            console.error('❌ Error inserting new user:', insertError.message);
          } else {
            console.log('✅ New user added to users table');
          }
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    
    <div className="relative h-screen w-full bg-black overflow-hidden">

      {/* Background Image */}
      <img
        src="/bg.png"
        alt="background"
        className="absolute inset-0 object-cover w-full h-full opacity-30"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-gray-800 opacity-90" />

      {/* Login Card */}
      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-10 rounded-3xl shadow-2xl text-white max-w-md w-full text-center animate-fade-in-up">
          {/* Logo */}
          <div className="mb-6">
          <img
  src="/logo.png"
  alt="BlitzBoard Logo"
  className="w-[170px] h-[150px] mx-auto mb-2"
/>
            {/* <h1 className="text-4xl font-bold">BlitzBoard</h1> */}
            <p className="text-sm text-gray-300">Collaborate in real-time. Instantly.</p>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="flex items-center justify-center gap-3 bg-white text-gray-900 px-6 py-3 rounded-lg shadow hover:shadow-lg hover:bg-gray-100 transition-all w-full font-medium text-lg"
          >
            <FcGoogle className="text-2xl" />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
