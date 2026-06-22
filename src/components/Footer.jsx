import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function Footer() {
  const footerRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        footerRef.current?.children,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.2 }
      )
    }, footerRef)
    return () => ctx.revert()
  }, [])

  return (
    <footer
      ref={footerRef}
      className="bg-charcoal rounded-t-[4rem] px-6 md:px-16 lg:px-24 pt-16 pb-8"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <span className="font-heading font-bold text-xl text-cream tracking-tight">
              Klaroh
            </span>
            <p className="font-heading text-sm text-cream/30 mt-3 max-w-xs leading-relaxed">
              Client-visibility and retention for outbound agencies.
              Closing the silence gap before it becomes churn.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-mono text-[10px] text-cream/40 uppercase tracking-[0.15em] mb-4">
              Site
            </h4>
            <div className="space-y-3">
              {['Features', 'Philosophy', 'Protocol'].map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="block font-heading text-sm text-cream/50 hover:text-cream
                             lift-hover transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-mono text-[10px] text-cream/40 uppercase tracking-[0.15em] mb-4">
              Legal
            </h4>
            <div className="space-y-3">
              {['Privacy', 'Terms', 'Contact'].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="block font-heading text-sm text-cream/50 hover:text-cream
                             lift-hover transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-cream/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-mono text-[10px] text-cream/30">
            &copy; {new Date().getFullYear()} Klaroh. All rights reserved.
          </p>

          {/* System operational status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream/5 border border-cream/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="font-mono text-[10px] text-cream/40 uppercase tracking-wider">
              System Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
