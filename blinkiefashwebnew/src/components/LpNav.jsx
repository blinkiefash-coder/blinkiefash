import { useNavigate } from "react-router-dom";
import { useState } from "react";

const LOGO_URL = "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg";

function LpNav({ active }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <>
      <header className="lp-nav">
        <button className="lp-brand" onClick={() => go("/")}>
          <img src={LOGO_URL} alt="BlinkieFash" />
          <span>BLINKIE<b>FASH</b></span>
        </button>
        <nav>
          {[["Home","/"],["About Us","/about"],["Stores","/stores"],["Careers","/careers"],["Vendor Login","/vendor"],["Contact Us","/contact-us"]].map(([label, path]) => (
            <button key={label} className={active === label ? "lp-nav-active" : ""} onClick={() => go(path)}>{label}</button>
          ))}
        </nav>
        <div className="lp-nav-right">
          <span className="lp-loc"><span>📍</span><span>Delivering in<br /><strong>Cuttack, Bhubaneswar ▾</strong></span></span>
          <button className="lp-dl-btn" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share","_blank","noopener,noreferrer")}>Download App ↓</button>
          <button className="lp-hamburger" onClick={() => setOpen(true)} aria-label="Menu">
            <span/><span/><span/>
          </button>
        </div>
      </header>
      {open && (
        <div className="lp-drawer-overlay" onClick={() => setOpen(false)}>
          <div className="lp-drawer" onClick={e => e.stopPropagation()}>
            <div className="lp-drawer-head">
              <button className="lp-brand" onClick={() => go("/")}><img src={LOGO_URL} alt="" /><span>BLINKIE<b>FASH</b></span></button>
              <button className="lp-drawer-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <nav className="lp-drawer-nav">
              {[["🏠 Home","/"],["ℹ️ About Us","/about"],["🏪 Stores","/stores"],["💼 Careers","/careers"],["🛒 Vendor Login","/vendor"],["📞 Contact Us","/contact-us"]].map(([label, path]) => (
                <button key={label} onClick={() => go(path)}>{label}</button>
              ))}
            </nav>
            <button className="lp-dl-btn" style={{width:"100%",marginTop:"auto"}} onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app","_blank","noopener,noreferrer")}>⬇ Download App</button>
          </div>
        </div>
      )}
    </>
  );
}
export default LpNav;
