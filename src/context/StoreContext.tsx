import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import { getDemoUser, isDemoAuth, logoutDemoUser } from '../demoAuth'
import type { CartItem, User } from '../types'
import { StoreContext } from './store'

function readCart(): CartItem[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('teestudio_cart') || '[]')
    return Array.isArray(saved) ? saved as CartItem[] : []
  } catch {
    return []
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => isDemoAuth ? getDemoUser() : null)
  const [authLoading, setAuthLoading] = useState(!isDemoAuth)
  const [cart, setCart] = useState<CartItem[]>(readCart)
  const [toast, setToastMessage] = useState('')

  useEffect(() => {
    if (isDemoAuth) return
    api.me().then(({ user: currentUser }) => setUser(currentUser)).catch(() => setUser(null)).finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem('teestudio_cart', JSON.stringify(cart))
  }, [cart])

  const setToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage((current) => current === message ? '' : current), 3000)
  }, [])
  const addToCart = useCallback((item: Omit<CartItem, 'id' | 'quantity'>) => {
    setCart((current) => [...current, { ...item, id: crypto.randomUUID(), quantity: 1 }])
    setToast('Added to your bag')
  }, [setToast])
  const updateQuantity = useCallback((id: string, quantity: number) => {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity } : item))
  }, [])
  const removeFromCart = useCallback((id: string) => setCart((current) => current.filter((item) => item.id !== id)), [])
  const clearCart = useCallback(() => setCart([]), [])
  const signIn = useCallback((signedInUser: User) => setUser(signedInUser), [])
  const signOut = useCallback(async () => {
    if (isDemoAuth) {
      logoutDemoUser()
      setUser(null)
      return
    }
    await api.logout()
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user, authLoading, cart, toast, setToast, addToCart, updateQuantity, removeFromCart, clearCart, signIn, signOut,
  }), [user, authLoading, cart, toast, setToast, addToCart, updateQuantity, removeFromCart, clearCart, signIn, signOut])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
