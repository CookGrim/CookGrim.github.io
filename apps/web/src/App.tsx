import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RecipeFormPage } from "./pages/RecipeFormPage";
import { RecipesPage } from "./pages/RecipesPage";
import { ShoppingListDetailPage } from "./pages/ShoppingListDetailPage";
import { ShoppingListsPage } from "./pages/ShoppingListsPage";
import { SignupPage } from "./pages/SignupPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<RecipesPage />} />
          <Route path="recettes/nouvelle" element={<RecipeFormPage />} />
          <Route path="courses" element={<ShoppingListsPage />} />
          <Route path="courses/:id" element={<ShoppingListDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
