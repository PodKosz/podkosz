export function GoogleMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-white ${className}`}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2">
        <path
          fill="#4285F4"
          d="M23 12.3c0-.9-.1-1.5-.2-2.2H12v4h6.3c-.1 1-.8 2.6-2.3 3.6l3.5 2.7c2.1-1.9 3.5-4.8 3.5-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.6-2.8c-1 .7-2.3 1.1-4 1.1-3 0-5.6-2-6.5-4.8l-3.7 2.9C3.7 20.8 7.6 23.5 12 23.5Z"
        />
        <path
          fill="#FBBC05"
          d="M5.5 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2L1.8 6.9C1 8.4.5 10.2.5 12s.5 3.6 1.3 5.1l3.7-2.9Z"
        />
        <path
          fill="#EA4335"
          d="M12 5c2.1 0 3.6.9 4.4 1.7l3.2-3.1C17.7 1.8 15.1.5 12 .5 7.6.5 3.7 3.2 1.8 6.9l3.7 2.9C6.4 7 9 5 12 5Z"
        />
      </svg>
    </span>
  );
}
