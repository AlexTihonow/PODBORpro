import { useEffect } from "react";

import { AuthProvider } from "@/auth/AuthContext";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { ApplicationsPage } from "@/features/applications/ApplicationsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { DevComponentsPage } from "@/features/dev/DevComponentsPage";
import { FeedPage } from "@/features/feed/FeedPage";
import { LetterEditorPage } from "@/features/letters/LetterEditorPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { VacancyPage } from "@/features/vacancy/VacancyPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { navigate, usePathname } from "@/router";

export function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}

function Routes() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";

  if (pathname === "/") return <Redirect to="/feed" />;
  if (pathname === "/login") return <LoginPage />;
  if (pathname === "/register") return <RegisterPage />;
  if (pathname === "/dev/components") return <DevComponentsPage />;

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "feed") {
    return (
      <RequireAuth>
        <AppShell>
          <FeedPage />
        </AppShell>
      </RequireAuth>
    );
  }
  if (segments[0] === "vacancies" && segments[1]) {
    return (
      <RequireAuth>
        <AppShell>
          <VacancyPage id={Number(segments[1])} />
        </AppShell>
      </RequireAuth>
    );
  }
  if (segments[0] === "onboarding") {
    return (
      <RequireAuth>
        <AppShell>
          <OnboardingPage />
        </AppShell>
      </RequireAuth>
    );
  }
  if (segments[0] === "letters" && segments[1]) {
    return (
      <RequireAuth>
        <AppShell>
          <LetterEditorPage id={Number(segments[1])} />
        </AppShell>
      </RequireAuth>
    );
  }
  if (segments[0] === "applications") {
    return (
      <RequireAuth>
        <AppShell>
          <ApplicationsPage />
        </AppShell>
      </RequireAuth>
    );
  }

  return <NotFoundPage />;
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to);
  }, [to]);
  return null;
}
