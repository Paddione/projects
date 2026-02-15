import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface HelpSection {
  title: string;
  description: string;
}

interface PageHelp {
  pageTitle: string;
  sections: HelpSection[];
}

const helpContent: Record<string, PageHelp> = {
  '/login': {
    pageTitle: 'Anmeldung',
    sections: [
      {
        title: 'Anmelden',
        description: 'Gib deinen Benutzernamen oder deine E-Mail-Adresse zusammen mit deinem Passwort ein und klicke auf "Sign In".',
      },
      {
        title: 'Google-Anmeldung',
        description: 'Alternativ kannst du dich mit deinem Google-Konto anmelden. Klicke dazu auf "Sign in with Google".',
      },
      {
        title: 'Passwort vergessen?',
        description: 'Klicke auf "Forgot password?" neben dem Passwort-Feld. Du erhältst eine E-Mail mit einem Link, um ein neues Passwort zu setzen.',
      },
      {
        title: 'Konto erstellen',
        description: 'Noch kein Konto? Klicke unten auf "Sign up", um dich zu registrieren.',
      },
    ],
  },
  '/register': {
    pageTitle: 'Registrierung',
    sections: [
      {
        title: 'Konto erstellen',
        description: 'Fülle Benutzername, E-Mail und Passwort aus. Der vollständige Name ist optional.',
      },
      {
        title: 'Passwort-Regeln',
        description: 'Dein Passwort muss mindestens 8 Zeichen lang sein und Großbuchstaben, Kleinbuchstaben, eine Zahl und ein Sonderzeichen (@$!%*?&) enthalten.',
      },
      {
        title: 'Google-Registrierung',
        description: 'Du kannst dich auch direkt mit deinem Google-Konto registrieren — klicke auf "Sign up with Google".',
      },
      {
        title: 'E-Mail-Bestätigung',
        description: 'Nach der Registrierung erhältst du eine E-Mail mit einem Bestätigungslink. Klicke darauf, um dein Konto zu aktivieren.',
      },
    ],
  },
  '/hub': {
    pageTitle: 'Access Hub',
    sections: [
      {
        title: 'Apps öffnen',
        description: 'Klicke bei einer freigeschalteten App auf "Open", um sie zu starten. Freigeschaltete Apps haben einen cyan-farbenen Rahmen.',
      },
      {
        title: 'Zugang anfragen',
        description: 'Bei gesperrten Apps klicke auf "Request Access" und gib optional einen Grund an. Ein Admin wird deine Anfrage prüfen.',
      },
      {
        title: 'Anfragen einsehen',
        description: 'Klicke auf "Your Requests", um den Status deiner Zugangsanfragen zu sehen (ausstehend, genehmigt, abgelehnt).',
      },
      {
        title: 'Admin-Panel',
        description: 'Nur für Admins sichtbar: Der Button "Admin Panel" oben rechts führt zur Benutzerverwaltung.',
      },
      {
        title: 'Abmelden',
        description: 'Klicke auf "Sign Out" oben rechts, um dich sicher abzumelden.',
      },
    ],
  },
  '/admin': {
    pageTitle: 'Admin-Panel',
    sections: [
      {
        title: 'Zugangsanfragen',
        description: 'Im Tab "Access Requests" siehst du offene Anfragen von Benutzern. Klicke auf "Review", um eine Anfrage zu genehmigen oder abzulehnen.',
      },
      {
        title: 'Benutzer verwalten',
        description: 'Im Tab "Users" findest du alle registrierten Benutzer. Nutze die Suche und klicke auf "Edit", um Benutzerdetails zu bearbeiten.',
      },
      {
        title: 'Zugangsliste',
        description: 'Im Tab "Access List" siehst du pro App, welche Benutzer Zugang haben. Wähle links eine App aus.',
      },
      {
        title: 'Benutzer bearbeiten',
        description: 'Im Editor kannst du Rolle, Kontostatus, L2P-Charakter-Einstellungen und App-Zugangsrechte ändern.',
      },
    ],
  },
};

const defaultHelp: PageHelp = {
  pageTitle: 'Hilfe',
  sections: [
    {
      title: 'Willkommen',
      description: 'Dies ist das Korczewski Auth Portal. Hier kannst du dich anmelden, registrieren und deine App-Zugänge verwalten.',
    },
    {
      title: 'Navigation',
      description: 'Nutze die Links auf der Seite, um zwischen Anmeldung, Registrierung und dem Access Hub zu wechseln.',
    },
  ],
};

export default function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const getHelp = (): PageHelp => {
    const path = location.pathname;
    if (helpContent[path]) return helpContent[path];
    if (path === '/reset-password' || path === '/verify-email') return helpContent['/login'];
    return defaultHelp;
  };

  const help = getHelp();

  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <>
      <button
        className="help-fab"
        onClick={() => setIsOpen(true)}
        aria-label="Hilfe öffnen"
        title="Hilfe"
      >
        ?
      </button>

      {isOpen && (
        <div className="help-modal-overlay" onClick={handleClose}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="help-modal-title-row">
                <svg viewBox="0 0 24 24" className="help-modal-icon">
                  <circle cx="12" cy="12" r="10" stroke="url(#helpGrad)" strokeWidth="1.5" fill="none" />
                  <text x="12" y="17" textAnchor="middle" fill="url(#helpGrad)" fontSize="14" fontWeight="bold">?</text>
                  <defs>
                    <linearGradient id="helpGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00f2ff"/>
                      <stop offset="100%" stopColor="#bc13fe"/>
                    </linearGradient>
                  </defs>
                </svg>
                <h2>{help.pageTitle}</h2>
              </div>
              <button className="help-modal-close" onClick={handleClose} aria-label="Schließen">
                &times;
              </button>
            </div>

            <div className="help-modal-body">
              {help.sections.map((section, index) => (
                <div key={index} className="help-section">
                  <div className="help-section-header">
                    <span className="help-step-number">{index + 1}</span>
                    <h3>{section.title}</h3>
                  </div>
                  <p>{section.description}</p>
                </div>
              ))}
            </div>

            <div className="help-modal-footer">
              <span>Korczewski Auth</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
