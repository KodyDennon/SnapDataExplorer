interface GhostLogoProps {
    className?: string;
}

export function GhostLogo({ className = "w-7 h-7" }: GhostLogoProps) {
    return (
        <svg viewBox="0 0 100 100" fill="none" className={className}>
            <circle cx="50" cy="50" r="48" fill="#0f172a" />
            <path
                d="M50 22c-16 0-29 13-29 29 0 5.5 1.5 10.6 4 15-2 3-4.5 5.5-4.5 5.5s5.5 3 8.5 4.5c3 1.5 4.5 5.5 7.5 7s8.5 3 13.5 3 10.5-1.5 13.5-3 4.5-5.5 7.5-7c3-1.5 8.5-4.5 8.5-4.5s-2.5-2.5-4.5-5.5c2.5-4.4 4-9.5 4-15 0-16-13-29-29-29z"
                fill="#FFCB33"
            />
            <circle cx="42" cy="48" r="3.5" fill="#0f172a" />
            <circle cx="58" cy="48" r="3.5" fill="#0f172a" />
            <circle cx="43" cy="47" r="1.2" fill="white" opacity="0.5" />
            <circle cx="59" cy="47" r="1.2" fill="white" opacity="0.5" />
            <g opacity="0.25" stroke="#FFD700" strokeWidth="0.8">
                <circle cx="18" cy="30" r="2" fill="#FFD700" />
                <circle cx="82" cy="30" r="2" fill="#FFD700" />
                <circle cx="14" cy="62" r="2" fill="#FFD700" />
                <circle cx="86" cy="62" r="2" fill="#FFD700" />
                <circle cx="30" cy="82" r="2" fill="#FFD700" />
                <circle cx="70" cy="82" r="2" fill="#FFD700" />
                <line x1="18" y1="30" x2="35" y2="44" />
                <line x1="82" y1="30" x2="65" y2="44" />
                <line x1="14" y1="62" x2="28" y2="52" />
                <line x1="86" y1="62" x2="72" y2="52" />
                <line x1="18" y1="30" x2="14" y2="62" />
                <line x1="82" y1="30" x2="86" y2="62" />
                <line x1="14" y1="62" x2="30" y2="82" />
                <line x1="86" y1="62" x2="70" y2="82" />
            </g>
        </svg>
    );
}
