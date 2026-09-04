'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, signOut } from 'firebase/auth';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, sanitizePayload } from '@/lib/firebase';
import { ChatMessage, ReflectionMode } from '@/lib/types';
import {
  BookOpen,
  Sparkles,
  Plus,
  Send,
  Trash2,
  LogOut,
  Compass,
  Lightbulb,
  FileText,
  Clock,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Menu,
  X,
} from 'lucide-react';

interface DashboardProps {
  user: User;
}

interface FirestoreInteraction {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  messages: ChatMessage[];
  summary?: string;
  createdAt: Timestamp | null | string;
  updatedAt: Timestamp | null | string;
}

const MODE_CONFIGS: Record<
  ReflectionMode,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string; placeholder: string }
> = {
  reflection: {
    label: 'Deep Reflection',
    icon: Compass,
    description: 'Explore feelings, challenges, and mindful perspectives with Gemini.',
    placeholder: 'What is on your mind today? Share a situation, thought, or feeling...',
  },
  brainstorm: {
    label: 'Creative Brainstorm',
    icon: Lightbulb,
    description: 'Generate inventive ideas, angles, and pathways forward.',
    placeholder: 'What problem or project are you brainstorming? Tell Gemini where you want to go...',
  },
  journal: {
    label: 'Mindful Journal',
    icon: BookOpen,
    description: 'Document your day and gain quiet, empathetic insights.',
    placeholder: 'Chronicle your experience, small moments of gratitude, or current head space...',
  },
  summary: {
    label: 'Synthesis & Summary',
    icon: FileText,
    description: 'Distill thoughts into core realizations and mindful action anchors.',
    placeholder: 'Paste notes or describe raw thoughts you want synthesized...',
  },
};

const PROMPT_STARTERS = [
  'What brought me a quiet moment of gratitude today?',
  'A challenge I am facing and how I might reframe it',
  'Brainstorm 3 fresh perspectives on my current dilemma',
  'Reflect on where I felt energy versus where I felt drained',
];

