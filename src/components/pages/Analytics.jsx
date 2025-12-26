// src/features/Analytics/Analytics.jsx
import React, { useEffect, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import "../../styles/Analytics.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function Analytics() {
  const [overview, setOverview] = useState({
    followerCount: 0,
    followingCount: 0,
  });
  const [posts, setPosts] = useState([]);

  const [likesStats, setLikesStats] = useState({ monthly: [], yearly: [] });
  const [followersStats, setFollowersStats] = useState({
    monthly: [],
    yearly: [],
  });

  const [likesView, setLikesView] = useState("month");
  const [followersView, setFollowersView] = useState("month");

  const [selectedTitle, setSelectedTitle] = useState("Nothing selected");
  const [selectedItems, setSelectedItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  // ---------- INITIAL FETCH ----------
  useEffect(() => {
    if (!token) return;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError("");

        const [overviewRes, postsRes, likesRes, followersRes] = await Promise.all(
          [
            fetch(`${API_BASE}/api/analytics/overview`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_BASE}/api/analytics/posts`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_BASE}/api/analytics/likes-stats`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_BASE}/api/analytics/followers-stats`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]
        );

        if (
          !overviewRes.ok ||
          !postsRes.ok ||
          !likesRes.ok ||
          !followersRes.ok
        ) {
          throw new Error("Failed to load analytics");
        }

        const overviewData = await overviewRes.json();
        const postsData = await postsRes.json();
        const likesData = await likesRes.json();
        const followersData = await followersRes.json();

        setOverview({
          followerCount: overviewData.followerCount || 0,
          followingCount: overviewData.followingCount || 0,
        });
        setPosts(postsData);
        setLikesStats(likesData);
        setFollowersStats(followersData);
      } catch (err) {
        console.error(err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [token]);

  // ---------- CHART HELPERS ----------
  function buildMonthlyChartData(source, valueKey) {
    const dataPerMonth = Array(12).fill(0);

    source.forEach((row) => {
      const mIndex = (row.month || 1) - 1;
      if (mIndex >= 0 && mIndex < 12) {
        dataPerMonth[mIndex] = row[valueKey];
      }
    });

    return {
      labels: monthNames,
      datasets: [
        {
          label:
            valueKey === "likeCount"
              ? "Likes per month"
              : "New followers per month",
          data: dataPerMonth,
        },
      ],
    };
  }

  function buildYearlyChartData(source, valueKey) {
    const labels = source.map((r) => r.year);
    const data = source.map((r) => r[valueKey]);

    return {
      labels,
      datasets: [
        {
          label:
            valueKey === "likeCount"
              ? "Likes per year"
              : "New followers per year",
          data,
        },
      ],
    };
  }

  const likesChartData =
    likesView === "month"
      ? buildMonthlyChartData(likesStats.monthly || [], "likeCount")
      : buildYearlyChartData(likesStats.yearly || [], "likeCount");

  const followersChartData =
    followersView === "month"
      ? buildMonthlyChartData(followersStats.monthly || [], "followerCount")
      : buildYearlyChartData(followersStats.yearly || [], "followerCount");

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  // ---------- RIGHT PANEL LIST LOADER ----------
  async function loadList(endpoint, title) {
    if (!token) return;
    try {
      setListLoading(true);
      setSelectedTitle(title);
      setSelectedItems([]);

      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load list");

      const data = await res.json();
      setSelectedItems(data);
    } catch (err) {
      console.error(err);
      setSelectedTitle(title + " (error)");
      setSelectedItems([]);
    } finally {
      setListLoading(false);
    }
  }

  const handleFollowersClick = () =>
    loadList("/api/analytics/list/followers", "Followers");

  const handleFollowingClick = () =>
    loadList("/api/analytics/list/following", "Following");

  const handlePostLikesClick = (postId) =>
    loadList(`/api/analytics/list/post/${postId}/likes`, "Likes on this post");

  const handlePostCommentsClick = (postId) =>
    loadList(
      `/api/analytics/list/post/${postId}/comments`,
      "Comments on this post"
    );

  if (!token) {
    return (
      <div className="analytics-page">
        Please log in to view analytics.
      </div>
    );
  }

/* ----------------------------- BLOCK DEV TOOLS ----------------------------- */

  useEffect(() => {
  function onKeyDown(e) {
    const key = (e.key || "").toLowerCase();

    if (
      e.key === "F12" ||                 // 🔒 Block F12
      (e.ctrlKey &&
        e.shiftKey &&
        (key === "i" || key === "j" || key === "c")) ||
      (e.ctrlKey && key === "u")
    ) {
      e.preventDefault();
    }
  }

  function onContext(e) {
    e.preventDefault();                  // 🔒 Block right-click
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("contextmenu", onContext);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("contextmenu", onContext);
  };
}, []);

  return (
    <div className="analytics-page">
      <h1 className="analytics-title">Analytics</h1>

      {error && <div className="analytics-error">{error}</div>}

      <div className="analytics-layout">
        {/* LEFT SIDE */}
        <div className="analytics-main">
          {/* Counters */}
          <div className="analytics-top-counters">
            <div className="counter-card" onClick={handleFollowersClick}>
              <div className="counter-label">Followers</div>
              <div className="counter-value">{overview.followerCount}</div>
            </div>
            <div className="counter-card" onClick={handleFollowingClick}>
              <div className="counter-label">Following</div>
              <div className="counter-value">{overview.followingCount}</div>
            </div>
          </div>

          {/* Posts list */}
          <div className="analytics-posts-section">
            <h2 className="section-title">Your posts</h2>
            {loading ? (
              <div className="section-loading">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="section-empty">
                You haven&apos;t posted anything yet.
              </div>
            ) : (
              <div className="posts-list">
                {posts.map((post) => (
                  <div className="post-item" key={post.id}>
                    <div className="post-image">
                      {post.image_url ? (
                        <img src={post.image_url} alt="Post" />
                      ) : (
                        <div className="post-image-placeholder">IMAGE</div>
                      )}
                    </div>
                    <div className="post-content">
                      <p className="post-text">
                        {post.content || "No description"}
                      </p>
                      <div className="post-metrics">
                        <button
                          className="metric-badge"
                          onClick={() => handlePostLikesClick(post.id)}
                        >
                          ❤️ {post.likeCount}
                        </button>
                        <button
                          className="metric-badge"
                          onClick={() => handlePostCommentsClick(post.id)}
                        >
                          💬 {post.commentCount}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="analytics-charts">
            {/* Likes chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h2>Likes</h2>
                <div className="chart-toggle">
                  <button
                    className={likesView === "month" ? "active" : ""}
                    onClick={() => setLikesView("month")}
                  >
                    Month
                  </button>
                  <button
                    className={likesView === "year" ? "active" : ""}
                    onClick={() => setLikesView("year")}
                  >
                    Year
                  </button>
                </div>
              </div>
              <div className="chart-body">
                <Line data={likesChartData} options={chartOptions} />
              </div>
            </div>

            {/* Followers chart */}
            <div className="chart-card">
              <div className="chart-header">
                <h2>Followers</h2>
                <div className="chart-toggle">
                  <button
                    className={followersView === "month" ? "active" : ""}
                    onClick={() => setFollowersView("month")}
                  >
                    Month
                  </button>
                  <button
                    className={followersView === "year" ? "active" : ""}
                    onClick={() => setFollowersView("year")}
                  >
                    Year
                  </button>
                </div>
              </div>
              <div className="chart-body">
                <Bar data={followersChartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: list panel */}
        <div className="analytics-sidepanel">
          <h2 className="sidepanel-title">{selectedTitle}</h2>
          {listLoading ? (
            <div className="sidepanel-loading">Loading...</div>
          ) : selectedItems.length === 0 &&
            selectedTitle === "Nothing selected" ? (
            <div className="sidepanel-empty">
              Click on followers, following, likes or comments to view the list
              here.
            </div>
          ) : selectedItems.length === 0 ? (
            <div className="sidepanel-empty">No data.</div>
          ) : (
            <div className="sidepanel-list">
              {selectedItems.map((item) => (
                <div
                  className="sidepanel-item"
                  key={item.id + (item.created_at || "")}
                >
                  <div className="avatar">
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt={item.username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {item.display_name?.[0]?.toUpperCase() ||
                          item.username?.[0]?.toUpperCase() ||
                          "U"}
                      </div>
                    )}
                  </div>
                  <div className="member-info">
                    <div className="member-name">
                      {item.display_name || item.username}
                    </div>
                    <div className="member-username">@{item.username}</div>
                    {item.content && (
                      <div className="member-comment">“{item.content}”</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
