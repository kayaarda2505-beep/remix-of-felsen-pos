import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/use-auth";
import { AdminAuthScreen } from "./AdminAuthScreen";
import { TeamPinScreen } from "./TeamPinScreen";
import { SaintsLogo } from "./SaintsLogo";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, operator } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <SaintsLogo size={64} />
        </motion.div>
      </div>
    );
  }

  if (!session) return <AdminAuthScreen />;
  if (!operator) return <TeamPinScreen />;
  return <>{children}</>;
}
