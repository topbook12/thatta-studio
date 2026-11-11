'use client'

import { useEffect } from 'react'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

/**
 * Registers the PWA service worker in production builds and surfaces a
 * "new version ready" toast with a one-tap refresh action.
 * Renders nothing.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    if (!('serviceWorker' in navigator)) return

    let reloading = false

    const reloadOnce = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // a new worker has finished installing → offer the refresh
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              toast({
                title: 'নতুন ভার্সন রেডি ✨',
                description: 'এক ট্যাপে সর্বশেষ ঠাট্টা স্টুডিও পান।',
                action: (
                  <ToastAction altText="রিফ্রেশ করুন" onClick={reloadOnce}>
                    রিফ্রেশ
                  </ToastAction>
                ),
              })
            }
          })
        })

        // if the controller changes while the page is open, refresh politely
        let refreshed = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshed) return
          refreshed = true
          reloadOnce()
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
