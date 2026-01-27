import React from 'react'

interface IconProps {
  name: string
  size?: number
  alt?: string
  className?: string
  style?: React.CSSProperties
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  alt = '',
  className,
  style
}) => (
  <img
    src={`/icons/${name}.svg`}
    alt={alt}
    width={size}
    height={size}
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
  />
)
