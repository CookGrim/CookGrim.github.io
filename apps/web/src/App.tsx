import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PantryPage } from "./pages/PantryPage";
import { RecipeDetailPage } from "./pages/RecipeDetailPage";
import { RecipeFormPage } from "./pages/RecipeFormPage";
import { RecipesPage } from "./pages/RecipesPage";
import { SharedRecipePage } from "./pages/SharedRecipePage";
import { ShoppingListDetailPage } from "./pages/ShoppingListDetailPage";
import { ShoppingListsPage } from "./pages/ShoppingListsPage";
import { SignupPage } from "./pages/SignupPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/r/:token" element={<SharedRecipePage />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<RecipesPage />} />
          <Route path="recettes/nouvelle" element={<RecipeFormPage />} />
          <Route path="recettes/:id/modifier" element={<RecipeFormPage />} />
          <Route path="recettes/:id" element={<RecipeDetailPage />} />
          <Route path="courses" element={<ShoppingListsPage />} />
          <Route path="courses/:id" element={<ShoppingListDetailPage />} />
          <Route path="stock" element={<PantryPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
