import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Moon, Search, Sun, X } from 'lucide-react';

export default function Header({ query, onQueryChange, data, error, notice }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('order-theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  const [open, setOpen] = useState(null);
  const [read, setRead] = useState('');
  const header = useRef(null);
  const trigger = useRef(null);
  const notificationKey = JSON.stringify([error, notice, data?.errors]);
  const hasNotifications = Boolean(error || notice || data?.errors.length);
  const unread = hasNotifications && read !== notificationKey;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('order-theme', theme); } catch { /* Storage may be unavailable. */ }
  }, [theme]);

  useEffect(() => {
    function dismiss(event) {
      if (!header.current?.contains(event.target)) setOpen(null);
    }
    function onKey(event) {
      if (event.key === 'Escape' && open) {
        setOpen(null);
        trigger.current?.focus();
      }
    }
    const close = () => setOpen(null);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', close);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', close);
    };
  }, [open]);

  function toggle(name, event) {
    trigger.current = event.currentTarget;
    setOpen(open === name ? null : name);
    if (name === 'notifications') setRead(notificationKey);
  }

  return (
    <header className="topbar" ref={header}>
      <form className="global-search" role="search" onSubmit={event => { event.preventDefault(); onQueryChange(query); }}>
        <Search size={22} aria-hidden="true" />
        <input aria-label="Search orders or customers" type="search" value={query} onFocus={() => setOpen(null)} onChange={event => onQueryChange(event.target.value)} placeholder="Search orders, customers..." />
        {query && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => onQueryChange('')}><X size={18} /></button>}
      </form>
      <div className="top-actions">
        <button className="icon-pill" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}</button>
        <div className="navbar-control">
          <button className="icon-pill notification" aria-label={unread ? 'Notifications, unread' : 'Notifications'} aria-expanded={open === 'notifications'} aria-controls="notifications-panel" onClick={event => toggle('notifications', event)}><Bell size={22} />{unread && <span />}</button>
          {open === 'notifications' && <section className="navbar-popover" id="notifications-panel" aria-label="Notifications">
            <h2>Notifications</h2>
            {error && <p className="notification-message">{error}</p>}
            {notice && <p className="notification-message">{notice}</p>}
            {Boolean(data?.errors.length) && <a href="#validation" onClick={() => setOpen(null)}>{data.errors.length} validation issues need review <ChevronDown size={16} /></a>}
            {!hasNotifications && <p>No new notifications.</p>}
          </section>}
        </div>
        <div className="navbar-control">
          <button className="profile-chip" aria-label="Open profile" aria-expanded={open === 'profile'} aria-controls="profile-panel" onClick={event => toggle('profile', event)}>
            <span className="profile-avatar">S</span>
            <span className="profile-label"><strong>Stephen</strong><small>Administrator</small></span>
            <ChevronDown size={18} />
          </button>
          {open === 'profile' && <section className="navbar-popover" id="profile-panel" aria-label="Profile">
            <h2>Stephen</h2><p>Administrator</p>
            <a href="#dashboard" onClick={() => setOpen(null)}>Dashboard</a>
            <a href="#settings" onClick={() => setOpen(null)}>Application settings</a>
          </section>}
        </div>
      </div>
    </header>
  );
}
