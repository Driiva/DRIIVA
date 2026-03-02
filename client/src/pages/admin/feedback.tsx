import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { ArrowLeft, Star, Monitor, Smartphone } from 'lucide-react';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface FeedbackDoc {
  id: string;
  uid: string;
  rating: number;
  message: string;
  platform: string;
  appVersion: string;
  timestamp: Timestamp | null;
}

function StarDisplay({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= count ? 'text-amber-400 fill-amber-400' : 'text-white/15'
          }`}
        />
      ))}
    </div>
  );
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '--';
  const d = ts.toDate();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminFeedback() {
  const [, setLocation] = useLocation();
  const [feedback, setFeedback] = useState<FeedbackDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeedback() {
      if (!db) return;
      try {
        const q = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        const docs: FeedbackDoc[] = snap.docs.map((doc) => ({
          id: doc.id,
          uid: doc.data().uid ?? '',
          rating: doc.data().rating ?? 0,
          message: doc.data().message ?? '',
          platform: doc.data().platform ?? 'unknown',
          appVersion: doc.data().appVersion ?? '--',
          timestamp: doc.data().timestamp ?? null,
        }));
        setFeedback(docs);
      } catch (err) {
        console.error('[AdminFeedback] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeedback();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 pb-16 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl w-full"
      >
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setLocation('/dashboard')}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">User Feedback</h1>
            <p className="text-white/50 text-xs">Admin dashboard</p>
          </div>
        </div>

        <div className="dashboard-glass-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="p-8 text-center text-white/40">
              No feedback submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Rating</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Message</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Platform</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Version</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <StarDisplay count={item.rating} />
                      </td>
                      <td className="px-4 py-3 text-white/80 max-w-md">
                        <p className="line-clamp-2">{item.message || '--'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-white/60">
                          {item.platform === 'web' ? (
                            <Monitor className="w-3.5 h-3.5" />
                          ) : (
                            <Smartphone className="w-3.5 h-3.5" />
                          )}
                          {item.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/50 font-mono text-xs">
                        {item.appVersion}
                      </td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                        {formatDate(item.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-white/30 text-xs mt-4 text-center">
          Showing {feedback.length} feedback entries
        </p>
      </motion.div>
    </div>
  );
}
