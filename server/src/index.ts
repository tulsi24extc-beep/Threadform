import 'dotenv/config'
import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { z } from 'zod'
import Razorpay from 'razorpay'

const app = express()
const port = Number(process.env.PORT || 4000)
const isProduction = process.env.NODE_ENV === 'production'
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const jwtSecret = process.env.JWT_SECRET
if (isProduction && (!jwtSecret || jwtSecret.length < 32)) throw new Error('JWT_SECRET must be at least 32 characters in production.')

if (!isProduction) app.use(cors({ origin: allowedOrigin, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

const userSchema = new Schema(
  { name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true }, passwordHash: { type: String, required: true } },
  { timestamps: true },
)
const orderLineSchema = new Schema(
  { productId: { type: String, required: true }, name: { type: String, required: true }, quantity: { type: Number, required: true }, size: { type: String, required: true }, color: { type: String, required: true }, designText: String, designColor: String, designPosition: { left: Number, top: Number, scaleX: Number, scaleY: Number }, unitPrice: { type: Number, required: true } },
  { _id: false },
)
const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderLineSchema], required: true },
    shippingAddress: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    total: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    razorpayOrderId: String,
    razorpayPaymentId: String,
  },
  { timestamps: true },
)
type UserDocument = InferSchemaType<typeof userSchema>
type LocalUser = { id: string; name: string; email: string; password_hash: string }
type LocalOrder = {
  id: string
  user_id: string
  items_json: string
  total: number
  status: 'pending' | 'paid' | 'failed'
  razorpay_order_id: string
  razorpay_payment_id: string | null
  created_at: string
}
const UserModel = mongoose.models.User || mongoose.model('User', userSchema)
const OrderModel = mongoose.models.Order || mongoose.model('Order', orderSchema)
type AuthRequest = Request & { userId?: string }
let localAuthDb: Database.Database | null = null

function getLocalAuthDb() {
  if (!localAuthDb) throw new Error('Local development account storage has not been initialized.')
  return localAuthDb
}

function requireAuthStorage(_req: Request, res: Response, next: NextFunction) {
  if (mongoose.connection.readyState !== 1 && !localAuthDb) {
    return res.status(503).json({ message: 'Account storage is unavailable. Check the API logs and database configuration.' })
  }
  next()
}

const catalog: Record<string, { name: string; price: number }> = {
  'classic-crew': { name: 'The Everyday Tee', price: 799 },
  heavyweight: { name: 'Heavyweight Essential', price: 1099 },
  'relaxed-tee': { name: 'Sunday Relaxed Tee', price: 899 },
  'organic-cotton': { name: 'Organic Cotton Tee', price: 999 },
}

function tokenFor(userId: string) {
  return jwt.sign({ sub: userId }, jwtSecret || 'local-development-secret-change-me', { expiresIn: '7d' })
}

function setAuthCookie(res: Response, userId: string) {
  res.cookie('teestudio_token', tokenFor(userId), {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies.teestudio_token as string | undefined
  if (!token) return res.status(401).json({ message: 'Please log in to continue.' })
  try {
    const payload = jwt.verify(token, jwtSecret || 'local-development-secret-change-me') as jwt.JwtPayload
    if (typeof payload.sub !== 'string') return res.status(401).json({ message: 'Your session is invalid. Please log in again.' })
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' })
  }
}

function userResponse(user: UserDocument & { _id: mongoose.Types.ObjectId }) {
  return { id: user._id.toString(), name: user.name, email: user.email }
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(70),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
})
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) })

app.get('/api/health', (_req, res) => res.json({
  database: mongoose.connection.readyState === 1 ? 'connected' : localAuthDb ? 'local' : 'disconnected',
  payment: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'configured' : 'not_configured',
}))

