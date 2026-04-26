export function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime()
  const diffSec = Math.round((Date.now() - ts) / 1000)

  if (diffSec < 60) return 'agora há pouco'
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60)
    return `há ${m} ${m === 1 ? 'minuto' : 'minutos'}`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return `há ${h} ${h === 1 ? 'hora' : 'horas'}`
  }
  if (diffSec < 86400 * 30) {
    const d = Math.floor(diffSec / 86400)
    return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
  }
  if (diffSec < 86400 * 365) {
    const months = Math.floor(diffSec / (86400 * 30))
    return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
  }
  const years = Math.floor(diffSec / (86400 * 365))
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`
}

export function initials(name: string | null | undefined, fallback: string): string {
  const source = (name?.trim() || fallback).split(/\s+/)
  const first = source[0]?.[0] ?? '?'
  const last = source.length > 1 ? source[source.length - 1][0] : ''
  return (first + last).toUpperCase()
}
