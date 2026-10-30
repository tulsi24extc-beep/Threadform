import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleUserRound, Heart,
  Camera, LoaderCircle, LockKeyhole, Menu, Minus, Plus, ShoppingBag, Sparkles, Star, Trash2, Truck, X,
} from 'lucide-react'
import { api } from './api'
import { formatPrice, products, publicAsset } from './data'
import { isDemoAuth, loginDemoUser, registerDemoUser } from './demoAuth'
import { DesignCanvas } from './components/DesignCanvas'
import { StoreProvider } from './context/StoreContext'
import { useStore } from './context/store'
import type { CartItem, Order, Product } from './types'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void
      on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void
    }
  }
}

function AppFrame() {
  const { user, cart, toast, authLoading, setToast, signOut } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'ready' | 'payments' | 'local' | 'local-ready' | 'database' | 'offline' | 'demo'>(isDemoAuth ? 'demo' : 'loading')
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])
  useEffect(() => {
    if (isDemoAuth) return
    api.health().then((health) => setStatus(
      health.database === 'local'
        ? health.payment === 'configured' ? 'local-ready' : 'local'
        : health.database !== 'connected' ? 'database'
          : health.payment === 'configured' ? 'ready' : 'payments',
    )).catch(() => setStatus('offline'))
  }, [])

  async function handleSignOut() {
    try {
      await signOut()
      setProfileOpen(false)
      setToast('You have been signed out')
      navigate('/')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to sign out right now.')
    }
  }

  return (
    <>
      <div className="announcement"><Sparkles size={14} /> A little more you. A lot more comfortable. <span>Free shipping over ₹1,500</span></div>
      <header className="site-header">
        <button className="icon-button mobile-menu-trigger" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        <Link className="brand" to="/" aria-label="Threadform home"><span className="brand-mark">T</span><span>Thread<span className="brand-studio">form</span><i>.</i></span></Link>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/shop" onClick={() => setMenuOpen(false)}>Shop all</NavLink>
          <NavLink to="/customize/classic-crew" onClick={() => setMenuOpen(false)}>Design your tee</NavLink>
          <NavLink to="/orders" onClick={() => setMenuOpen(false)}>My orders</NavLink>
        </nav>
        <div className="header-actions">
          {authLoading ? <span className="nav-loading" /> : user ? (
            <div className="profile-wrap">
              <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}>
                <CircleUserRound size={20} /><span className="profile-name">{user.name.split(' ')[0]}</span><ChevronDown size={14} />
              </button>
              {profileOpen && <div className="profile-menu"><span className="profile-email">{user.email}</span><Link to="/orders" onClick={() => setProfileOpen(false)}>My orders</Link><button onClick={() => { setProfileOpen(false); setLogoutOpen(true) }}>Sign out</button></div>}
            </div>
          ) : <Link className="login-link" to="/login">Log in <span>/</span> Sign up</Link>}
          <Link className="bag-button" to="/cart" aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={20} /><span>Bag</span><b>{cartCount}</b></Link>
        </div>
      </header>
      {status !== 'ready' && status !== 'loading' && (
        <div className={`system-banner ${status === 'offline' || status === 'database' || status === 'local' || status === 'local-ready' || status === 'demo' ? 'offline' : ''}`}>
          {status === 'payments'
            ? <><LockKeyhole size={15} /> Shop and design are ready. Online checkout activates when Razorpay test keys are set in <code>server/.env</code>.</>
            : status === 'local'
              ? <><span className="status-dot" /> Local development mode: accounts and pending orders are stored on this machine. Add Razorpay test keys in <code>server/.env</code> to enable secure payment.</>
              : status === 'local-ready'
                ? <><span className="status-dot" /> Local development mode: accounts and orders are stored on this machine. Razorpay checkout is configured for sandbox payments.</>
              : status === 'demo'
                ? <><span className="status-dot" /> Demo login only: accounts are saved in this browser and do not sync across devices. Do not reuse a real password; checkout and orders need a backend.</>
            : status === 'database'
              ? <><span className="status-dot" /> MongoDB is unavailable. Browsing and design work; account, order, and checkout features need MongoDB running.</>
              : <><span className="status-dot" /> API is unavailable. Browsing and design work; account, order, and checkout features need the local API running.</>}
          <button aria-label="Dismiss setup message" onClick={() => setStatus('ready')}><X size={15} /></button>
        </div>
      )}
      <main className="page-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/customize/:productId" element={<DesignerPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="/payment-setup" element={<ProtectedRoute><PaymentSetupPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      {logoutOpen && <Modal title="Sign out of Threadform?" onClose={() => setLogoutOpen(false)}><p>Your bag will stay right here for next time.</p><div className="modal-actions"><button className="button button-outline" onClick={() => setLogoutOpen(false)}>Stay signed in</button><button className="button button-dark" onClick={() => { setLogoutOpen(false); void handleSignOut() }}>Sign out</button></div></Modal>}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </>
  )
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> MADE FOR YOUR EVERYDAY</span>
          <h1>Your style.<br />Your <em>design.</em><br />Your tee.</h1>
          <p>Good cotton. Great fit. A little bit of you. Make something you’ll actually want to wear on repeat.</p>
          <div className="hero-actions"><Link className="button button-dark" to="/customize/classic-crew">Design your tee <ArrowRight size={17} /></Link><Link className="text-link" to="/shop">Explore the collection <ArrowDown size={15} /></Link></div>
          <div className="hero-note"><div className="avatar-stack"><span>M</span><span>A</span><span>J</span></div><div><strong>Made by you, worn by you</strong><small>Join 2,400+ happy tee-makers</small></div></div>
        </div>
        <div className="hero-visual">
          <img src={publicAsset('images/hero.jpg')} alt="Friends wearing relaxed, everyday t-shirts" />
          <div className="hero-sticker"><span>THE PERFECT<br />BLANK CANVAS</span><ArrowDown size={17} /></div>
          <div className="hero-image-caption"><span>01 / 04</span><span>THE EVERYDAY EDIT</span></div>
        </div>
        <div className="hero-side-note">MADE FOR YOUR EVERYDAY · MADE FOR YOUR EVERYDAY ·</div>
      </section>
      <section className="promise-strip">
        <span><Check size={16} /> 100% feel-good cotton</span><span><Truck size={17} /> Free shipping over ₹1,500</span><span><Heart size={16} /> Made just for you</span><span><Sparkles size={16} /> Easy, fun customisation</span>
      </section>
      <section className="section collection-section" id="collection">
        <div className="section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> THE GOOD STUFF</span><h2>Meet your new<br className="mobile-break" /> favourite tee.</h2></div><Link className="underlined-link" to="/shop">Shop the collection <ArrowRight size={16} /></Link></div>
        <div className="product-grid">{products.slice(0, 3).map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>
      </section>
      <section className="custom-banner">
        <div className="custom-photo"><img src={publicAsset('images/custom-style.jpg')} alt="Fashion-forward custom tee styling" /></div>
        <div className="custom-copy"><span className="eyebrow"><span className="eyebrow-line" /> YOUR IDEA, YOUR TEE</span><h2>Be the designer<br />you wish you had.</h2><p>Add a little something, change a little something. Make a tee that feels like it could only be yours.</p><Link className="button button-light" to="/customize/classic-crew">Start creating <ArrowRight size={17} /></Link><span className="custom-step">NO DESIGN DEGREE REQUIRED <Sparkles size={14} /></span></div>
      </section>
      <section className="section testimonial"><span className="eyebrow"><span className="eyebrow-line" /> WORD ON THE STREET</span><div className="testimonial-stars" aria-label="5 out of 5 stars"><Star /><Star /><Star /><Star /><Star /></div><blockquote>“It’s the first custom tee I’ve made that actually feels like something I’d buy in a store. The fit is <em>so good.</em>”</blockquote><div className="testimonial-byline"><span>R</span><div><strong>Rhea M.</strong><small>Verified tee-maker</small></div></div></section>
    </>
  )
}