app.post('/api/auth/register', requireAuthStorage, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Please check your details.' })
    const email = parsed.data.email.toLowerCase()
    if (mongoose.connection.readyState !== 1) {
      const db = getLocalAuthDb()
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
        return res.status(409).json({ message: 'An account with this email already exists.' })
      }
      const id = crypto.randomUUID()
      const passwordHash = await bcrypt.hash(parsed.data.password, 12)
      db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(id, parsed.data.name, email, passwordHash)
      setAuthCookie(res, id)
      return res.status(201).json({ user: { id, name: parsed.data.name, email } })
    }
    if (await UserModel.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' })
    const passwordHash = await bcrypt.hash(parsed.data.password, 12)
    const user = await UserModel.create({ name: parsed.data.name, email, passwordHash })
    setAuthCookie(res, user._id.toString())
    return res.status(201).json({ user: userResponse(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', requireAuthStorage, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and password.' })
    if (mongoose.connection.readyState !== 1) {
      const user = getLocalAuthDb().prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(parsed.data.email.toLowerCase()) as LocalUser | undefined
      if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
        return res.status(401).json({ message: 'Email or password is incorrect.' })
      }
      setAuthCookie(res, user.id)
      return res.json({ user: { id: user.id, name: user.name, email: user.email } })
    }
    const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase() })
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    setAuthCookie(res, user._id.toString())
    return res.json({ user: userResponse(user) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', requireAuthStorage, requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const user = getLocalAuthDb().prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.userId) as Pick<LocalUser, 'id' | 'name' | 'email'> | undefined
      if (!user) return res.status(401).json({ message: 'Your account could not be found. Please log in again.' })
      return res.json({ user })
    }
    const user = await UserModel.findById(req.userId)
    if (!user) return res.status(401).json({ message: 'Your account could not be found. Please log in again.' })
    return res.json({ user: userResponse(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('teestudio_token', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' })
  res.json({ message: 'You are signed out.' })
})

const checkoutSchema = z.object({
  address: z.object({
    name: z.string().trim().min(2).max(70),
    email: z.string().trim().email().max(254),
    phone: z.string().regex(/^[+0-9 -]{10,16}$/),
    street: z.string().trim().min(5).max(160),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    pincode: z.string().regex(/^[0-9]{6}$/),
  }),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(10),
    size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    designText: z.string().max(40).optional(),
    designColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    designPosition: z.object({
      left: z.number().min(0).max(384),
      top: z.number().min(0).max(420),
      scaleX: z.number().min(0.1).max(3),
      scaleY: z.number().min(0.1).max(3),
    }).optional(),
  })).min(1).max(20),
})
app.post('/api/payments/order', requireAuthStorage, requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Your cart contains invalid items. Please review it and try again.' })
    const items = parsed.data.items.map((item) => {
      const product = catalog[item.productId]
      if (!product) throw new Error(`Unknown product: ${item.productId}`)
      return { ...item, name: product.name, unitPrice: product.price }
    })
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const total = subtotal + (subtotal >= 1500 ? 0 : 99)
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ message: 'Payments are not configured yet. Add Razorpay test credentials to server/.env to enable checkout.' })
    }
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    const gatewayOrder = await razorpay.orders.create({ amount: total * 100, currency: 'INR', receipt: `ts_${Date.now()}` })
    let orderId: string
    if (mongoose.connection.readyState === 1) {
      const order = await OrderModel.create({
        userId: req.userId,
        shippingAddress: parsed.data.address,
        items,
        total,
        status: 'pending',
        razorpayOrderId: gatewayOrder.id,
      })
      orderId = order._id.toString()
    } else {
      orderId = crypto.randomUUID()
      getLocalAuthDb().prepare(`
        INSERT INTO orders (id, user_id, items_json, total, status, razorpay_order_id)
        VALUES (?, ?, ?, ?, 'pending', ?)
      `).run(orderId, req.userId, JSON.stringify(items), total, gatewayOrder.id)
    }
    return res.status(201).json({
      orderId,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: gatewayOrder.id,
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unknown product:')) return res.status(400).json({ message: 'A product in your cart is no longer available.' })
    next(error)
  }
})

