'use client';

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, testConnection } from '@/lib/firebase';
import { LandingView } from '@/components/LandingView';
import { Dashboard } from '@/components/Dashboard';
import { BookOpen, Loader2 } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate Firestore connection on boot
    testConnection();

    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        id="loading-screen"
        className="min-h-screen bg-stone-50 flex flex-col items-center justify-center space-y-4 text-stone-800"
      >
        <div className="w-12 h-12 rounded-2xl bg-stone-900 text-stone-50 flex items-center justify-center shadow-md animate-pulse">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="flex items-center space-x-2 text-sm font-medium text-stone-600">
          <Loader2 className="w-4 h-4 animate-spin text-stone-800" />
          <span>Connecting to your private sanctuary...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingView />;
  }

  return <Dashboard user={user} />;
}
