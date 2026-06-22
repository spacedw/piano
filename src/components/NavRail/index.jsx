import React from 'react';
import { NavLink } from 'react-router-dom';
import * as I from '@/components/Icons';
import { useLocale } from '@/i18n';

const NAV_ITEMS = [
  { to: '/', icon: <I.Piano size={18} />, label: { es: 'Tocar', en: 'Play' } },
  { to: '/library', icon: <I.Library size={18} />, label: { es: 'Librería', en: 'Library' } },
  { to: '/progress', icon: <I.Chart size={18} />, label: { es: 'Progreso', en: 'Progress' } },
];

export default function NavRail({ user, onOpenSettings }) {
  const { locale } = useLocale();

  return (
    <nav className="nav-rail">
      <div className="nav-logo">
        <div className="nav-logo-circle">P</div>
      </div>

      {NAV_ITEMS.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' nav-item-active' : ''}`}
        >
          {item.icon}
          <span className="nav-tooltip">{item.label[locale] || item.label.en}</span>
        </NavLink>
      ))}

      <div className="nav-spacer" />

      <button className="nav-item" onClick={onOpenSettings}>
        <I.Settings size={18} />
        <span className="nav-tooltip">{locale === 'es' ? 'Ajustes' : 'Settings'}</span>
      </button>
      <div style={{ height: 8 }} />
      <button
        className="nav-account"
        title={user?.email || 'Account'}
        onClick={onOpenSettings}
      >
        {user?.email?.[0]?.toUpperCase() || '?'}
      </button>
    </nav>
  );
}
