import { createContext, useContext } from 'react'
import type { CartItem, User } from '../types'

export type StoreContextValue = {
  user: User | null
  authLoading: boolean
  cart: CartItem[]
  toast: string
  setToast: (message: string) => void
  addToCart: (item: Omit<CartItem, 'id' | 'quantity'>) => void
  updateQuantity: (id: string, quantity: number) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  signIn: (user: User) => void
  signOut: () => Promise<void>
}

export const StoreContext = createContext<StoreContextValue | null>(null)

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used within StoreProvider')
  return context
}
