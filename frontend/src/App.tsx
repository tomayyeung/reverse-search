import { lazy, Suspense } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/react";
import { NavBar } from "@/components/NavBar";
import { Popup } from "@components/Popup";

const HomePage = lazy(() => import("./pages/home/Home"));
const CreatePage = lazy(() => import("./pages/create/Create"));
const HowToPlayPage = lazy(() => import("./pages/how-to-play/HowToPlay"));
const PlayPage = lazy(() => import("./pages/play/Play"));
const SearchPage = lazy(() => import("./pages/search/Search"));

function ProtectedCreateRoute() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  if (!isLoaded) {
    return <p>Loading...</p>;
  }

  if (isSignedIn) {
    return <CreatePage />;
  }

  return (
    <Popup
      text="Sign up or log in to create and share puzzles."
      confirmText="Sign up / log in"
      cancelText="Back to puzzles"
      closeOnConfirm={false}
      onConfirm={() => openSignIn({})}
      onCancel={() => navigate("/")}
    />
  );
}

function App() {
  return (
    <>
      <NavBar />
      <Suspense fallback={<p>Loading...</p>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/how-to-play" element={<HowToPlayPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/create" element={<ProtectedCreateRoute />} />
          <Route path="/play/:puzzleId" element={<PlayPage />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App;
