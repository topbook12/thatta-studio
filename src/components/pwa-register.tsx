'use client'

import { useEffect } from 'react'

/**
 * Registers the PWA service worker in production builds only.
 * Renders nothing.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })
      } catch (error) {
        console.error('[pwa] Service worker registration failed:', error)
      }
    }

    register()
  }, [])

  return null
}

export default PwaRegister
