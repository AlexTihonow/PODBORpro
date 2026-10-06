import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/auth/ProtectedRoute";
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

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/feed" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/dev/components", element: <DevComponentsPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/feed", element: <FeedPage /> },
          { path: "/vacancies/:id", element: <VacancyPage /> },
          { path: "/onboarding", element: <OnboardingPage /> },
          { path: "/letters/:id", element: <LetterEditorPage /> },
          { path: "/applications", element: <ApplicationsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
