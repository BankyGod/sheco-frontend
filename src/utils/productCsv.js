import { toPesewas } from './money'

const HEADER_ALIASES = {
  name: ['name', 'product', 'product name', 'product_name'],
  genericName: ['genericname', 'generic name', 'generic_name', 'generic'],
  category: ['category'],
  unit: ['unit'],
  costPrice: ['costprice', 'cost price', 'cost_price', 'cost'],
  sellingPrice: ['sellingprice', 'selling price', 'selling_price', 'selling', 'price'],
  reorderLevel: ['reorderlevel', 'reorder level', 'reorder_level', 'reorder'],
  prescriptionOnly: [
    'prescriptiononly',
    'prescription only',
    'prescription_only',
    'rx',
    'rx only',
  ],
  active: ['active'],
}

const UNIT_OPTIONS = new Set([
  'tablet',
  'capsule',
  'blister',
  'bottle',
  'sachet',
  'syrup',
  'ml',
  'box',
  'tube',
  'vial',
  'ampoule',
  'pack',
])

export const PRODUCT_CSV_TEMPLATE = [
  'name,genericName,category,unit,costPrice,sellingPrice,reorderLevel,prescriptionOnly,active',
  'Paracetamol,Acetaminophen,Pain Relief,tablet,10,15,10,false,true',
  'Amoxicillin,Amoxicillin,Antibiotic,capsule,20,30,5,true,true',
].join('\n')

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    const next = line[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  cells.push(current.trim())
  return cells
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'rx'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false
  throw new Error(`Invalid boolean value "${value}"`)
}

function mapHeaders(headerRow) {
  const indexByField = {}
  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized) && indexByField[field] == null) {
        indexByField[field] = index
      }
    }
  })

  const required = ['name', 'genericName', 'category', 'unit', 'costPrice', 'sellingPrice']
  const missing = required.filter((field) => indexByField[field] == null)
  if (missing.length) {
    throw new Error(`CSV is missing required columns: ${missing.join(', ')}`)
  }
  return indexByField
}

function cell(row, indexByField, field) {
  const index = indexByField[field]
  if (index == null) return ''
  return row[index] ?? ''
}

export function parseProductCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    throw new Error('CSV needs a header row and at least one product row')
  }

  const headerRow = parseCsvLine(lines[0])
  const indexByField = mapHeaders(headerRow)
  const products = []
  const errors = []

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1
    const row = parseCsvLine(lines[i])
    if (row.every((value) => !String(value || '').trim())) continue

    try {
      const name = String(cell(row, indexByField, 'name')).trim()
      const genericName = String(cell(row, indexByField, 'genericName')).trim()
      const category = String(cell(row, indexByField, 'category')).trim()
      const unitRaw = String(cell(row, indexByField, 'unit')).trim().toLowerCase()
      const costGhs = Number(String(cell(row, indexByField, 'costPrice')).replace(/,/g, ''))
      const sellingGhs = Number(String(cell(row, indexByField, 'sellingPrice')).replace(/,/g, ''))
      const reorderRaw = cell(row, indexByField, 'reorderLevel')
      const reorderLevel =
        reorderRaw === '' || reorderRaw == null ? 10 : Number(String(reorderRaw).replace(/,/g, ''))
      const prescriptionOnly = parseBoolean(cell(row, indexByField, 'prescriptionOnly'), false)
      const active = parseBoolean(cell(row, indexByField, 'active'), true)

      if (!name) throw new Error('Name is required')
      if (!genericName) throw new Error('Generic name is required')
      if (!category) throw new Error('Category is required')
      if (!unitRaw) throw new Error('Unit is required')
      if (!UNIT_OPTIONS.has(unitRaw)) {
        throw new Error(`Unsupported unit "${unitRaw}"`)
      }
      if (Number.isNaN(costGhs) || costGhs < 0) throw new Error('Invalid cost price')
      if (Number.isNaN(sellingGhs) || sellingGhs <= 0) throw new Error('Invalid selling price')
      if (sellingGhs < costGhs) throw new Error('Selling price should be at least the cost price')
      if (Number.isNaN(reorderLevel) || reorderLevel < 0) throw new Error('Invalid reorder level')

      products.push({
        row: rowNumber,
        name,
        genericName,
        category,
        unit: unitRaw,
        costPrice: toPesewas(costGhs),
        sellingPrice: toPesewas(sellingGhs),
        reorderLevel,
        prescriptionOnly,
        active,
      })
    } catch (err) {
      errors.push({ row: rowNumber, error: err.message || 'Invalid row' })
    }
  }

  if (!products.length && !errors.length) {
    throw new Error('No product rows found in CSV')
  }

  return { products, errors }
}

export function downloadProductCsvTemplate() {
  const blob = new Blob([PRODUCT_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sheco-products-template.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
