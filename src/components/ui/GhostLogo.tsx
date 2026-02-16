interface GhostLogoProps {
    className?: string;
}

export function GhostLogo({ className = "w-7 h-7" }: GhostLogoProps) {
    return (
        <svg viewBox="0 0 1024 1024" fill="none" className={className}>
            <rect width="1024" height="1024" rx="200" fill="#0f172a" />
            <g opacity="0.15" stroke="#FFD700" strokeWidth="2.5" fill="#FFD700">
                <circle cx="180" cy="250" r="8" />
                <circle cx="844" cy="250" r="8" />
                <circle cx="140" cy="550" r="8" />
                <circle cx="884" cy="550" r="8" />
                <circle cx="250" cy="780" r="8" />
                <circle cx="774" cy="780" r="8" />
                <circle cx="350" cy="200" r="6" />
                <circle cx="674" cy="200" r="6" />
                <line x1="180" y1="250" x2="350" y2="200" />
                <line x1="844" y1="250" x2="674" y2="200" />
                <line x1="180" y1="250" x2="140" y2="550" />
                <line x1="844" y1="250" x2="884" y2="550" />
                <line x1="140" y1="550" x2="250" y2="780" />
                <line x1="884" y1="550" x2="774" y2="780" />
                <line x1="180" y1="250" x2="350" y2="380" />
                <line x1="844" y1="250" x2="674" y2="380" />
                <line x1="140" y1="550" x2="310" y2="480" />
                <line x1="884" y1="550" x2="714" y2="480" />
                <line x1="250" y1="780" x2="380" y2="680" />
                <line x1="774" y1="780" x2="644" y2="680" />
            </g>
            <path
                d="M512 200 C370 200 280 310 280 440 C280 500 295 555 320 600 C305 625 285 650 260 668 C240 680 225 700 240 718 C255 735 285 740 320 735 C345 730 365 725 385 735 C405 745 425 775 460 790 C480 798 496 802 512 802 C528 802 544 798 564 790 C599 775 619 745 639 735 C659 725 679 730 704 735 C739 740 769 735 784 718 C799 700 784 680 764 668 C739 650 719 625 704 600 C729 555 744 500 744 440 C744 310 654 200 512 200Z"
                fill="#FFCB33"
            />
            <ellipse cx="440" cy="440" rx="30" ry="32" fill="#0f172a" />
            <ellipse cx="445" cy="435" rx="10" ry="11" fill="white" opacity="0.4" />
            <ellipse cx="584" cy="440" rx="30" ry="32" fill="#0f172a" />
            <ellipse cx="589" cy="435" rx="10" ry="11" fill="white" opacity="0.4" />
        </svg>
    );
}