function createMessageId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [interactions, setInteractions] = useState<FirestoreInteraction[]>([]);
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<ReflectionMode>('reflection');
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<(() => Promise<void>) | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to user-isolated interactions
  useEffect(() => {
    if (!user?.uid) return;
    const path = `users/${user.uid}/interactions`;
    const q = query(collection(db, 'users', user.uid, 'interactions'), orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: FirestoreInteraction[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            userId: data.userId || user.uid,
            title: data.title || 'Untitled Reflection',
            mode: (data.mode as ReflectionMode) || 'reflection',
            messages: Array.isArray(data.messages) ? data.messages : [],
            summary: data.summary || undefined,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
          });
        });
        setInteractions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Current active interaction
  const activeInteraction = interactions.find((i) => i.id === activeInteractionId) || null;

  // Auto-scroll messages container
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeInteraction?.messages]);

  // Format Firestore timestamp safely
  const formatTimestamp = (ts: Timestamp | string | null | undefined): string => {
    if (!ts) return 'Just now';
    if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (typeof ts === 'string') {
      const parsed = new Date(ts);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
    return 'Just now';
  };

  const handleStartNewSession = () => {
    setActiveInteractionId(null);
    setInputText('');
    setErrorMessage(null);
    setPendingRetry(null);
    setSidebarOpen(false);
  };

  const handleSubmitPrompt = async (e?: React.FormEvent, promptOverride?: string) => {
    if (e) e.preventDefault();
    const promptToSend = (promptOverride || inputText).trim();
    if (!promptToSend || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setPendingRetry(null);

    const nowTimestamp = new Date().toISOString();

    const userMessage: ChatMessage = {
      id: createMessageId('msg-user'),
      role: 'user',
      content: promptToSend,
      timestamp: nowTimestamp,
    };

    // Prepare context for Gemini
    const existingMessages = activeInteraction?.messages || [];
    const contextMessages = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // 1. Send to server-side Gemini API route
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          mode: activeMode,
          contextMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const { reply, modelUsed, notice } = await response.json();
      if (notice) {
        setApiNotice(notice);
      }

      const assistantMessage: ChatMessage = {
        id: createMessageId('msg-gemini'),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
        modelUsed: modelUsed || 'gemini-3.6-flash',
      };

      const updatedMessages = [...existingMessages, userMessage, assistantMessage];

      // 2. Persist to Cloud Firestore with Guaranteed Transaction Verification
      if (activeInteractionId) {
        // Updating existing interaction
        const docPath = `users/${user.uid}/interactions/${activeInteractionId}`;
        const docRef = doc(db, 'users', user.uid, 'interactions', activeInteractionId);

        try {
          const payload = sanitizePayload({
            messages: updatedMessages,
            mode: activeMode,
            updatedAt: serverTimestamp(),
          });
          await updateDoc(docRef, payload);
        } catch (dbErr) {
          // Prepare retry action
          setPendingRetry(() => async () => {
            await updateDoc(docRef, sanitizePayload({ messages: updatedMessages, updatedAt: serverTimestamp() }));
          });
          handleFirestoreError(dbErr, OperationType.UPDATE, docPath);
        }
      } else {
        // Creating new interaction
        const newTitle = promptToSend.slice(0, 50).trim() + (promptToSend.length > 50 ? '...' : '');
        const newDocRef = doc(collection(db, 'users', user.uid, 'interactions'));
        const docPath = `users/${user.uid}/interactions/${newDocRef.id}`;

        try {
          const payload = sanitizePayload({
            id: newDocRef.id,
            userId: user.uid,
            title: newTitle,
            mode: activeMode,
            messages: updatedMessages,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(newDocRef, payload);
          setActiveInteractionId(newDocRef.id);
        } catch (dbErr) {
          setPendingRetry(() => async () => {
            const retryPayload = sanitizePayload({
              id: newDocRef.id,
              userId: user.uid,
              title: newTitle,
              mode: activeMode,
              messages: updatedMessages,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await setDoc(newDocRef, retryPayload);
            setActiveInteractionId(newDocRef.id);
          });
          handleFirestoreError(dbErr, OperationType.CREATE, docPath);
        }
      }

      // 3. Clear user input buffer ONLY after verified persistence
      setInputText('');
    } catch (err: unknown) {
      console.error('Submission failed:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      const cleanMsg = rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')
        ? 'The configured GEMINI_API_KEY is invalid. Please verify GEMINI_API_KEY in the AI Studio Settings > Secrets panel.'
        : rawMsg;
      setErrorMessage(
        cleanMsg.includes('Firestore Error')
          ? 'Failed to save to Firestore. Your draft has been preserved. Please click "Retry Save".'
          : `Failed to process reflection: ${cleanMsg}. Your draft is safely preserved below.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!activeInteraction || activeInteraction.messages.length === 0 || isSummarizing) return;

    setIsSummarizing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: activeInteraction.messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to synthesize summary');
      }

      const { summary, notice } = await response.json();
      if (notice) {
        setApiNotice(notice);
      }

      // Persist summary to Firestore
      const docPath = `users/${user.uid}/interactions/${activeInteraction.id}`;
      const docRef = doc(db, 'users', user.uid, 'interactions', activeInteraction.id);

      try {
        await updateDoc(
          docRef,
          sanitizePayload({
            summary,
            updatedAt: serverTimestamp(),
          })
        );
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.UPDATE, docPath);
      }
    } catch (err: unknown) {
      console.error('Summary synthesis error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Could not generate synthesis: ${msg}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDeleteInteraction = async (interactionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const docPath = `users/${user.uid}/interactions/${interactionId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'interactions', interactionId));
      if (activeInteractionId === interactionId) {
        setActiveInteractionId(null);
      }
      setDeleteConfirmId(null);
    } catch (dbErr) {
      handleFirestoreError(dbErr, OperationType.DELETE, docPath);
    }
  };

  const handleRetrySave = async () => {
    if (!pendingRetry) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await pendingRetry();
      setPendingRetry(null);
      setInputText('');
    } catch (err: unknown) {
      console.error('Retry save failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Retry failed: ${msg}. Your draft is still preserved.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CurrentModeIcon = MODE_CONFIGS[activeMode].icon;

  return (
    <div id="dashboard-container" className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <header id="dashboard-navbar" className="h-16 bg-white border-b border-stone-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            id="btn-toggle-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer"
            aria-label="Toggle Navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-medium shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-stone-900 text-sm sm:text-base tracking-tight">Gemini Reflection Journal</span>
              <span className="hidden sm:inline-block ml-2 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                Cloud Firestore Online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* User profile info */}
          <div id="user-profile-chip" className="flex items-center space-x-2 pl-2 pr-3 py-1 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-700">
            <div className="w-6 h-6 rounded-full bg-stone-900 text-stone-100 flex items-center justify-center font-semibold text-[10px]">
              {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : user.email ? user.email.slice(0, 2).toUpperCase() : 'ME'}
            </div>
            <span className="max-w-[140px] truncate hidden sm:inline font-medium">
              {user.displayName || user.email}
            </span>
          </div>

          <button
            id="btn-signout"
            onClick={() => signOut(auth)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar / History Drawer */}
        <aside
          id="dashboard-sidebar"
          className={`fixed md:static inset-y-16 left-0 z-20 w-72 sm:w-80 bg-stone-50 border-r border-stone-200 flex flex-col transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Action Header */}
          <div className="p-4 border-b border-stone-200 flex items-center justify-between">
            <button
              id="btn-new-reflection"
              onClick={handleStartNewSession}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-black text-white text-xs font-medium flex items-center justify-center space-x-2 shadow-xs cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Reflection Session</span>
            </button>
          </div>

          {/* Privacy isolation badge */}
          <div className="px-4 py-2.5 bg-stone-100/60 border-b border-stone-200/80 text-[11px] text-stone-600 flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="truncate">Isolated to uid: {user.uid.slice(0, 8)}...</span>
          </div>

          {/* History List */}
          <div id="history-list-container" className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
              Past Reflections ({interactions.length})
            </div>

            {interactions.length === 0 ? (
              <div id="history-empty-state" className="p-6 text-center text-xs text-stone-600 space-y-2">
                <BookOpen className="w-6 h-6 mx-auto text-stone-500" />
                <p>No reflections recorded yet.</p>
                <p className="text-[11px] text-stone-600">Begin by writing your first thought on the right.</p>
              </div>
            ) : (
              interactions.map((interaction) => {
                const isSelected = interaction.id === activeInteractionId;
                const ModeIcon = MODE_CONFIGS[interaction.mode]?.icon || Compass;

                return (
                  <div
                    key={interaction.id}
                    id={`history-item-${interaction.id}`}
                    onClick={() => {
                      setActiveInteractionId(interaction.id);
                      setActiveMode(interaction.mode);
                      setSidebarOpen(false);
                      setErrorMessage(null);
                    }}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-white border-stone-300 shadow-xs ring-1 ring-stone-400'
                        : 'bg-transparent border-transparent hover:bg-stone-200/60 text-stone-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <ModeIcon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        <h4 className="text-xs font-semibold text-stone-900 truncate">{interaction.title}</h4>
                      </div>

                      {deleteConfirmId === interaction.id ? (
                        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            id={`btn-confirm-delete-${interaction.id}`}
                            onClick={(e) => handleDeleteInteraction(interaction.id, e)}
                            className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                          >
                            Del
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-[10px] px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded hover:bg-stone-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`btn-delete-${interaction.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(interaction.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-600 transition-opacity rounded cursor-pointer"
                          title="Delete reflection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-600">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3 h-3 text-stone-500" />
                        <span>{formatTimestamp(interaction.updatedAt)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="w-3 h-3 text-stone-500" />
                        <span>{interaction.messages.length}</span>
                      </div>
                    </div>

                    {interaction.summary && (
                      <div className="mt-1.5 flex items-center space-x-1 text-[10px] text-stone-800 font-medium">
                        <Sparkles className="w-3 h-3 text-stone-600 shrink-0" />
                        <span className="truncate">Summary available</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Backdrop for mobile drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-xs z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Center / Right Stage */}
        <main id="dashboard-stage" className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Active Session Header */}
          <div id="session-header" className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-800 shadow-xs">
                <CurrentModeIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 id="session-title" className="text-base sm:text-lg font-serif font-semibold text-stone-900 leading-tight">
                  {activeInteraction ? activeInteraction.title : 'New Reflection Entry'}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {MODE_CONFIGS[activeMode].description}
                </p>
              </div>
            </div>

            {/* Mode Selector Buttons */}
            <div id="mode-selector-group" className="flex items-center space-x-1 bg-stone-200/70 p-1 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
              {(['reflection', 'brainstorm', 'journal', 'summary'] as ReflectionMode[]).map((mode) => {
                const isCurrent = activeMode === mode;
                const Icon = MODE_CONFIGS[mode].icon;
                return (
                  <button
                    key={mode}
                    id={`tab-mode-${mode}`}
                    onClick={() => setActiveMode(mode)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      isCurrent
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{MODE_CONFIGS[mode].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Banner with Retry Save Option */}
          {errorMessage && (
            <div
              id="interaction-error-banner"
              className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between shadow-xs"
            >
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Persistence Notice:</span> {errorMessage}
                </div>
              </div>
              {pendingRetry && (
                <button
                  id="btn-retry-save"
                  onClick={handleRetrySave}
                  disabled={isSubmitting}
                  className="ml-4 px-3 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-medium text-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>Retry Save</span>
                </button>
              )}
            </div>
          )}

          {/* Informational API Notice Banner */}
          {apiNotice && (
            <div
              id="api-notice-banner"
              className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-xs flex items-start justify-between shadow-xs"
            >
              <div className="flex items-start space-x-2.5">
                <Sparkles className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-stone-900">Engine Notice:</span> {apiNotice}
                </div>
              </div>
              <button
                id="btn-dismiss-notice"
                onClick={() => setApiNotice(null)}
                className="ml-3 p-0.5 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* Conversation & Reflection Turns */}
          <div id="messages-scroll-area" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* If interaction has an AI synthesis summary, highlight it */}
            {activeInteraction?.summary && (
              <div
                id="active-summary-card"
                className="p-5 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs space-y-2.5 text-stone-900"
              >
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <div className="flex items-center space-x-2 text-stone-900 font-semibold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-stone-800" />
                    <span>Gemini Reflection Synthesis</span>
                  </div>
                  <span className="text-[11px] text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded-full font-mono">
                    Structured Takeaway
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-stone-800 whitespace-pre-wrap leading-relaxed font-serif">
                  {activeInteraction.summary}
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {(!activeInteraction || activeInteraction.messages.length === 0) ? (
              <div id="welcome-session-box" className="max-w-xl mx-auto py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center text-stone-700">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-serif font-semibold text-stone-900">
                  Start Your {MODE_CONFIGS[activeMode].label}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  Write down whatever is present in your mind right now. Gemini 3.6 Flash will provide grounded inquiry, perspective, or ideas. Everything is automatically isolated to your Firestore profile.
                </p>

                {/* Prompt Starters */}
                <div className="pt-2 text-left space-y-2">
                  <p className="text-xs font-medium text-stone-600 text-center">Inspiration Prompts:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PROMPT_STARTERS.map((prompt, idx) => (
                      <button
                        key={idx}
                        id={`btn-starter-${idx}`}
                        onClick={() => {
                          setInputText(prompt);
                        }}
                        className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-white hover:border-stone-300 text-stone-700 text-xs text-left transition-all cursor-pointer flex items-center justify-between"
                      >
                        <span className="line-clamp-2">{prompt}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              activeInteraction.messages.map((message, index) => {
                const isUser = message.role === 'user';
                return (
                  <div
                    key={message.id || index}
                    id={`message-turn-${index}`}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-2 mb-1 text-[11px] text-stone-600 px-1">
                      <span className="font-semibold text-stone-800">
                        {isUser ? user.displayName || 'You' : 'Gemini AI'}
                      </span>
                      <span>&bull;</span>
                      <span>{formatTimestamp(message.timestamp)}</span>
                      {!isUser && message.modelUsed && (
                        <span className="bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded text-[10px] font-mono">
                          {message.modelUsed}
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-w-2xl px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                        isUser
                          ? 'bg-stone-900 text-stone-50 rounded-br-xs'
                          : 'bg-stone-50 border border-stone-200/90 text-stone-800 rounded-bl-xs font-serif'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Action Bar (Summary generation trigger if multi-turn) */}
          {activeInteraction && activeInteraction.messages.length >= 2 && !activeInteraction.summary && (
            <div id="summary-action-bar" className="px-4 sm:px-6 py-2 bg-stone-50/70 border-t border-stone-200/80 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                Ready to distill this conversation into an actionable takeaway?
              </span>
              <button
                id="btn-generate-summary"
                onClick={handleGenerateSummary}
                disabled={isSummarizing}
                className="px-3 py-1.5 rounded-lg bg-stone-200/80 hover:bg-stone-300 text-stone-800 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-stone-700" />
                    <span>Synthesize Key Takeaways</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Input Box & Submit Action Area */}
          <div id="input-composer-container" className="p-4 sm:p-5 border-t border-stone-200 bg-white">
            <form onSubmit={handleSubmitPrompt} className="space-y-2">
              <div className="relative">
                <textarea
                  id="input-reflection-prompt"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitPrompt();
                    }
                  }}
                  placeholder={MODE_CONFIGS[activeMode].placeholder}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full resize-none p-3.5 pr-14 text-xs sm:text-sm rounded-xl border border-stone-200 focus:border-stone-400 focus:ring-1 focus:ring-stone-400 outline-none transition-all placeholder:text-stone-400 text-stone-900 bg-stone-50/40 disabled:opacity-60"
                />

                <button
                  id="btn-submit-reflection"
                  type="submit"
                  disabled={!inputText.trim() || isSubmitting}
                  className="absolute bottom-3 right-3 w-9 h-9 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                  title="Send reflection (Enter)"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-stone-300" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-600 px-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>Verified transaction save to Firestore</span>
                </div>
                <span>Press Enter to send &bull; Shift + Enter for new line</span>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};
