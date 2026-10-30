import type { Product } from './types'

export const products: Product[] = [
  {
    id: 'classic-crew',
    name: 'The Everyday Tee',
    category: 'CLASSIC FIT',
    price: 799,
    rating: '4.9',
    colors: ['#f5f2ea', '#191919', '#9ea8a1', '#e3bdb2'],
    image: '/images/everyday-tee.jpg',
    badge: 'BEST SELLER',
  },
  {
    id: 'heavyweight',
    name: 'Heavyweight Essential',
    category: 'OVERSIZED',
    price: 1099,
    rating: '4.8',
    colors: ['#ddd8ce', '#222222', '#777f96', '#c4b1a1'],
    image: '/images/heavyweight-tee.jpg',
    badge: 'NEW',
  },
  {
    id: 'relaxed-tee',
    name: 'Sunday Relaxed Tee',
    category: 'RELAXED FIT',
    price: 899,
    rating: '4.9',
    colors: ['#e9e4dc', '#272525', '#b6c1ca', '#e5c4ba'],
    image: '/images/relaxed-tee.jpg',
  },
  {
    id: 'organic-cotton',
    name: 'Organic Cotton Tee',
    category: '100% ORGANIC',
    price: 999,
    rating: '5.0',
    colors: ['#e3ddd1', '#20211e', '#93a18f', '#cbb4a7'],
    image: '/images/organic-tee.jpg',
    badge: 'MADE BETTER',
  },
]

export const formatPrice = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
