/**
 * Login Page
 *
 * Provides two authentication paths:
 * 1. OAuth (Google, etc.) via the existing Manus OAuth flow
 * 2. Manual email + password via the new manualAuthRouter
 *
 * Security notes:
 * - Passwords are never stored or logged client-side
 * - Form validation prevents empty submissions
 * - Rate limiting is enforced server-side (15 attempts / 15 min)
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import type { Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

type AuthMode = "choose" | "login" | "register";

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, refresh } = useAuth();
  const [mode, setMode] = useState<AuthMode>("choose");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate("/chat");
    return null;
  }

  const loginMutation = trpc.auth.manual.login.useMutation({
    onSuccess: async () => {
      await refresh();
      navigate("/chat");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const registerMutation = trpc.auth.manual.register.useMutation({
    onSuccess: async () => {
      await refresh();
      navigate("/onboarding");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else if (mode === "register") {
      if (!name.trim()) {
        setError("Por favor ingresa tu nombre");
        return;
      }
      registerMutation.mutate({ name, email, password });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen bg-sanctuary flex items-center justify-center px-4">
      {/* Ambient background */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.78 0.15 75), transparent)" }}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <motion.div variants={fadeUp} custom={0} className="flex items-center justify-center gap-2 mb-8">
          <Sparkles className="w-6 h-6 text-primary" />
          <span className="font-display text-xl font-medium text-primary">Elevation</span>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={fadeUp}
          custom={1}
          className="glass rounded-2xl p-8 border border-white/10"
        >
          {/* Mode: Choose */}
          {mode === "choose" && (
            <>
              <h1 className="font-display text-2xl font-medium text-center mb-2">
                Bienvenido de vuelta
              </h1>
              <p className="text-sm text-muted-foreground text-center mb-8">
                Elige cómo quieres entrar a tu espacio
              </p>

              <div className="space-y-3">
                {/* OAuth button */}
                <Button
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  variant="outline"
                  className="w-full border-white/10 hover:bg-white/5"
                >
                  Continuar con Google / OAuth
                </Button>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-muted-foreground">o</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <Button
                  onClick={() => setMode("login")}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Entrar con correo
                </Button>

                <Button
                  onClick={() => setMode("register")}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Crear cuenta nueva
                </Button>
              </div>
            </>
          )}

          {/* Mode: Login or Register */}
          {(mode === "login" || mode === "register") && (
            <>
              <button
                onClick={() => { setMode("choose"); setError(null); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Volver
              </button>

              <h1 className="font-display text-xl font-medium mb-6">
                {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </h1>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name field (register only) */}
                {mode === "register" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre"
                      required
                      minLength={2}
                      maxLength={100}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                    />
                  </div>
                )}

                {/* Email field */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      required
                      autoComplete="email"
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Contraseña
                    {mode === "register" && (
                      <span className="ml-1 text-muted-foreground/60">(mín. 8 caracteres)</span>
                    )}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={mode === "register" ? 8 : 1}
                      maxLength={128}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{error}</p>
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading
                    ? "Procesando..."
                    : mode === "login"
                    ? "Entrar"
                    : "Crear cuenta"}
                </Button>
              </form>

              {/* Switch mode */}
              <p className="text-xs text-muted-foreground text-center mt-4">
                {mode === "login" ? (
                  <>
                    ¿No tienes cuenta?{" "}
                    <button
                      onClick={() => { setMode("register"); setError(null); }}
                      className="text-primary hover:underline"
                    >
                      Crear una
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta?{" "}
                    <button
                      onClick={() => { setMode("login"); setError(null); }}
                      className="text-primary hover:underline"
                    >
                      Iniciar sesión
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </motion.div>

        {/* Privacy note */}
        <motion.p
          variants={fadeUp}
          custom={2}
          className="text-xs text-muted-foreground text-center mt-4"
        >
          Tu privacidad está protegida por diseño. Tus mensajes nunca llegan sin anonimizar a terceros.
        </motion.p>
      </motion.div>
    </div>
  );
}
