import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PublicProfile } from '@shared'
import { api } from './api'

interface ProfileContextValue {
  profile: PublicProfile | null
  loading: boolean
  upload: (file: File) => Promise<PublicProfile>
  patch: (patch: Record<string, unknown>) => Promise<PublicProfile>
  remove: () => Promise<void>
  reload: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { profile } = await api.getResume()
      setProfile(profile)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const upload = useCallback(async (file: File) => {
    const { profile } = await api.uploadResume(file)
    setProfile(profile)
    return profile
  }, [])

  const patch = useCallback(async (patch: Record<string, unknown>) => {
    const { profile } = await api.patchResume(patch)
    setProfile(profile)
    return profile
  }, [])

  const remove = useCallback(async () => {
    await api.deleteResume()
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({ profile, loading, upload, patch, remove, reload }),
    [profile, loading, upload, patch, remove, reload],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>')
  return ctx
}
