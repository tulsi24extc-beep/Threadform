import type { User } from './types'

export const isDemoAuth = import.meta.env.BASE_URL === '/Threadform/'

const accountsKey = 'threadform_demo_accounts_v1'
const sessionKey = 'threadform_demo_session_v1'
const iterations = 310_000

type DemoAccount = User & { salt: string; passwordHash: string }

function isDemoAccount(account: unknown): account is DemoAccount {
  if (typeof account !== 'object' || account === null) return false
  return 'id' in account
    && typeof account.id === 'string'
    && 'name' in account
    && typeof account.name === 'string'
    && 'email' in account
    && typeof account.email === 'string'
    && 'salt' in account
    && typeof account.salt === 'string'
    && 'passwordHash' in account
    && typeof account.passwordHash === 'string'
}

function readAccounts(): DemoAccount[] {
  const saved = localStorage.getItem(accountsKey)
  if (!saved) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(saved)
  } catch {
    throw new Error('Demo account data is unreadable. Clear this site’s browser storage and create an account again.')
  }

  if (
    typeof parsed !== 'object'
    || parsed === null
    || !('accounts' in parsed)
    || !Array.isArray(parsed.accounts)
    || !parsed.accounts.every(isDemoAccount)
  ) {
    throw new Error('Demo account data is invalid. Clear this site’s browser storage and create an account again.')
  }

  return parsed.accounts as DemoAccount[]
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(new TextEncoder().encode(password)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(salt), iterations }, key, 256)
  return encode(new Uint8Array(bits))
}

export function getDemoUser(): User | null {
  const userId = localStorage.getItem(sessionKey)
  if (!userId) return null

  const account = readAccounts().find(({ id }) => id === userId)
  if (!account) {
    localStorage.removeItem(sessionKey)
    return null
  }

  return { id: account.id, name: account.name, email: account.email }
}

export async function registerDemoUser(name: string, email: string, password: string): Promise<User> {
  const normalizedName = name.trim()
  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedName.length < 2 || normalizedName.length > 70) throw new Error('Enter a name between 2 and 70 characters.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) throw new Error('Enter a valid email address.')
  if (password.length < 8 || password.length > 72) throw new Error('Your password must be between 8 and 72 characters.')

  const accounts = readAccounts()
  if (accounts.some(({ email: savedEmail }) => savedEmail === normalizedEmail)) {
    throw new Error('A demo account with this email already exists in this browser.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const user: User = { id: crypto.randomUUID(), name: normalizedName, email: normalizedEmail }
  accounts.push({ ...user, salt: encode(salt), passwordHash: await hashPassword(password, salt) })
  localStorage.setItem(accountsKey, JSON.stringify({ accounts }))
  localStorage.setItem(sessionKey, user.id)
  return user
}

export async function loginDemoUser(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase()
  const account = readAccounts().find(({ email: savedEmail }) => savedEmail === normalizedEmail)
  if (!account) throw new Error('No demo account exists for this email in this browser. Create an account first.')

  const hash = await hashPassword(password, Uint8Array.from(atob(account.salt), (character) => character.charCodeAt(0)))
  if (hash !== account.passwordHash) throw new Error('Email or password is incorrect.')

  const user = { id: account.id, name: account.name, email: account.email }
  localStorage.setItem(sessionKey, user.id)
  return user
}

export function logoutDemoUser() {
  localStorage.removeItem(sessionKey)
}
