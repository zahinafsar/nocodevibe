import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MainPage } from "./pages/MainPage";
import { SettingsPage } from "./pages/SettingsPage";
import "./styles/globals.css";
import "highlight.js/styles/github-dark.css";

export function App() {
  return (
    <BrowserRouter basename="/editor">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MainPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
