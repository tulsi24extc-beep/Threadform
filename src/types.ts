export type Product = {
  id: string
  name: string
  category: string
  price: number
  rating: string
  colors: string[]
  image: string
  badge?: string
}

export type CartItem = {
  id: string
  productId: string
  name: string
  price: number
  image: string
  quantity: number
  size: string
  color: string
  designText?: string
  designColor?: string
  designPosition?: { left: number; top: number; scaleX: number; scaleY: number }
}

export type User = {
  id: string
  name: string
  email: string
}

export type Order = {
  _id: string
  status: 'pending' | 'paid' | 'failed'
  total: number
  createdAt: string
  items: Array<{
    name: string
    quantity: number
    size: string
    color: string
    designText?: string
    designColor?: string
    designPosition?: { left: number; top: number; scaleX: number; scaleY: number }
  }>
}
