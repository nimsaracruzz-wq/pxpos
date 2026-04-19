import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function MediaCarousel({
  items = [],
  autoPlay = true,
  interval = 5000,
  className = '',
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay)
  const videoRefs = useRef([])

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items])

  useEffect(() => {
    if (!isAutoPlaying || safeItems.length === 0) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeItems.length)
    }, interval)
    return () => clearInterval(timer)
  }, [isAutoPlaying, interval, safeItems.length])

  useEffect(() => {
    if (safeItems.length === 0) {
      setCurrentIndex(0)
      return
    }
    setCurrentIndex((prev) => Math.min(prev, safeItems.length - 1))
  }, [safeItems.length])

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return
      if (index === currentIndex) {
        const playResult = video.play?.()
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch(() => {})
        }
      } else {
        video.pause?.()
      }
    })
  }, [currentIndex, safeItems])

  if (safeItems.length === 0) {
    return (
      <div className={`media-carousel bg-slate-800/80 flex items-center justify-center ${className}`}>
        <p className="text-slate-300 text-sm">No media items available</p>
      </div>
    )
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
    setIsAutoPlaying(false)
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length)
    setIsAutoPlaying(false)
  }

  const currentItem = safeItems[currentIndex]

  const renderSlide = (item, index) => {
    if (item.type === 'video' && item.src) {
      return (
        <video
          ref={(el) => { videoRefs.current[index] = el }}
          src={item.src}
          muted
          loop
          playsInline
          autoPlay={index === currentIndex}
          className="w-full h-full object-cover"
        />
      )
    }

    if (item.type === 'image' && item.src) {
      return <img src={item.src} alt={item.title || `Slide ${index + 1}`} className="w-full h-full object-cover" />
    }

    return (
      <div
        className="w-full h-full flex items-end p-8"
        style={{
          background: item.gradient || 'linear-gradient(135deg,#0f172a,#1e293b,#0f766e)',
        }}
      >
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80 mb-2">Paxxmo Display</p>
          <h3 className="text-4xl font-black text-white mt-2 max-w-xl">{item.title || 'Premium POS Experience'}</h3>
          {item.description && <p className="text-sm text-slate-200/90 mt-3 max-w-xl">{item.description}</p>}
          {item.tag && (
            <span
              className="inline-flex mt-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white border"
              style={{ background: `${item.accent || '#16a34a'}33`, borderColor: `${item.accent || '#16a34a'}66` }}
            >
              {item.tag}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`media-carousel ${className}`}>
      <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
        {safeItems.map((item, index) => (
          <div
            key={item.id}
            className={`media-carousel-item ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
          >
            {renderSlide(item, index)}
          </div>
        ))}

        <div className="gradient-overlay" />

        <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={goToPrevious}
            className="bg-emerald-500/80 hover:bg-emerald-500 text-white p-3 rounded-full transition-all duration-200 shadow-lg"
            aria-label="Previous slide"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={goToNext}
            className="bg-emerald-500/80 hover:bg-emerald-500 text-white p-3 rounded-full transition-all duration-200 shadow-lg"
            aria-label="Next slide"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {safeItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentIndex(index)
                setIsAutoPlaying(false)
              }}
              className={`transition-all duration-300 rounded-full ${index === currentIndex ? 'bg-emerald-400 w-8 h-2' : 'bg-emerald-200/40 w-2 h-2 hover:bg-emerald-300/60'}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setIsAutoPlaying((prev) => !prev)}
          className="absolute top-4 right-4 bg-slate-900/70 hover:bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200"
        >
          {isAutoPlaying ? 'Pause' : 'Play'}
        </button>

        {currentItem?.title && (
          <div className="absolute top-4 left-4 bg-slate-900/65 text-white px-3 py-1.5 rounded-full text-xs font-semibold">
            {currentItem.title}
          </div>
        )}
      </div>
    </div>
  )
}
