import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function Hero() {
  const containerRef = useRef(null)
  const line1Ref = useRef(null)
  const line2Ref = useRef(null)
  const ctaRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.5, ease: 'power3.out' }
      )

      gsap.fromTo(
        line1Ref.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.2 }
      )

      gsap.fromTo(
        line2Ref.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.4 }
      )

      gsap.fromTo(
        ctaRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.7 }
      )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="relative h-[100dvh] w-full overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=1600&q=90"
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay — primary to transparent */}
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-gradient-to-t from-moss via-moss/70 to-moss/30"
        />
      </div>

      {/* Content — bottom-left third */}
      <div
        ref={containerRef}
        className="relative z-10 h-full flex flex-col justify-end px-6 pb-20 md:pb-32 md:px-16 lg:px-24"
      >
        <div className="max-w-4xl">
          <h1 className="flex flex-col gap-2">
            <span
              ref={line1Ref}
              className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl
                         text-cream/90 tracking-tight leading-none"
            >
              Visibility is the
            </span>
            <span
              ref={line2Ref}
              className="font-drama italic font-semibold text-7xl md:text-9xl lg:text-[10rem]
                         text-cream leading-none mt-2"
            >
              Antidote.
            </span>
          </h1>

          <p className="font-mono text-sm md:text-base text-cream/60 mt-6 max-w-xl leading-relaxed">
            Client-visibility and retention for outbound agencies.
            Automated campaign updates that close the silence gap before it becomes churn.
          </p>

          <div ref={ctaRef} className="mt-8">
            <a
              href="#cta"
              className="magnetic-btn relative inline-flex px-8 py-4 rounded-[1.5rem]
                         bg-clay text-white font-heading font-semibold text-base
                         tracking-wide hover:bg-clay/90"
            >
              <span className="btn-bg" />
              <span className="relative z-10">Join the waitlist</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
