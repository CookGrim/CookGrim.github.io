import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RecipeFormPage } from "./pages/RecipeFormPage";
import { RecipesPage } from "./pages/RecipesPage";
import { ShoppingListPage } from "./pages/ShoppingListPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<RecipesPage />} />
        <Route path="recettes/nouvelle" element={<RecipeFormPage />} />
        <Route path="courses" element={<ShoppingListPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
