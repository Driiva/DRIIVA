import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import signinLogo from "@/assets/driiva-logo-CLEAR-FINAL.png";
import { useParallax } from "@/hooks/useParallax";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

/**
 * FORGOT PASSWORD PAGE
 * --------------------
 * Sends a password reset email via Firebase Auth.
 * No demo mode — real Firebase only.
 */

export default function ForgotPassword() {
    const [, setLocation] = useLocation();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { toast } = useToast();
    const { ref: cardRef, style: cardParallaxStyle } = useParallax({ speed: 0.3 });
    const errorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (error && errorRef.current) {
            errorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [error]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError(null);

        const trimmed = email.trim();
        if (!trimmed) {
            setError("Please enter your email address.");
            return;
        }

        if (!isFirebaseConfigured || !auth) {
            setError("Password reset is currently unavailable. Please try again later.");
            return;
        }

        setIsLoading(true);

        try {
            await sendPasswordResetEmail(auth, trimmed);
            setSuccess(true);
            toast({
                title: "Email sent",
                description: "Check your inbox for the password reset link.",
            });
        } catch (err: unknown) {
            const firebaseErr = err as { code?: string; message?: string };
            let errorMessage = "Failed to send reset email. Please try again.";

            if (firebaseErr.code === "auth/user-not-found") {
                // Don't reveal whether the email exists — show a generic success
                setSuccess(true);
                toast({
                    title: "Email sent",
                    description: "If an account exists with this email, you'll receive a reset link.",
                });
                return;
            } else if (firebaseErr.code === "auth/invalid-email") {
                errorMessage = "Invalid email address format.";
            } else if (firebaseErr.code === "auth/too-many-requests") {
                errorMessage = "Too many attempts. Please try again later.";
            } else if (firebaseErr.code === "auth/network-request-failed") {
                errorMessage = "Network error. Check your connection and try again.";
            }

            setError(errorMessage);
            toast({
                title: "Reset failed",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen text-white relative overflow-hidden">
            <div className="relative z-10 min-h-screen flex items-center justify-center px-5 py-12">
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    onClick={() => setLocation("/signin")}
                    className="absolute top-6 left-4 z-20 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-200"
                    aria-label="Back to sign in"
                >
                    <ArrowLeft className="w-5 h-5 text-white/90" />
                </motion.button>

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                        delay: 0.2,
                    }}
                    className="w-full max-w-sm"
                >
                    <Card
                        ref={cardRef}
                        className="w-full parallax-content"
                        style={{
                            background: "var(--app-surface-1)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            backdropFilter: "blur(20px)",
                            borderRadius: "20px",
                            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                            ...cardParallaxStyle,
                        }}
                    >
                        <CardContent className="px-5 py-5">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 25,
                                    delay: 0.4,
                                }}
                                className="flex flex-col items-center mb-4"
                            >
                                <img
                                    src={signinLogo}
                                    alt="Driiva"
                                    className="h-10 w-auto mb-2"
                                />
                                <h1 className="text-lg font-semibold text-white mb-1">
                                    Reset password
                                </h1>
                                <p className="text-center text-white/70 text-sm">
                                    Enter your email and we'll send you a reset link
                                </p>
                            </motion.div>

                            {success ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center space-y-4"
                                >
                                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-white font-semibold mb-1">Check your inbox</h2>
                                        <p className="text-white/60 text-sm">
                                            If an account exists with that email, you'll receive a password reset link shortly.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setLocation("/signin")}
                                        className="hero-cta-primary hero-cta-blue w-full"
                                        style={{ maxWidth: "100%" }}
                                    >
                                        Back to Sign In
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.form
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                    onSubmit={handleSubmit}
                                    className="space-y-4"
                                >
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-white/80">
                                            Email address
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                                            <Input
                                                type="email"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setError(null);
                                                }}
                                                className="signin-input pl-10"
                                                placeholder="you@example.com"
                                                required
                                                autoComplete="email"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <motion.div
                                            ref={errorRef}
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                                            style={{
                                                background: "rgba(220, 38, 38, 0.15)",
                                                border: "1px solid rgba(220, 38, 38, 0.3)",
                                            }}
                                        >
                                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-red-300 text-sm">{error}</span>
                                        </motion.div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isLoading || !isFirebaseConfigured}
                                        className="hero-cta-primary hero-cta-blue w-full"
                                        style={{ maxWidth: "100%" }}
                                        aria-label="Send reset link"
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                                />
                                                <span>Sending...</span>
                                            </div>
                                        ) : (
                                            <span>Send Reset Link</span>
                                        )}
                                    </button>

                                    <div className="text-center pt-2">
                                        <p className="text-white/60 text-sm">
                                            Remember your password?{" "}
                                            <button
                                                type="button"
                                                onClick={() => setLocation("/signin")}
                                                className="text-cyan-400 hover:text-cyan-300 font-medium"
                                            >
                                                Sign in
                                            </button>
                                        </p>
                                    </div>
                                </motion.form>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