app.post('/api/payments/verify', requireAuthStorage, requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Payment verification is unavailable because Razorpay is not configured.' })
    const parsed = z.object({
      orderId: z.string().min(1),
      razorpayOrderId: z.string().min(1),
      razorpayPaymentId: z.string().min(1),
      razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/i),
    }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Payment verification details are invalid.' })
    const localOrder = mongoose.connection.readyState === 1
      ? undefined
      : getLocalAuthDb().prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(parsed.data.orderId, req.userId) as LocalOrder | undefined
    const order = mongoose.connection.readyState === 1
      ? await OrderModel.findOne({ _id: parsed.data.orderId, userId: req.userId })
      : null
    const orderStatus = order?.status || localOrder?.status
    const orderGatewayId = order?.razorpayOrderId || localOrder?.razorpay_order_id
    const paymentId = order?.razorpayPaymentId || localOrder?.razorpay_payment_id
    if ((!order && !localOrder) || orderGatewayId !== parsed.data.razorpayOrderId) return res.status(404).json({ message: 'The order could not be found.' })
    if (orderStatus === 'paid' && paymentId === parsed.data.razorpayPaymentId) return res.json({ message: 'Payment is already verified.' })
    if (orderStatus !== 'pending') return res.status(409).json({ message: 'This order is no longer awaiting payment verification.' })
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${parsed.data.razorpayOrderId}|${parsed.data.razorpayPaymentId}`)
      .digest('hex')
    const expectedBytes = Buffer.from(expected)
    const receivedBytes = Buffer.from(parsed.data.razorpaySignature)
    if (expectedBytes.length !== receivedBytes.length || !crypto.timingSafeEqual(expectedBytes, receivedBytes)) {
      return res.status(400).json({ message: 'Payment verification failed. Your order has not been marked as paid.' })
    }
    if (order) {
      order.status = 'paid'
      order.razorpayPaymentId = parsed.data.razorpayPaymentId
      await order.save()
    } else {
      getLocalAuthDb().prepare(`
        UPDATE orders SET status = 'paid', razorpay_payment_id = ? WHERE id = ? AND user_id = ?
      `).run(parsed.data.razorpayPaymentId, parsed.data.orderId, req.userId)
    }
    return res.json({ message: 'Payment verified and order confirmed.' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/payments/failed', requireAuthStorage, requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = z.object({ orderId: z.string().min(1), razorpayOrderId: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Payment failure details are invalid.' })
    if (mongoose.connection.readyState === 1) {
      const order = await OrderModel.findOne({ _id: parsed.data.orderId, userId: req.userId, razorpayOrderId: parsed.data.razorpayOrderId })
      if (!order) return res.status(404).json({ message: 'The order could not be found.' })
      if (order.status === 'pending') {
        order.status = 'failed'
        await order.save()
      }
    } else {
      const result = getLocalAuthDb().prepare(`
        UPDATE orders SET status = 'failed'
        WHERE id = ? AND user_id = ? AND razorpay_order_id = ? AND status = 'pending'
      `).run(parsed.data.orderId, req.userId, parsed.data.razorpayOrderId)
      if (!result.changes && !getLocalAuthDb().prepare(`
        SELECT 1 FROM orders WHERE id = ? AND user_id = ? AND razorpay_order_id = ?
      `).get(parsed.data.orderId, req.userId, parsed.data.razorpayOrderId)) {
        return res.status(404).json({ message: 'The order could not be found.' })
      }
    }
    return res.json({ message: 'Payment failure recorded.' })
  } catch (error) {
    next(error)
  }
})

app.get('/api/orders', requireAuthStorage, requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const orders = getLocalAuthDb().prepare(`
        SELECT id, items_json, total, status, created_at FROM orders
        WHERE user_id = ? ORDER BY created_at DESC
      `).all(req.userId) as Array<Pick<LocalOrder, 'id' | 'items_json' | 'total' | 'status' | 'created_at'>>
      return res.json({
        orders: orders.map((order) => ({
          _id: order.id,
          items: JSON.parse(order.items_json) as Array<{ name: string; quantity: number; size: string; color: string; designText?: string }>,
          total: order.total,
          status: order.status,
          createdAt: order.created_at,
        })),
      })
    }
    const orders = await OrderModel.find({ userId: req.userId }).sort({ createdAt: -1 }).select('items total status createdAt')
    return res.json({ orders })
  } catch (error) {
    next(error)
  }
})

if (isProduction) {
  const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist')
  app.use(express.static(clientDist))
  app.use((req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      return res.status(404).json({ message: 'API route not found.' })
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    res.sendFile(resolve(clientDist, 'index.html'), (error) => {
      if (error) next(error)
    })
  })
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API error:', error)
  res.status(500).json({ message: 'The server could not complete your request. Please try again.' })
})

async function start() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri && isProduction) {
    throw new Error('MONGODB_URI is required in production.')
  }
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri)
      console.info('Connected to MongoDB.')
    } catch (error) {
      console.error('MongoDB connection failed:', error)
      if (isProduction) throw error
    }
  } else {
    console.warn('MONGODB_URI is not configured. Enabling local development account storage; orders and payments require MongoDB.')
  }
  if (!isProduction && mongoose.connection.readyState !== 1) {
    const localDbPath = process.env.LOCAL_AUTH_DB_PATH
      ? resolve(process.cwd(), process.env.LOCAL_AUTH_DB_PATH)
      : resolve(dirname(fileURLToPath(import.meta.url)), '../data/teestudio-dev.sqlite')
    mkdirSync(dirname(localDbPath), { recursive: true })
    localAuthDb = new Database(localDbPath)
    localAuthDb.pragma('journal_mode = WAL')
    localAuthDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    localAuthDb.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        items_json TEXT NOT NULL,
        total INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
        razorpay_order_id TEXT NOT NULL UNIQUE,
        razorpay_payment_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS orders_user_id_created_at ON orders(user_id, created_at);
    `)
    console.info(`MongoDB unavailable. Local development accounts will be stored in ${localDbPath}.`)
  }
  app.listen(port, () => console.info(`TeeStudio API listening on http://localhost:${port}`))
}

void start()
