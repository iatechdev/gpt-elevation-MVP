import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'react'

export function LandingButton({ className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={type} className={`elv-btn ${className}`} />
}

export function LandingCard({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`elv-card elv-card-border landing-card ${className}`} />
}

export function LandingLabel({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={`elv-badge elv-badge-outline landing-label ${className}`} />
}

export function LandingSection({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`landing-section ${className}`} />
}

export function LandingLink({ className = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={`elv-link landing-link ${className}`} />
}
