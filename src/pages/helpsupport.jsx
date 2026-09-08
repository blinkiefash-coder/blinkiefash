import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submitSupportTicket } from '../api';

import './helpsupport.css';

/* ---------- contact + support config (same as mobile app) ---------- */
const PHONE_DISPLAY = '+91 98279 01891';
const PHONE_TEL = '+919827901891'; // tel: link — keep + but no spaces
const WHATSAPP_NUMBER = '919827901891'; // wa.me — country code + digits, no + or spaces
const SUPPORT_EMAIL = 'support@blinkiefash.in';

const TICKET_CATEGORIES = [
  'Order Issue',
  'Delivery Problem',
  'Payment Issue',
  'Return Request',
  'Product Quality',
  'Damaged Item',
  'Wrong Item',
  'Other',
];

/* ---------- safe external open (avoids popup blockers, matches mobile launchUrl) ---------- */
function openExternal(url) {
  if (!url) return false;
  try {
    // Prefer an in-gesture <a> click — most reliable against popup blockers
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      try {
        window.location.href = url;
        return true;
      } catch {
        return false;
      }
    }
  }
}

/* ---------- icons ---------- */
const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.4 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7A2 2 0 0 1 22 16.9z" />
  </svg>
);
const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.8 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.5-.3z" />
    <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 20.2 12 8.2 8.2 0 0 1 12 20.2z" />
  </svg>
);
const IconMail = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const IconTicket = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9z" />
    <path d="M10 7v10" strokeDasharray="1.5 2.5" />
  </svg>
);
const IconChatBubble = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);
const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 4v6h-6" />
  </svg>
);
const IconXCircle = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="m9.5 9.5 5 5m0-5-5 5" />
  </svg>
);
const IconMapPin = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconCreditCard = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
const IconMoreDots = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconSend = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m22 2-7 20-4-9-9-4z" />
    <path d="M22 2 11 13" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/* ---------- data ---------- */
const COMMON_TOPICS = [
  { label: 'Track My Order', icon: <IconSearch />, to: '/orders' },
  { label: 'Returns & Refunds', icon: <IconRefresh />, to: '/orders' },
  { label: 'Cancel Order', icon: <IconXCircle />, to: '/orders' },
  { label: 'Change Delivery Address', icon: <IconMapPin />, to: '/checkout' },
  { label: 'Payment & Offers', icon: <IconCreditCard />, to: '/account' },
  { label: 'More FAQs', icon: <IconMoreDots />, to: '/faqs' },
];

/* ---------- illustration ---------- */
const SupportIllustration = () => (
  <svg viewBox="0 0 260 200" width="260" height="200" className="hs-illustration">
    <circle cx="130" cy="100" r="85" fill="#eaf6ee" />
    <path d="M35 150c10-30 40-35 55-25-5 20-30 35-55 25z" fill="#bfe6c9" />
    <path d="M225 150c-10-30-40-35-55-25 5 20 30 35 55 25z" fill="#bfe6c9" />
    <g stroke="#0d9f4f" strokeWidth="2.4" strokeLinecap="round" opacity="0.7">
      <path d="M40 65v10M35 70h10" />
      <path d="M215 60v10M210 65h10" />
      <path d="M60 45v8M56 49h8" />
    </g>
    <g transform="translate(85,45)">
      <path d="M10 65a45 45 0 0 1 90 0" fill="none" stroke="#0b3d1f" strokeWidth="7" strokeLinecap="round" />
      <rect x="0" y="58" width="16" height="34" rx="8" fill="#0d9f4f" />
      <rect x="94" y="58" width="16" height="34" rx="8" fill="#0d9f4f" />
      <path d="M55 92v10a10 10 0 0 0 10 10h6" fill="none" stroke="#0b3d1f" strokeWidth="6" strokeLinecap="round" />
      <circle cx="74" cy="112" r="6" fill="#0b3d1f" />
    </g>
    <g transform="translate(20,55)">
      <rect x="0" y="0" width="46" height="34" rx="12" fill="#0d9f4f" />
      <path d="M10 34 4 44l14-8z" fill="#0d9f4f" />
      <circle cx="14" cy="17" r="3" fill="#fff" />
      <circle cx="23" cy="17" r="3" fill="#fff" />
      <circle cx="32" cy="17" r="3" fill="#fff" />
    </g>
    <g transform="translate(196,45)">
      <circle cx="14" cy="14" r="16" fill="#f9a825" />
      <text x="14" y="20" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">
        ?
      </text>
    </g>
  </svg>
);

