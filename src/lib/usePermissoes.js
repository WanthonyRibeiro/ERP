import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function usePermissoes(session) {
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [permsData,   setPermsData]  = useState([])
  const [obrasIds,   setObrasIds]   = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!session?.user) return
    load()
  }, [session?.user?.id])

  async function load() {
    console.log('usePermissoes: loading for', session.user.email)

    const { data: profile, error: e1 } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    console.log('usePermissoes: profile=', profile, 'error=', e1)

    if (!profile || profile.role === 'admin') {
      console.log('usePermissoes: is admin')
      setIsAdmin(true)
      setLoading(false)
      return
    }

    const { data: perms, error: e2 } = await supabase
      .from('user_permissoes')
      .select('*')
      .eq('user_id', session.user.id)

    console.log('usePermissoes: perms=', perms, 'error=', e2)

    setPermsData(perms ?? [])
    setObrasIds([...new Set((perms ?? []).filter(p => p.pode_ver).map(p => p.obra_id))])
    setLoading(false)
  }

  function podeVerModulo(modulo) {
    if (isAdmin) return true
    return permsData.some(p => p.modulo === modulo && p.pode_ver)
  }

  function podeEditarModulo(modulo) {
    if (isAdmin) return true
    return permsData.some(p => p.modulo === modulo && p.pode_editar)
  }

  function podeVerObra(obraId) {
    if (isAdmin) return true
    return obrasIds.includes(obraId)
  }

  function obrasPermitidas(todasObras) {
    if (isAdmin) return todasObras
    return todasObras.filter(o => obrasIds.includes(o.id))
  }

  return { isAdmin, permissoes: permsData, obrasIds, loading, podeVerModulo, podeEditarModulo, podeVerObra, obrasPermitidas }
}
