import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { getMyCourier } from "@/lib/courier.functions";
import { AdminAuthScreen } from "./AdminAuthScreen";
import { TeamPinScreen } from "./TeamPinScreen";
import { PiratinoLogo } from "./PiratinoLogo";

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <PiratinoLogo size={64} />
      </motion.div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, operator } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchCourier = useServerFn(getMyCourier);

  // Kurier-Konten melden sich über die normale Anmeldung an (kein PIN)
  const { data: courierData, isLoading: courierLoading } = useQuery({
    queryKey: ["auth-my-courier", session?.user?.id ?? null],
    enabled: !!session && !operator,
    queryFn: () => fetchCourier({ data: {} as never }),
    staleTime: 60_000,
    retry: false,
  });

  const isCourier = !!courierData?.courier;

  useEffect(() => {
    if (isCourier && !operator && !pathname.startsWith("/kurier")) {
      void navigate({ to: "/kurier", replace: true });
    }
  }, [isCourier, operator, pathname, navigate]);

  if (loading) return <Splash />;
  if (!session) return <AdminAuthScreen />;
  if (!operator) {
    if (courierLoading) return <Splash />;
    if (isCourier) {
      if (!pathname.startsWith("/kurier")) return <Splash />;
      return <>{children}</>;
    }
    return <TeamPinScreen />;
  }
  return <>{children}</>;
}
