/** Money is stored as integer pesewas (100 = GHS 1.00). */

export function formatGhs(pesewas) {
  const value = (Number(pesewas) || 0) / 100
  return `GHS ${value.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function toPesewas(cedis) {
  return Math.round(Number(cedis) * 100)
}

export function fromPesewas(pesewas) {
  return (Number(pesewas) || 0) / 100
}
