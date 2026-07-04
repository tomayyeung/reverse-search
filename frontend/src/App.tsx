import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { NavBar } from "@/components/NavBar";

const HomePage = lazy(() => import("./pages/home/Home"));
const CreatePage = lazy(() => import("./pages/create/Create"));
const HowToPlayPage = lazy(() => import("./pages/how-to-play/HowToPlay"));
const PlayPage = lazy(() => import("./pages/play/Play"));

function App() {
  return (
    <>
      <NavBar />
      <Suspense fallback={<p>Loading...</p>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/how-to-play" element={<HowToPlayPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/play/:puzzleId" element={<PlayPage />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App;
