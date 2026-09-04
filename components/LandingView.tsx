'use client';

import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ShieldCheck, Sparkles, BookOpen, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

interface LandingViewProps {
  onSignedIn?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      const message =
        err instanceof Error
          ? err.message.includes('popup-closed-by-user')
            ? 'Sign-in popup was closed before completing. Please try again.'
            : err.message
          : 'Failed to sign in with Google. Please try again.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="landing-container" className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between selection:bg-stone-200">
      {/* Top bar */}
      <header id="landing-header" className="w-full border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-medium shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold tracking-tight text-stone-900 text-base">Gemini Reflection Journal</span>
              <span className="ml-2 text-xs bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full font-mono">Isolated Firestore</span>
            </div>
          </div>

          <button
            id="btn-nav-signin"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition-all disabled:opacity-50 flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sign In</span>}
          </button>
        </div>
      </header>

      {/* Hero section */}
      <main id="landing-main" className="max-w-4xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center space-x-2 bg-stone-200/70 text-stone-800 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Zero Cross-User Data Access Guarantee</span>
          </div>

          <h1 id="landing-title" className="text-4xl sm:text-5xl font-serif tracking-tight text-stone-900 leading-tight">
            A quiet sanctuary for mindful thought, backed by Gemini intelligence.
          </h1>

          <p id="landing-subtitle" className="text-lg text-stone-600 max-w-2xl mx-auto font-sans leading-relaxed">
            Record multi-turn reflections, explore ideas through brainstorming, and receive structured synthesis. Your thoughts remain strictly isolated to your verified identity in Cloud Firestore.
          </p>

          {errorMsg && (
            <div id="landing-error-banner" className="max-w-md mx-auto p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start space-x-3 text-left">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Authentication Notice</p>
                <p className="mt-0.5 text-xs text-amber-800 leading-normal">{errorMsg}</p>
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="btn-google-signin"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-black text-white font-medium text-base transition-all flex items-center justify-center space-x-3 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-stone-300" />
                  <span>Connecting with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <span>Sign In with Google</span>
                  <ArrowRight className="w-4 h-4 ml-1 text-stone-400" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature pillars */}
        <div id="landing-features" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          <div id="card-feature-isolation" className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base">User-Isolated Storage</h3>
            <p className="mt-2 text-stone-600 text-sm leading-relaxed">
              Every journal thread is stored under <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded font-mono">/users/{'{userId}'}/interactions</code> with strict ABAC rules ensuring other users cannot read your thoughts.
            </p>
          </div>

          <div id="card-feature-gemini" className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base">Gemini 3.6 Flash Engine</h3>
            <p className="mt-2 text-stone-600 text-sm leading-relaxed">
              Equipped with our resilient fallback ladder (<code className="text-xs font-mono">3.6-flash &rarr; 3.1-flash-lite &rarr; latest</code>) for consistent, low-latency reflections and brainstorming.
            </p>
          </div>

          <div id="card-feature-synthesis" className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base">Multi-Turn Reflections</h3>
            <p className="mt-2 text-stone-600 text-sm leading-relaxed">
              Engage in multi-turn dialogues to explore your mindset, and request instant thematic summaries that pinpoint emotional epiphanies and mindful action anchors.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer id="landing-footer" className="w-full border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        <p>Built with Google Cloud Run &bull; Firebase Authentication &bull; Cloud Firestore &bull; Gemini API</p>
      </footer>
    </div>
  );
};
