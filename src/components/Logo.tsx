interface Props {
  size?: number;
  className?: string;
}

export default function Logo({ size = 24, className = '' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Switchboard"
      className={className}
    >
      <path d="M9 3.8h14v6.4H9z" />
      <path d="M12.4 7h7.2" />
      <path d="M23 28.2H9v-6.4h14z" />
      <path d="M19.6 25h-7.2" />
      <path d="M16 10.2 C16 12.7 23.5 12.5 23.5 16 C23.5 19.5 8.5 12.5 8.5 16 C8.5 19.5 16 19.3 16 21.8" />
    </svg>
  );
}
