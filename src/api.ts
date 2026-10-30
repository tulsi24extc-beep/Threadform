import type { Order, User } from './types'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T
  if (!response.ok) throw new Error(payload.message || 'Something went wrong. Please try again.')
  return payload
}

export const api = {
  health: () => request<{ database: string; payment: string }>('/health'),
  me: () => request<{ user: User }>('/auth/me'),
  register: (name: string, email: string, password: string) =>
    request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  orders: () => request<{ orders: Order[] }>('/orders'),
  createOrder: (
    items: Array<{
      productId: string
      quantity: number
      size: string
      color: string
      designText?: string
      designColor?: string
      designPosition?: { left: number; top: number; scaleX: number; scaleY: number }
    }>,
    address: { name: string; email: string; phone: string; street: string; city: string; state: string; pincode: string },
  ) =>
    request<{ orderId: string; amount: number; currency: string; keyId: string; razorpayOrderId: string }>('/payments/order', {
      method: 'POST',
      body: JSON.stringify({ items, address }),
    }),
  verifyPayment: (orderId: string, razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string) =>
    request<{ message: string }>(`/payments/verify`, {
      method: 'POST',
      body: JSON.stringify({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }),
    }),
  paymentFailed: (orderId: string, razorpayOrderId: string) =>
    request<{ message: string }>('/payments/failed', {
      method: 'POST',
      body: JSON.stringify({ orderId, razorpayOrderId }),
    }),
}
