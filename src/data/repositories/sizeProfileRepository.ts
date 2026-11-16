import { newId } from '../../core/ids'
import type { Id, Measurements, SizeProfile, StandardSize } from '../../core/types'
import { db } from '../db'

/**
 * Custom size profiles.
 *
 * A profile is a named set of body measurements that replaces the standard size
 * table — for the user whose own measurements fall between two sizes, which is
 * most people.
 */

export async function listSizeProfiles(): Promise<SizeProfile[]> {
  return db.sizeProfiles.orderBy('name').toArray()
}

export async function getSizeProfile(id: Id): Promise<SizeProfile | undefined> {
  return db.sizeProfiles.get(id)
}

export async function createSizeProfile(
  name: string,
  measurements: Measurements,
  basedOn: StandardSize | null = null,
): Promise<SizeProfile> {
  const now = Date.now()
  const profile: SizeProfile = {
    id: newId(),
    name: name.trim() === '' ? 'Mes mesures' : name.trim(),
    basedOn,
    measurements,
    createdAt: now,
    updatedAt: now,
  }
  await db.sizeProfiles.add(profile)
  return profile
}

export async function updateSizeProfile(
  id: Id,
  patch: Partial<Pick<SizeProfile, 'name' | 'measurements' | 'basedOn'>>,
): Promise<void> {
  const updated = await db.sizeProfiles.update(id, { ...patch, updatedAt: Date.now() })
  if (updated === 0) {
    throw new Error(`Le profil de taille ${id} n’existe plus`)
  }
}

export async function deleteSizeProfile(id: Id): Promise<void> {
  await db.sizeProfiles.delete(id)
}
