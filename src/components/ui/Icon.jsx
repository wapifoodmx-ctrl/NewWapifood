export function Icon({ name = "home", size = 28 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  return (
    <svg {...common}>
      {draw(name)}
    </svg>
  );
}

function draw(name) {
  switch (name) {
    case "register":
      return (
        <>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M7 21h10M8 8h8M8 12h5" />
        </>
      );
    case "flame":
      return <path d="M12 3s5 4.2 5 8.2A5 5 0 0 1 7 12c0-1.6.8-2.8 1.6-3.8C9 10 10 11 10 12a2 2 0 0 0 4 0c0-2.2-2-5.2-2-9z" />;
    case "receipt":
      return (
        <>
          <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21V5a2 2 0 0 1 2-2z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      );
    case "table":
      return (
        <>
          <rect x="3" y="7" width="18" height="10" rx="2" />
          <path d="M7 7V5M17 7V5M7 17v2M17 17v2" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <circle cx="17" cy="9" r="2.2" />
          <path d="M16 14.2a4.5 4.5 0 0 1 4.5 4.3" />
        </>
      );
    case "tablet":
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M11 18h2" />
        </>
      );
    case "qr":
      return (
        <>
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2h4z" />
        </>
      );
    case "screen":
      return (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </>
      );
    case "dish":
      return (
        <>
          <path d="M4 14a8 8 0 0 0 16 0" />
          <path d="M4 14h16M12 6v4" />
          <circle cx="12" cy="5" r="1" />
        </>
      );
    case "box":
      return (
        <>
          <path d="M3 8l9-4 9 4-9 4-9-4z" />
          <path d="M3 8v8l9 4 9-4V8" />
          <path d="M12 12v8" />
        </>
      );
    case "book":
      return (
        <>
          <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22.5z" />
          <path d="M5 4.5A2.5 2.5 0 0 1 7.5 7H20" />
        </>
      );
    case "list":
      return (
        <>
          <path d="M9 7h11M9 12h11M9 17h11" />
          <path d="M4 7h.01M4 12h.01M4 17h.01" />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M12 16V5" />
          <path d="M7 9l5-5 5 5" />
          <path d="M5 19h14" />
        </>
      );
    case "steps":
      return (
        <>
          <circle cx="6" cy="6" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="18" cy="18" r="2.2" />
          <path d="M8 7.2 10 10.5M13.6 13.4 16.2 16" />
        </>
      );
    case "store":
      return (
        <>
          <path d="M4 9h16l-1 11H5L4 9z" />
          <path d="M3 9l2-5h14l2 5M9 20v-5h6v5" />
        </>
      );
    case "team":
      return (
        <>
          <circle cx="8" cy="9" r="2.4" />
          <circle cx="16" cy="9" r="2.4" />
          <path d="M3.5 18a4.5 4.5 0 0 1 9 0M12 18a4.5 4.5 0 0 1 8.5 0" />
        </>
      );
    case "card":
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </>
      );
    case "bread":
      return <path d="M5 12c0-4 3-7 7-7s7 3 7 7v5H5v-5zM5 14h14" />;
    case "check":
      return <path d="M5 12.5 9.2 17 19 7" />;
    case "ban":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M7 7l10 10" />
        </>
      );
    case "plus":
      return <path d="M12 6v12M6 12h12" />;
    case "minus":
      return <path d="M6 12h12" />;
    case "cash":
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.4" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </>
      );
    case "cart":
      return (
        <>
          <circle cx="9" cy="19" r="1.4" />
          <circle cx="17" cy="19" r="1.4" />
          <path d="M3 5h2l2.2 10h11.2l2-7H7" />
        </>
      );
    case "close":
      return <path d="M6 6l12 12M18 6 6 18" />;
    case "eye":
      return (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" />
        </>
      );
    case "chart":
      return (
        <>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-4M12 16V8M16 16v-6" />
        </>
      );
    case "chevron":
      return <path d="M9 6l6 6-6 6" />;
    case "rail":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 4v16" />
        </>
      );
    default:
      return (
        <>
          <path d="M4 10.5 12 4l8 6.5V20H4v-9.5z" />
          <path d="M10 20v-6h4v6" />
        </>
      );
  }
}
