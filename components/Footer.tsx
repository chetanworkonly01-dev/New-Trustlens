"use client";

export default function Footer() {
  return (
    <footer
      className="main-footer"
      style={{ padding: "40px 0", width: "100%" }}
    >
      <div
        className="container footer-inner"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end", // Aligns links to the baseline of the copyright text
          flexWrap: "wrap", // Allows clean stacking on mobile devices
          gap: "24px",
        }}
      >
        {/* Left Side Content */}
        <div className="footer-left">
          <h3 className="footer-logo" style={{ margin: "0 0 8px 0" }}>
            KPMG TrustLens
          </h3>
          <p
            className="footer-copyright"
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            &copy; {new Date().getFullYear()} KPMG International
            <br />
            All Rights Reserved.
          </p>
        </div>

        {/* Right Side Content (Moved inside the same container) */}
        {/* <div
          className="footer-bottom-bar"
          style={{
            display: "flex",
            gap: "24px",
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          <a href="#" className="footer-legal-link">
            Privacy Policy
          </a>
          <a href="#" className="footer-legal-link">
            Terms of Use
          </a>
          <a href="#" className="footer-legal-link">
            Cookie Policy
          </a>
        </div> */}
      </div>
    </footer>
  );
}
