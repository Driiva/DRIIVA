import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0 || !db || !user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        uid: user.id,
        rating,
        message: message.trim(),
        appVersion: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
        platform: 'web',
        screenContext: 'settings',
        timestamp: serverTimestamp(),
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setRating(0);
        setMessage('');
        setSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error('[Feedback] Write failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
    setRating(0);
    setMessage('');
    setSubmitted(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 sm:pb-12 sm:flex sm:items-end sm:justify-center"
          >
            <div className="w-full max-w-md mx-auto dashboard-glass-card p-6 rounded-2xl">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <div className="text-3xl mb-3">&#10024;</div>
                  <p className="text-white font-medium">
                    Thanks — you're helping make Driiva better
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-white">Share Feedback</h3>
                    <button
                      onClick={handleClose}
                      aria-label="Close feedback"
                      className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5 text-white/60" />
                    </button>
                  </div>

                  {/* Star rating */}
                  <div className="flex items-center gap-2 mb-5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform active:scale-90"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= (hoveredRating || rating)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-white/20'
                          }`}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="text-white/60 text-sm ml-2">{rating}/5</span>
                    )}
                  </div>

                  {/* Freetext */}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                    placeholder="What's on your mind?"
                    rows={3}
                    maxLength={500}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-teal-400/50 transition-colors mb-1"
                  />
                  <p className="text-white/55 text-xs text-right mb-5">
                    {message.length}/500
                  </p>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 rounded-xl text-white/60 text-sm font-medium hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={rating === 0 || submitting}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                    >
                      {submitting ? 'Sending...' : 'Submit'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
