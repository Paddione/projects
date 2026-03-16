interface RespectBalanceProps {
    balance: number;
    size?: 'sm' | 'md' | 'lg';
}

export default function RespectBalance({ balance, size = 'md' }: RespectBalanceProps) {
    const fontSizeMap = { sm: '0.85rem', md: '1rem', lg: '1.2rem' };
    const iconSizeMap = { sm: '16px', md: '20px', lg: '24px' };
    const fontSize = fontSizeMap[size];
    const iconSize = iconSizeMap[size];

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-warning)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize,
        }}>
            <svg
                width={iconSize}
                height={iconSize}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
            >
                <path d="M12 2L3 7v10l9 5 9-5V7L12 2zm0 2.18L19 8v8l-7 3.91L5 16V8l7-3.82z" />
            </svg>
            {balance.toLocaleString()}
        </div>
    );
}
