import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'gcse-scheduler'
const DB_VERSION = 2
const STORE_NAME = 'state'

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export async function loadFromIdbRaw<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  return db.get(STORE_NAME, key)
}

export async function saveToIdbRaw<T>(key: string, value: T): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, value, key)
}
