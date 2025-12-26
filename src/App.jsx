import { BrowserRouter, Routes, Route } from "react-router-dom";

// AUTH PAGE
import LoginRegister from "./components/authentication/LoginRegister.jsx";

// MAIN LAYOUT (Sidebar + page content)
import LandingPage from "./components/pages/LandingPage.jsx";

// INDIVIDUAL PAGES (render inside <Outlet />)
import Feed from "./components/pages/Feed.jsx";
import Post from "./components/pages/Post.jsx";
import Messages from "./components/pages/Messages.jsx";
import Analytics from "./components/pages/Analytics.jsx";
import Users from "./components/pages/Users.jsx";
import Notifications from "./components/pages/Notifications.jsx";
import Profile from "./components/pages/Profile.jsx";
import Settings from "./components/pages/Settings.jsx";
import AboutUs from "./components/pages//AboutUs";


// Splash / animation page AFTER login
import SplashScreen from "./components/authentication/SplashScreen.jsx";

// Auth guard
import RequireAuth from "./components/pages/RequireAuth.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth page WITHOUT sidebar */}
        <Route path="/auth" element={<LoginRegister />} />

        {/* Splash animation AFTER successful login */}
        <Route
          path="/splash"
          element={
            <RequireAuth>
              <SplashScreen />
            </RequireAuth>
          }
        />

        {/* LandingPage contains Sidebar + nested content */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <LandingPage />
            </RequireAuth>
          }
        >
          {/* Default content inside layout */}
          <Route index element={<Feed />} />
          <Route path="feed" element={<Feed />} />
          <Route path="post" element={<Post />} />
          <Route path="messages" element={<Messages />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="users" element={<Users />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="about" element={<AboutUs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
