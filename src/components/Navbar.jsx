import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Menu, X } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export default function Navbar() {
  const navRef = useRef(null)
  const linksRef = useRef([])
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        navRef.current,
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.3 }
      )

      gsap.fromTo(
        linksRef.current.filter(Boolean),
        { y: -10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.08, delay: 0.5 }
      )

      ScrollTrigger.create({
        start: 'top -80px',
        end: 99999,
        onUpdate: (self) => {
          if (!navRef.current) return
          if (self.progress > 0) {
            navRef.current.classList.add(
              'bg-cream/60', 'backdrop-blur-xl', 'border', 'border-moss/10',
              'shadow-lg', 'shadow-moss/5'
            )
            navRef.current.classList.remove('bg-transparent', 'border-transparent')
          } else {
            navRef.current.classList.remove(
              'bg-cream/60', 'backdrop-blur-xl', 'border', 'border-moss/10',
              'shadow-lg', 'shadow-moss/5'
            )
            navRef.current.classList.add('bg-transparent', 'border-transparent')
          }
        },
      })
    }, navRef)

    return () => ctx.revert()
  }, [])

  const navLinks = ['Features', 'Philosophy', 'Protocol']

  return (
    <nav
      ref={navRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50
                 w-[calc(100%-2rem)] max-w-3xl
                 rounded-[2rem] px-6 py-3
                 bg-transparent border border-transparent
                 transition-colors duration-500"
    >
      <div className="flex items-center justify-between">
        <span className="font-heading font-bold text-lg tracking-tight text-charcoal">
          Klaroh
        </span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link, i) => (
            <a
              key={link}
              ref={(el) => (linksRef.current[i] = el)}
              href={`#${link.toLowerCase()}`}
              className="font-heading text-sm font-medium text-charcoal/70
                         hover:text-charcoal lift-hover tracking-wide"
            >
              {link}
            </a>
          ))}
          <a
            href="#cta"
            className="magnetic-btn relative px-5 py-2.5 rounded-[1rem] bg-clay text-white
                       font-heading text-sm font-semibold tracking-wide
                       hover:bg-clay/90"
          >
            <span className="btn-bg" />
            <span className="relative z-10">Join waitlist</span>
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-charcoal"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-moss/10 flex flex-col gap-4 pb-2">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              onClick={() => setMobileOpen(false)}
              className="font-heading text-sm font-medium text-charcoal/70 hover:text-charcoal"
            >
              {link}
            </a>
          ))}
          <a
            href="#cta"
            onClick={() => setMobileOpen(false)}
            className="magnetic-btn relative px-5 py-2.5 rounded-[1rem] bg-clay text-white
                       font-heading text-sm font-semibold tracking-wide text-center"
          >
            <span className="btn-bg" />
            <span className="relative z-10">Join waitlist</span>
          </a>
        </div>
      )}
    </nav>
  )
}