export default function HelpSupport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketMsg, setTicketMsg] = useState('');
  const [category, setCategory] = useState('Order Issue');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCall = () => {
    openExternal(`tel:${PHONE_TEL}`);
  };

  const handleWhatsApp = () => {
    // Match mobile: pre-filled message + wa.me with country code (919827901891)
    const text = encodeURIComponent(
      'Hi BlinkieFash Support, I need help with my order. App: BlinkieFash Web'
    );
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
    const ok = openExternal(url);
    if (!ok) {
      window.location.href = url;
    }
  };

  const handleEmail = () => {
    // Match mobile: mailto: (opens default mail client). Gmail web as fallback.
    const subject = encodeURIComponent('Support Request - BlinkieFash');
    const body = encodeURIComponent('Hi BlinkieFash Support,\n\nI need help with:\n\n');
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    const ok = openExternal(mailto);
    if (!ok) {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        SUPPORT_EMAIL
      )}&su=${subject}&body=${body}`;
      openExternal(gmailUrl);
    }
  };

  const handleOpenTicket = () => {
    setTicketOpen(true);
    setSubmitted(false);
    setSubmittedTicketId(null);
    setTicketMsg('');
    setCategory('Order Issue');
    setErrorMsg('');
  };

  const handleCloseTicket = () => {
    setTicketOpen(false);
    setTicketMsg('');
    setSubmitting(false);
    setErrorMsg('');
  };

  const emailFallback = (msg) => {
    const subject = encodeURIComponent(`[${category}] Support Ticket`);
    const body = encodeURIComponent(`Category: ${category}\nIssue:\n${msg}`);
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    openExternal(mailto);
  };

  const handleSendTicket = async () => {
    const msg = ticketMsg.trim();
    if (!msg || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const userId = user?.id != null ? String(user.id) : null;
      const result = await submitSupportTicket({
        message: msg,
        category,
        userId,
        orderId: null,
      });

      if (result.success) {
        const ticketId = result.ticket?.id != null ? String(result.ticket.id) : null;
        setSubmitted(true);
        setSubmittedTicketId(ticketId);
        return;
      }

      // API failed — fall back to email (same as mobile)
      console.warn('Ticket submit failed:', result.error);
      emailFallback(msg);
      setSubmitted(true);
      setSubmittedTicketId(null);
    } catch (e) {
      console.error('Ticket submit exception:', e);
      emailFallback(msg);
      setSubmitted(true);
      setSubmittedTicketId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInAppChat = () => {
    navigate('/support-chat');
  };

  return (
    <div className="hs-page">
      <div className="hs-breadcrumb">
        <button type="button" className="hs-breadcrumb-link" onClick={() => navigate('/')}>
          Home
        </button>
        <IconChevronRight />
        <button type="button" className="hs-breadcrumb-link" onClick={() => navigate('/account')}>
          My Account
        </button>
        <IconChevronRight />
        <span>Help &amp; Support</span>
      </div>

      <div className="hs-header">
        <div className="hs-header-text">
          <h1>
            Help &amp; <span>Support</span>
          </h1>
          <p>We are here for you 24/7</p>
        </div>
        <SupportIllustration />
      </div>

      <p className="hs-section-title">CONTACT US</p>
      <div className="hs-contact-grid">
        <button type="button" className="hs-contact-card hs-card-green" onClick={handleCall}>
          <span className="hs-ic hs-ic-green">
            <IconPhone />
          </span>
          <span className="hs-card-title">Call Us</span>
          <span className="hs-card-highlight hs-text-green">{PHONE_DISPLAY}</span>
          <span className="hs-card-sub">Available 9 AM – 9 PM (Daily)</span>
        </button>

        <button type="button" className="hs-contact-card hs-card-green" onClick={handleWhatsApp}>
          <span className="hs-ic hs-ic-solid-green">
            <IconWhatsApp />
          </span>
          <span className="hs-card-title">WhatsApp</span>
          <span className="hs-card-highlight hs-text-green">Chat Instantly</span>
          <span className="hs-card-sub">We reply within minutes</span>
        </button>

        <button type="button" className="hs-contact-card hs-card-purple" onClick={handleEmail}>
          <span className="hs-ic hs-ic-purple">
            <IconMail />
          </span>
          <span className="hs-card-title">Email</span>
          <span className="hs-card-highlight hs-text-purple">{SUPPORT_EMAIL}</span>
          <span className="hs-card-sub">We&apos;ll get back to you soon</span>
        </button>

        <button type="button" className="hs-contact-card hs-card-amber" onClick={handleOpenTicket}>
          <span className="hs-ic hs-ic-amber">
            <IconTicket />
          </span>
          <span className="hs-card-title">Create Ticket</span>
          <span className="hs-card-highlight hs-text-amber">Fill &amp; submit an issue</span>
          <span className="hs-card-sub">Our team will resolve it</span>
        </button>
      </div>

      <button type="button" className="hs-chat-banner" onClick={handleInAppChat}>
        <span className="hs-chat-banner-left">
          <span className="hs-chat-banner-icon">
            <IconChatBubble />
          </span>
          <span className="hs-chat-banner-text">
            <span className="t">Open In-App Support Chat</span>
            <span className="s">Chat with our support team inside the app for quick help</span>
          </span>
        </span>
        <span className="hs-chat-banner-arrow">
          <IconArrowRight />
        </span>
      </button>

      <div className="hs-topics-card">
        <p className="hs-section-title hs-topics-title">COMMON TOPICS</p>
        <div className="hs-topics-row">
          {COMMON_TOPICS.map((topic) => (
            <button
              key={topic.label}
              type="button"
              className="hs-topic-pill"
              onClick={() => navigate(topic.to)}
            >
              <span className="hs-topic-icon">{topic.icon}</span>
              <span className="hs-topic-label">{topic.label}</span>
              <IconChevronRight />
            </button>
          ))}
        </div>
      </div>

      {ticketOpen && (
        <div className="hs-modal-overlay" onClick={handleCloseTicket}>
          <div className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hs-modal-header">
              <h3>{submitted ? 'Ticket Submitted' : 'Create a Support Ticket'}</h3>
              <button
                type="button"
                className="hs-modal-close"
                onClick={handleCloseTicket}
                aria-label="Close"
              >
                <IconX />
              </button>
            </div>

            {submitted ? (
              <div className="hs-ticket-success">
                <div className="hs-ticket-success-icon">
                  <IconCheck />
                </div>
                <p className="hs-ticket-success-title">We&apos;ve received your request</p>
                <p className="hs-ticket-success-sub">
                  {submittedTicketId
                    ? `Ticket ID: #${submittedTicketId}. Our team will review it shortly.`
                    : `Your message was sent. We'll get back to you at ${SUPPORT_EMAIL} soon.`}
                </p>
                <button type="button" className="hs-modal-send" onClick={handleCloseTicket}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="hs-modal-sub">
                  Describe your issue below. Tickets are saved to our support system (same as the
                  mobile app).
                </p>

                <p className="hs-modal-label">Issue Type</p>
                <div className="hs-category-row">
                  {TICKET_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`hs-category-chip${category === c ? ' active' : ''}`}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <textarea
                  className="hs-modal-textarea"
                  placeholder="Type your issue here…"
                  value={ticketMsg}
                  onChange={(e) => setTicketMsg(e.target.value)}
                  rows={6}
                  autoFocus
                  disabled={submitting}
                />

                {errorMsg && <p className="hs-modal-error">{errorMsg}</p>}

                <div className="hs-modal-actions">
                  <button
                    type="button"
                    className="hs-modal-cancel"
                    onClick={handleCloseTicket}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="hs-modal-send"
                    onClick={handleSendTicket}
                    disabled={!ticketMsg.trim() || submitting}
                  >
                    <IconSend />
                    {submitting ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}