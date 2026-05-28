import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function usePermissoes(session) {
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [permissoes, setPermissoes] = useState([])
  const [obrasIds,   setObrasIds]   = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!session?.user) return
    load()
  }, [session?.user?.id])

  async function load() {
    // Verifica se tem perfil cadastrado
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    // Se não tem perfil ou é admin, tem acesso total
    if (!profile || profile.role === 'admin') {
      setIsAdmin(true)
      setLoading(false)
      return
    }

    // Busca permissões
    const { data: perms } = await supabase
      .from('user_permissoes')
      .select('*')
      .eq('user_id', session.user.id)

    setPermissoes(perms ?? [])
    setObrasIds([...new Set((perms ?? []).filter(p => p.pode_ver).map(p => p.obra_id))])
    setLoading(false)
  }

  function podeVerModulo(modulo) {
    if (isAdmin) return true
    return permissoes.some(p => p.modulo === modulo && p.pode_ver)
  }

  function podeEditarModulo(modulo) {
    if (isAdmin) return true
    return permissoes.some(p => p.modulo === modulo && p.pode_editar)
  }

  function podeVerObra(obraId) {
    if (isAdmin) return true
    return obrasIds.includes(obraId)
  }

  function obrasPermitidas(todasObras) {
    if (isAdmin) return todasObras
    return todasObras.filter(o => obrasIds.includes(o.id))
  }

  return { isAdmin, permissoes, obrasIds, loading, podeVerModulo, podeEditarModulo, podeVerObra, obrasPermitidas }
}
