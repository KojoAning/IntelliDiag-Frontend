import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaBell } from "react-icons/fa";
import { FiLogOut, FiChevronRight, FiCheck } from "react-icons/fi";
import { HiUsers } from "react-icons/hi2";
import { useNavigate, useLocation } from "react-router-dom";
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from "../../../lib/api";

const avatarColors = ["#0694FB", "#7C3AED", "#059669", "#DC2626", "#D97706"];

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function notifInitials(title = "") {
  return title.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "N";
}

function NotificationItem({ n, index, onRead }) {
  const isUnread = !n.is_read;
  return (
    <div
      onClick={() => isUnread && onRead(n.id)}
      className="notif-item flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-200"
      style={{
        background: isUnread ? "rgba(6,148,251,0.07)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isUnread ? "rgba(6,148,251,0.18)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
        style={{ backgroundColor: avatarColors[index % avatarColors.length] }}
      >
        {notifInitials(n.title)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-white text-[13px] font-medium m-0 truncate">{n.title}</p>
          <span className="text-white/40 text-[11px] shrink-0">{timeAgo(n.created_at)}</span>
        </div>
        {n.message && <p className="text-white/50 text-[12px] m-0 mt-0.5 truncate">{n.message}</p>}
      </div>
      {isUnread && <div className="w-2 h-2 rounded-full bg-[#0694FB] shrink-0" />}
    </div>
  );
}

function getBreadcrumbs(pathname) {
  if (pathname.startsWith("/cases/")) {
    return [
      { label: "Cases",           path: "/cases" },
      { label: "Patient Details", path: null },
    ];
  }
  if (pathname === "/case-workspace/viewer") {
    return [
      { label: "Cases",     path: "/cases" },
      { label: "Series",    path: "/case-workspace" },
      { label: "Viewer",    path: null },
    ];
  }
  if (pathname === "/case-workspace") {
    return [
      { label: "Cases",  path: "/cases" },
      { label: "Series", path: null },
    ];
  }
  const MAP = {
    "/dashboard": [{ label: "Dashboard",      path: null }],
    "/cases":     [{ label: "Cases",          path: null }],
    "/calendar":  [{ label: "Calendar",       path: null }],
    "/new-case":  [{ label: "New Case",       path: null }],
    "/jobs":             [{ label: "Inference Jobs",  path: null }],
    "/settings":        [{ label: "Settings",        path: null }],
    "/patient-reports": [{ label: "Patient Reports", path: null }],
  };
  return MAP[pathname] ?? [];
}

function Appbar() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [collabOpen, setCollabOpen] = useState(false);
  const collabRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const { pathname, state: locationState } = useLocation();
  const breadcrumbs = getBreadcrumbs(pathname);

  const userName = localStorage.getItem("name") || "User";
  const userRole = localStorage.getItem("role") || "";

  // ── Notifications state ────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setUnreadCount(data?.count ?? data?.unread_count ?? 0);
    } catch { /* silently ignore */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const data = await getNotifications({ limit: 20 });
      setNotifications(Array.isArray(data) ? data : data?.items ?? []);
    } catch { /* silently ignore */ } finally {
      setNotifLoading(false);
    }
  }, []);

  // Fetch unread count once on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleMarkRead = useCallback(async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { /* silently ignore */ }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silently ignore */ } finally {
      setMarkingAll(false);
    }
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (collabRef.current && !collabRef.current.contains(e.target)) setCollabOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="bg-[#0D0D0D] px-[27px] py-[10px] w-full flex flex-row items-center justify-between box-border rounded-[15px] relative z-50">
      <div className="flex items-center gap-3">
        <img src="/intellidiag.png" alt="IntelliDiag Logo" className="h-[23px] w-auto" />

        {breadcrumbs.length > 0 && (
          <>
            <div className="w-px h-4 bg-[#2a2a2a]" />
            <nav className="flex items-center gap-1">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <FiChevronRight size={11} className="text-[#3a3a3a] shrink-0" />}
                    {crumb.path && !isLast ? (
                      <button
                        onClick={() => navigate(crumb.path, { state: locationState })}
                        className="text-[#6B6B6B] hover:text-white text-[14px] bg-transparent border-none cursor-pointer p-0 transition-colors"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span className={`text-[14px] font-medium px-2 py-0.5 rounded-md ${isLast ? "text-[#0694FB] bg-[rgba(6,148,251,0.12)]" : "text-[#6B6B6B]"}`}>
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </>
        )}
      </div>

      <div className="flex flex-row items-center gap-2">
        {/* Collaborators */}
        <div ref={collabRef} className="relative">
          <button
            onClick={() => setCollabOpen(v => !v)}
            className="relative flex items-center gap-2 border-none cursor-pointer overflow-hidden transition-all duration-300"
            style={{
              background: collabOpen ? "#FF8C00" : "transparent",
              borderRadius: "999px",
              padding: collabOpen ? "6px 16px" : "6px 8px",
            }}
          >
            <HiUsers size={15} style={{ color: collabOpen ? "white" : "#FF8C00", flexShrink: 0 }} />
            <span
              className="text-white text-[13px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-300"
              style={{
                maxWidth: collabOpen ? "140px" : "0px",
                opacity: collabOpen ? 1 : 0,
              }}
            >
              Collaborators
            </span>
          </button>

          {collabOpen && (
            <div
              className="absolute right-0 top-[calc(100%+10px)] w-[300px] rounded-[22px] overflow-hidden shadow-2xl"
              style={{
                background: "rgba(30,30,30,0.72)",
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.08)",
                animation: "notifFadeIn 0.18s ease forwards",
              }}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-white text-[13px] font-medium m-0">Collaborators</p>
                {/* <button className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-[#0694FB] hover:bg-[#0578d1] text-white border-none cursor-pointer transition-colors">
                  <FiUserPlus size={12} />
                  Invite
                </button> */}
              </div>
              <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
                <HiUsers size={24} className="text-[#2a2a2a]" />
                <p className="text-[#3a3a3a] text-[12px] m-0 text-center">No current collaborators</p>
              </div>
            </div>
          )}
        </div>

        {/* Notification bell */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative flex items-center gap-2 border-none cursor-pointer overflow-hidden transition-all duration-300"
            style={{
              background: open ? "#0694FB" : "transparent",
              borderRadius: "999px",
              padding: open ? "6px 16px" : "6px 8px",
            }}
          >
            <FaBell size={15} color="white" style={{ opacity: open ? 1 : undefined, color: open ? "white" : "#0694FB", flexShrink: 0 }} />
            <span
              className="text-white text-[13px] font-semibold whitespace-nowrap overflow-hidden transition-all duration-300"
              style={{
                maxWidth: open ? "120px" : "0px",
                opacity: open ? 1 : 0,
              }}
            >
              Notification
            </span>
            {/* unread badge — hide when open */}
            {!open && unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#FF6B35] rounded-full border-2 border-[#0D0D0D] flex items-center justify-center text-white text-[9px] font-bold leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div
              className="absolute right-0 top-[calc(100%+10px)] w-[320px] rounded-[22px] overflow-hidden shadow-2xl"
              style={{
                background: "rgba(30,30,30,0.72)",
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.08)",
                animation: "notifFadeIn 0.18s ease forwards",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-white text-[13px] font-medium m-0">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 text-[11px] text-[#0694FB] font-normal">{unreadCount} unread</span>
                  )}
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    className="flex items-center gap-1 text-[11px] text-[#0694FB] hover:text-white bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {markingAll
                      ? <span className="w-3 h-3 border border-[#0694FB]/40 border-t-[#0694FB] rounded-full animate-spin" />
                      : <FiCheck size={11} />}
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="flex flex-col gap-2 px-3 pb-3 max-h-[380px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {notifLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="w-5 h-5 border-2 border-[#0694FB]/30 border-t-[#0694FB] rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <FaBell size={20} className="text-[#6B6B6B]" />
                    <p className="text-[#6B6B6B] text-[12px] m-0">No notifications</p>
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <NotificationItem key={n.id} n={n} index={i} onRead={handleMarkRead} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="inline-flex justify-start items-center gap-3 bg-transparent border-none cursor-pointer rounded-xl px-2 py-1 hover:bg-white/5 transition-colors"
          >
            <img
              className="w-11 h-11 rounded-full"
              src={`https://api.dicebear.com/9.x/initials/jpg?seed=${encodeURIComponent(userName)}&scale=70`}
              alt="avatar"
            />
            <div className="inline-flex flex-col justify-start items-start">
              <div className="text-white/50 text-[10px] font-medium uppercase font-[Inter]">{userRole}</div>
              <div className="text-white/80 text-sm font-medium font-[Inter]">{userName}</div>
            </div>
          </button>

          {/* Profile popover */}
          {profileOpen && (
            <div
              className="absolute right-0 top-[calc(100%+10px)] w-[200px] rounded-[18px] overflow-hidden shadow-2xl"
              style={{
                background: "rgba(30,30,30,0.85)",
                backdropFilter: "blur(28px)",
                WebkitBackdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.08)",
                animation: "notifFadeIn 0.15s ease forwards",
              }}
            >
              {/* Profile header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                <img className="w-9 h-9 rounded-full shrink-0" src="https://placehold.co/44x44" alt="avatar" />
                <div>
                  <p className="text-white text-[13px] font-medium m-0">{userName}</p>
                  <p className="text-white/40 text-[11px] m-0">{userRole}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="px-2 py-2">
                <button
                  onClick={() => { ["token","refresh_token","name","role","sub","email"].forEach(k => localStorage.removeItem(k)); setProfileOpen(false); navigate("/"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[#FF6B6B] hover:bg-[rgba(255,107,107,0.1)] bg-transparent border-none cursor-pointer transition-colors text-[13px]"
                >
                  <FiLogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes notifFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-item:hover {
          background: rgba(6, 148, 251, 0.1) !important;
          border-color: rgba(6, 148, 251, 0.25) !important;
          transform: translateX(3px);
        }
      `}</style>
    </div>
  );
}

export default Appbar;
