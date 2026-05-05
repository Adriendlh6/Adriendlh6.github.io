import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ShopRoute } from "./components/ShopRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OnboardingGate } from "./components/OnboardingGate";
import { AccessProvider } from "./contexts/AccessContext";
import { AuthProvider } from "./contexts/AuthContext";
import { MainLayout } from "./layouts/MainLayout";
import { LoginPage } from "./modules/auth/LoginPage";
import { RegisterPage } from "./modules/auth/RegisterPage";
import { OnboardingPage } from "./modules/onboarding/OnboardingPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { FournisseursPage } from "./modules/fournisseurs/FournisseursPage";
import { MercurialePage } from "./modules/mercuriale/MercurialePage";
import { ComptePage } from "./modules/compte/ComptePage";

/**
 * Routes de la webapp. Chaque module peut ajouter sa route ici.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<OnboardingGate />}>
              <Route
                element={
                  <AccessProvider>
                    <MainLayout />
                  </AccessProvider>
                }
              >
                <Route
                  index
                  element={
                    <ShopRoute permission="dashboard.read">
                      <DashboardPage />
                    </ShopRoute>
                  }
                />
                <Route
                  path="fournisseurs"
                  element={
                    <ShopRoute permission="suppliers.read">
                      <FournisseursPage />
                    </ShopRoute>
                  }
                />
                <Route
                  path="mercuriale"
                  element={
                    <ShopRoute permission="mercurial.read">
                      <MercurialePage />
                    </ShopRoute>
                  }
                />
                <Route path="compte" element={<ComptePage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