function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addToCart, setToast } = useStore()
  const [color, setColor] = useState(product.colors[0])
  const [size, setSize] = useState('M')
  const [saved, setSaved] = useState(false)
  function quickAdd() {
    addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image, size, color })
  }
  return (
    <article className="product-card" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="product-image-wrap"><Link to={`/customize/${product.id}`} aria-label={`Customize ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" /></Link>{product.badge && <span className="product-badge">{product.badge}</span>}<button className={`save-product ${saved ? 'saved' : ''}`} aria-label={saved ? 'Remove from favourites' : 'Save to favourites'} onClick={() => { setSaved(!saved); setToast(saved ? 'Removed from favourites' : 'Saved to your favourites') }}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button><Link className="quick-customize" to={`/customize/${product.id}`}>Make it yours <ArrowRight size={15} /></Link></div>
      <div className="product-meta"><div><span className="product-category">{product.category}</span><h3>{product.name}</h3></div><strong>{formatPrice(product.price)}</strong></div>
      <div className="product-sub"><span><Star size={13} fill="currentColor" /> {product.rating} <span className="review-count">(128)</span></span><div className="swatch-list" aria-label="Choose a colour">{product.colors.map((shade) => <button key={shade} className={`swatch ${shade === color ? 'selected' : ''}`} style={{ backgroundColor: shade }} aria-label={`Select colour ${shade}`} onClick={() => setColor(shade)} />)}</div></div>
      <div className="quick-add"><label className="visually-hidden" htmlFor={`size-${product.id}`}>Select size</label><select id={`size-${product.id}`} value={size} onChange={(event) => setSize(event.target.value)}>{['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((value) => <option key={value}>{value}</option>)}</select><button className="button button-outline" onClick={quickAdd}>Add to bag <Plus size={15} /></button></div>
    </article>
  )
}

function ShopPage() {
  const [filter, setFilter] = useState('ALL TEES')
  const categories = ['ALL TEES', 'CLASSIC FIT', 'OVERSIZED', 'RELAXED FIT', '100% ORGANIC']
  const filtered = filter === 'ALL TEES' ? products : products.filter((product) => product.category === filter)
  return <section className="section shop-page"><div className="shop-title"><div><span className="eyebrow"><span className="eyebrow-line" /> THE THREADFORM STUDIO</span><h1>A good tee<br />goes a long way.</h1></div><p>Thoughtful fits, feel-good fabric, and a blank canvas for whatever you’ve got in mind.</p></div><div className="filter-row">{categories.map((category) => <button className={filter === category ? 'active' : ''} key={category} onClick={() => setFilter(category)}>{category}</button>)}<span className="filter-count">{filtered.length} styles</span></div><div className="product-grid shop-grid">{filtered.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div></section>
}

function DesignerPage() {
  const { productId } = useParams()
  const product = products.find((item) => item.id === productId) || products[0]
  return <DesignerEditor key={product.id} product={product} />
}

function DesignerEditor({ product }: { product: Product }) {
  const navigate = useNavigate()
  const { addToCart } = useStore()
  const [color, setColor] = useState(product.colors[0])
  const [size, setSize] = useState('M')
  const [designText, setDesignText] = useState('')
  const [textColor, setTextColor] = useState('#25231f')
  const [designPosition, setDesignPosition] = useState({ left: 122, top: 169, scaleX: 1, scaleY: 1 })
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  function saveDesign() {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      size,
      color,
      designText: designText.trim() || undefined,
      designColor: designText.trim() ? textColor : undefined,
      designPosition: designText.trim() ? designPosition : undefined,
    })
    navigate('/cart')
  }
  return (
    <section className="designer-page section">
      <Link to="/shop" className="back-link"><ArrowLeft size={16} /> Back to the tees</Link>
      <div className="designer-layout">
        <div className="designer-preview">
          <div className="preview-toolbar"><span><span className="live-dot" /> LIVE PREVIEW</span><span>FRONT VIEW <ChevronDown size={14} /></span></div>
          <DesignCanvas shirtColor={color} text={designText} textColor={textColor} position={designPosition} onPositionChange={setDesignPosition} />
          <p className="preview-caption"><Sparkles size={14} /> Drag your text to find its perfect spot.</p>
        </div>
        <div className="design-controls">
          <span className="eyebrow"><span className="eyebrow-line" /> THE DESIGN ROOM</span>
          <h1>Make it<br />feel like <em>you.</em></h1>
          <p className="control-intro">Start with a good tee. Add your thing. That’s it.</p>
          <div className="product-control-title"><div><small>{product.category}</small><h2>{product.name}</h2></div><strong>{formatPrice(product.price)}</strong></div>
          <div className="control-group"><div className="control-label"><span>01 / PICK YOUR COLOUR</span><span>{color.toUpperCase()}</span></div><div className="designer-swatches">{product.colors.map((shade, index) => <button key={shade} className={`designer-swatch ${shade === color ? 'selected' : ''}`} style={{ backgroundColor: shade }} aria-label={`Choose shirt colour ${index + 1}`} onClick={() => setColor(shade)} />)}</div></div>
          <div className="control-group"><div className="control-label"><span>02 / ADD YOUR WORDS</span><span>{designText.length}/30</span></div><input className="text-input" value={designText} maxLength={30} onChange={(event) => setDesignText(event.target.value)} placeholder="Your word, phrase, or tiny mantra..." /><div className="text-colors"><span>INK COLOUR</span>{['#25231f', '#ffffff', '#6752d5', '#d26358'].map((shade) => <button key={shade} className={`ink-swatch ${textColor === shade ? 'selected' : ''}`} style={{ backgroundColor: shade }} aria-label={`Select print colour ${shade}`} onClick={() => setTextColor(shade)} />)}</div></div>
          <div className="control-group"><div className="control-label"><span>03 / FIND YOUR FIT</span><button type="button" className="size-guide" onClick={() => setSizeGuideOpen(true)}>Size guide <ArrowRight size={12} /></button></div><div className="size-options">{['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((item) => <button key={item} className={size === item ? 'selected' : ''} onClick={() => setSize(item)}>{item}</button>)}</div></div>
          <button className="button button-dark full-button" onClick={saveDesign}>Add your tee to bag <ArrowRight size={17} /></button>
          <div className="designer-reassurance"><Truck size={15} /> Free shipping over ₹1,500 <span>·</span> Printed just for you</div>
        </div>
      </div>
      {sizeGuideOpen && <Modal title="A fit that feels like you." onClose={() => setSizeGuideOpen(false)}><p>Garment measurements in centimetres. For a relaxed fit, size up.</p><div className="size-table"><div><strong>SIZE</strong><strong>CHEST</strong><strong>LENGTH</strong></div>{[['XS', '86', '64'], ['S', '92', '67'], ['M', '100', '70'], ['L', '108', '73'], ['XL', '116', '76'], ['XXL', '124', '79']].map(([label, chest, length]) => <div key={label}><span>{label}</span><span>{chest} cm</span><span>{length} cm</span></div>)}</div><p className="size-guide-note">Measure a tee you love from armpit to armpit and compare the chest measurement above.</p></Modal>}
    </section>
  )
}

function AuthPage() {
  const [register, setRegister] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { signIn } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const redirect = (location.state as { from?: string } | null)?.from || '/'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity()) return
    setError('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '')
    const email = String(form.get('email') || '')
    const password = String(form.get('password') || '')
    try {
      const result = isDemoAuth
        ? { user: register ? await registerDemoUser(name, email, password) : await loginDemoUser(email, password) }
        : register ? await api.register(name, email, password) : await api.login(email, password)
      signIn(result.user)
      navigate(redirect)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We couldn’t sign you in. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return <section className="auth-page"><div className="auth-image"><img src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85" alt="Soft cotton tee in a sunny studio" /><span>YOUR NEW<br />FAVOURITE TEE<br />IS ONE CLICK AWAY.</span></div><div className="auth-card"><span className="eyebrow"><span className="eyebrow-line" /> GOOD TO SEE YOU</span><h1>{register ? 'Let’s make it official.' : 'Welcome back.'}</h1><p>{register ? 'Create an account to keep your designs and orders close.' : 'Sign in and get back to making something yours.'}</p><div className="auth-tabs"><button className={!register ? 'active' : ''} onClick={() => { setRegister(false); setError('') }}>Log in</button><button className={register ? 'active' : ''} onClick={() => { setRegister(true); setError('') }}>Create account</button></div><form onSubmit={submit} className="form-stack" noValidate>{register && <label>Full name<input name="name" autoComplete="name" required minLength={2} placeholder="What should we call you?" /></label>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : 1} maxLength={72} placeholder={register ? 'At least 8 characters' : 'Your password'} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark full-button" disabled={busy}>{busy ? <><LoaderCircle className="spinner" size={17} /> Just a sec...</> : register ? <>Create your account <ArrowRight size={17} /></> : <>Log in <ArrowRight size={17} /></>}</button></form><p className="secure-note"><LockKeyhole size={13} /> {isDemoAuth ? 'Demo account is stored only in this browser. Use a unique password.' : 'Your details stay yours. Always.'}</p></div></section>
}

function CartPage() {
  const { cart, updateQuantity, removeFromCart, setToast } = useStore()
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 99
  const navigate = useNavigate()
  return <section className="section cart-page"><Link to="/shop" className="back-link"><ArrowLeft size={16} /> Keep looking</Link><div className="cart-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> YOUR BAG</span><h1>A good choice.</h1></div><span>{cart.reduce((sum, item) => sum + item.quantity, 0)} ITEMS</span></div>{cart.length === 0 ? <EmptyState title="Your bag’s having a quiet day." text="Let’s find a tee that changes that." action="Explore the collection" to="/shop" /> : <div className="cart-layout"><div className="cart-items">{cart.map((item) => <CartLine key={item.id} item={item} onQuantity={(qty) => updateQuantity(item.id, qty)} onRemove={() => { removeFromCart(item.id); setToast('Removed from your bag') }} />)}</div><aside className="summary-card"><h2>The little numbers</h2><div className="summary-line"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div className="summary-line"><span>Shipping</span><strong>{shipping ? formatPrice(shipping) : 'On us'}</strong></div>{subtotal < 1500 && <div className="shipping-note"><Truck size={14} /> Spend {formatPrice(1500 - subtotal)} more for free shipping</div>}<div className="summary-line total"><span>Total</span><strong>{formatPrice(subtotal + shipping)}</strong></div><button className="button button-dark full-button" onClick={() => navigate('/checkout')}>Let’s check out <ArrowRight size={17} /></button><div className="secure-note"><LockKeyhole size={13} /> Secure checkout powered by Razorpay</div><div className="payment-icons"><span>UPI</span><span>VISA</span><span>G Pay</span><span>AMEX</span></div></aside></div>}</section>
}

function CartLine({ item, onQuantity, onRemove }: { item: CartItem; onQuantity: (qty: number) => void; onRemove: () => void }) {
  return <article className="cart-line"><Link to={`/customize/${item.productId}`} className="cart-image"><img src={item.image} alt={item.name} /></Link><div className="cart-line-info"><span>{item.name}</span><h2>{item.designText ? `“${item.designText}” edition` : 'Just the way it is'}</h2><p>Colour: <i className="inline-swatch" style={{ backgroundColor: item.color }} /> <span>·</span> Size: {item.size}</p><div className="quantity-control"><button aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => onQuantity(Math.max(1, item.quantity - 1))}><Minus size={13} /></button><span>{item.quantity}</span><button aria-label="Increase quantity" disabled={item.quantity >= 10} onClick={() => onQuantity(Math.min(10, item.quantity + 1))}><Plus size={13} /></button></div></div><div className="cart-line-side"><strong>{formatPrice(item.price * item.quantity)}</strong><button className="remove-button" onClick={onRemove}><Trash2 size={15} /> Remove</button></div></article>
}

function CheckoutPage() {
  const { cart, clearCart } = useStore()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false)
  const [gatewayReady, setGatewayReady] = useState(Boolean(window.Razorpay))
  const [paymentSetup, setPaymentSetup] = useState<'checking' | 'ready' | 'missing' | 'unavailable'>('checking')
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shipping = subtotal >= 1500 ? 0 : 99
  const total = subtotal + shipping
  const { user } = useStore()

  useEffect(() => {
    let active = true
    api.health().then((health) => {
      if (!active) return
      if (health.payment !== 'configured') {
        setPaymentSetup('missing')
        return
      }
      if (window.Razorpay) {
        setGatewayReady(true)
        setPaymentSetup('ready')
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => {
        if (active) {
          setGatewayReady(true)
          setPaymentSetup('ready')
        }
      }
      script.onerror = () => {
        if (active) {
          setPaymentSetup('unavailable')
          setError('Razorpay Checkout could not be loaded. Check your connection and try again.')
        }
      }
      document.body.appendChild(script)
    }).catch(() => {
      if (active) {
        setPaymentSetup('unavailable')
        setError('The payment service is unavailable. Check that the local API is running, then try again.')
      }
    })
    return () => {
      active = false
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!cart.length) return setError('Your bag is empty.')
    if (paymentSetup === 'missing') return setError('Add Razorpay test credentials to server/.env and restart the API to enable checkout.')
    if (paymentSetup === 'unavailable') return setError('The payment service is unavailable. Check the API and Razorpay Checkout connection.')
    if (!gatewayReady || !window.Razorpay) return setError('Razorpay Checkout is still loading. Please try again in a moment.')
    setBusy(true)
    const data = new FormData(event.currentTarget)
    const address = {
      name: String(data.get('name') || ''),
      email: String(data.get('email') || ''),
      phone: String(data.get('phone') || ''),
      street: String(data.get('street') || ''),
      city: String(data.get('city') || ''),
      state: String(data.get('state') || ''),
      pincode: String(data.get('pincode') || ''),
    }
    try {
      const order = await api.createOrder(cart.map(({ productId, quantity, size, color, designText, designColor, designPosition }) => ({
        productId, quantity, size, color, designText, designColor, designPosition,
      })), address)
      const payment = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Threadform',
        description: 'Your custom Threadform order',
        order_id: order.razorpayOrderId,
        prefill: { name: address.name, email: address.email, contact: address.phone },
        theme: { color: '#6350ca' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await api.verifyPayment(order.orderId, response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
            setVerified(true)
            clearCart()
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Payment verification did not complete. Please contact support with your order details.')
          } finally {
            setBusy(false)
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      })
      payment.on('payment.failed', (response) => {
        void api.paymentFailed(order.orderId, order.razorpayOrderId).catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : 'Payment failure could not be recorded.')
        })
        setError(response.error?.description || 'Payment was not completed. Your order has not been marked as paid.')
        setBusy(false)
      })
      payment.open()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We couldn’t start checkout. Please try again.')
      setBusy(false)
    }
  }

  if (!cart.length && !verified) return <section className="section"><EmptyState title="Nothing to check out just yet." text="Your next favourite tee is waiting." action="Go to your bag" to="/cart" /></section>
  if (verified) return <section className="section success-page"><div className="success-icon"><Check size={34} /></div><span className="eyebrow"><span className="eyebrow-line" /> PAYMENT VERIFIED</span><h1>It’s official.<br /><em>Your tee is on its way.</em></h1><p>Your payment was verified securely, and your order is in the studio queue.</p><Link className="button button-dark" to="/orders">View your order <ArrowRight size={17} /></Link></section>

  return <section className="section checkout-page"><Link to="/cart" className="back-link"><ArrowLeft size={16} /> Back to your bag</Link><div className="checkout-title"><span className="eyebrow"><span className="eyebrow-line" /> ALMOST YOURS</span><h1>Let’s get it to you.</h1></div><div className="checkout-layout"><form className="checkout-form" onSubmit={submit}><div className="form-section"><span className="checkout-step">01</span><div><h2>Where should it go?</h2><p>We’ll only use this to deliver your order.</p></div></div><div className="checkout-fields"><label>Full name<input name="name" autoComplete="name" required minLength={2} defaultValue={user?.name} /></label><label>Email address<input name="email" type="email" autoComplete="email" required defaultValue={user?.email} /></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" required minLength={10} maxLength={16} placeholder="+91 98765 43210" /></label><label className="wide-field">Address<input name="street" autoComplete="street-address" required minLength={5} placeholder="House number and street name" /></label><label>City<input name="city" autoComplete="address-level2" required /></label><label>State<input name="state" autoComplete="address-level1" required /></label><label>PIN code<input name="pincode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="postal-code" required /></label></div><div className="form-section payment-section"><span className="checkout-step">02</span><div><h2>Payment, your way.</h2><p>UPI, cards, net banking & more via Razorpay.</p></div></div>{paymentSetup === 'missing' && <p className="setup-notice" role="status">MongoDB is not required in local development. Add Razorpay test keys to <code>server/.env</code> to enable real sandbox checkout. No payment will be simulated.</p>}{paymentSetup === 'unavailable' && <p className="form-error" role="alert">{error || 'The payment service is unavailable. Please try again.'}</p>}{paymentSetup === 'ready' && error && <p className="form-error" role="alert">{error}</p>}<button type={paymentSetup === 'missing' ? 'button' : 'submit'} onClick={paymentSetup === 'missing' ? () => navigate('/payment-setup') : undefined} className="button button-dark full-button" disabled={busy || paymentSetup === 'checking'}>{busy ? <><LoaderCircle className="spinner" size={17} /> Connecting to Razorpay...</> : paymentSetup === 'checking' ? <>Checking secure checkout...</> : paymentSetup === 'missing' ? <>Continue to payment setup <ArrowRight size={15} /></> : paymentSetup === 'unavailable' ? <>Retry secure checkout · {formatPrice(total)} <LockKeyhole size={15} /></> : <>Pay {formatPrice(total)} securely <LockKeyhole size={15} /></>}</button><p className="secure-note"><LockKeyhole size={13} /> Your payment details are encrypted and never stored here.</p></form><aside className="summary-card checkout-summary"><h2>Your good choices</h2>{cart.map((item) => <div className="checkout-mini" key={item.id}><img src={item.image} alt="" /><div><strong>{item.name}</strong><span>Size {item.size} · Qty {item.quantity}</span></div><b>{formatPrice(item.price * item.quantity)}</b></div>)}<div className="summary-line"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div className="summary-line"><span>Shipping</span><strong>{shipping ? formatPrice(shipping) : 'On us'}</strong></div><div className="summary-line total"><span>Total</span><strong>{formatPrice(total)}</strong></div></aside></div></section>
}

function PaymentSetupPage() {
  return <section className="section success-page"><div className="success-icon"><LockKeyhole size={30} /></div><span className="eyebrow"><span className="eyebrow-line" /> PAYMENT SETUP</span><h1>One last step.<br /><em>Then you can pay.</em></h1><p>To continue to a real sandbox payment, add your Razorpay test keys to <code>server/.env</code> and restart the API.</p><div className="setup-notice" role="status">Your bag is unchanged. No order has been placed and no payment has been taken.</div><Link className="button button-dark" to="/checkout">Back to checkout <ArrowRight size={16} /></Link></section>
}

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    api.orders().then(({ orders: result }) => setOrders(result)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Orders could not be loaded.')).finally(() => setLoading(false))
  }, [])
  return <section className="section orders-page"><span className="eyebrow"><span className="eyebrow-line" /> YOUR TEE STORY</span><h1>Orders, coming right up.</h1><p className="orders-sub">A little look at what you’ve made and where it’s headed.</p>{loading ? <div className="loading-state"><LoaderCircle className="spinner" /> Loading your orders...</div> : error ? <p className="form-error" role="alert">{error}</p> : orders.length ? <div className="orders-list">{orders.map((order) => <article className="order-card" key={order._id}><div className="order-card-top"><div><span>ORDER PLACED</span><strong>{new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</strong></div><div><span>ORDER TOTAL</span><strong>{formatPrice(order.total)}</strong></div><span className={`order-status ${order.status}`}>{order.status === 'paid' ? 'Confirmed' : order.status === 'pending' ? 'Payment pending' : 'Payment failed'}</span></div><div className="order-card-body">{order.items.map((item, index) => <div className="order-item" key={`${order._id}-${index}`}><div className="order-item-swatch" style={{ backgroundColor: item.color }} /><div><strong>{item.name}</strong><span>Size {item.size} · Qty {item.quantity}{item.designText ? ` · “${item.designText}”` : ''}</span></div></div>)}</div></article>)}</div> : <EmptyState title="No orders yet. That’s a blank canvas." text="Your first Threadform creation is just around the corner." action="Find your first tee" to="/shop" />}</section>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useStore()
  const location = useLocation()
  if (authLoading) return <div className="loading-state"><LoaderCircle className="spinner" /> Checking your account...</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function EmptyState({ title, text, action, to }: { title: string; text: string; action: string; to: string }) {
  return <div className="empty-state"><div className="empty-graphic"><ShoppingBag size={28} /></div><h2>{title}</h2><p>{text}</p><Link className="button button-dark" to={to}>{action} <ArrowRight size={16} /></Link></div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button><span className="eyebrow"><span className="eyebrow-line" /> THREADFORM</span><h2 id="modal-title">{title}</h2>{children}</section></div>
}

function NotFoundPage() {
  return <div className="empty-state not-found"><div className="empty-graphic">404</div><h2>Looks like this tee is inside out.</h2><p>We can’t find that page, but the good stuff is right this way.</p><Link className="button button-dark" to="/">Back to Threadform <ArrowRight size={16} /></Link></div>
}

function Footer() {
  return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><Link className="brand" to="/" aria-label="Threadform home"><span className="brand-mark">T</span><span>Thread<span className="brand-studio">form</span><i>.</i></span></Link><p>Your Style. Your Design. Your Tee.</p><a className="instagram-link" href="https://www.instagram.com/" target="_blank" rel="noreferrer"><Camera size={16} /> Come say hi</a></div><div className="footer-links"><div><strong>THE STUDIO</strong><Link to="/shop">Shop all tees</Link><Link to="/customize/classic-crew">Design your own</Link></div><div><strong>HERE FOR YOU</strong><Link to="/orders">Track your order</Link><a href="mailto:hello@threadform.example">Get in touch</a><Link to="/login">Your account</Link></div></div><div className="footer-note"><Sparkles size={17} /><span>Made with a little<br />more you in mind.</span></div></div><div className="footer-bottom"><span>© Threadform. Made to be worn.</span><span>Soft on you. A little softer on the planet.</span><span>India · ₹ INR <ChevronRight size={12} /></span></div></footer>
}

export default function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><StoreProvider><AppFrame /></StoreProvider></BrowserRouter>
}
