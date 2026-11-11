import { fromPesewas } from './money'

function sellerName(users, salespersonId, salespersonName = '') {
  if (salespersonName) return salespersonName
  const match = users.find((u) => String(u.id) === String(salespersonId))
  return match?.name || salespersonId || 'Unknown'
}

function productName(products, productId) {
  return products.find((p) => p.id === productId)?.name || productId
}

function productMeta(products, productId) {
  const product = products.find((p) => p.id === productId)
  return {
    name: product?.name || productId,
    genericName: product?.genericName || '',
    category: product?.category || '',
    unit: product?.unit || '',
  }
}

function periodLabel(from, to) {
  if (from && to) return `${from}_to_${to}`
  if (from) return `from_${from}`
  if (to) return `to_${to}`
  return 'all_time'
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function saleProfit(sale) {
  return (sale.items || []).reduce(
    (sum, item) =>
      sum + (item.unitSellingPrice - (item.unitCostPrice || 0)) * item.quantity,
    0,
  )
}

function saleItemCount(sale) {
  return (sale.items || []).reduce((sum, item) => sum + item.quantity, 0)
}

function buildAnalytics(report, users, products) {
  const sales = report.sales || []
  const revenue = report.totals.revenue || 0
  const profit = report.totals.profit || 0
  const count = report.totals.count || 0
  const avgSale = count ? revenue / count : 0
  const marginPct = revenue ? (profit / revenue) * 100 : 0
  const cashPct = revenue ? (report.totals.cash / revenue) * 100 : 0
  const momoPct = revenue ? (report.totals.momo / revenue) * 100 : 0

  const dailyMap = {}
  for (const sale of sales) {
    const day = sale.createdAt.slice(0, 10)
    if (!dailyMap[day]) {
      dailyMap[day] = { day, sales: 0, items: 0, revenue: 0, profit: 0, cash: 0, momo: 0 }
    }
    dailyMap[day].sales += 1
    dailyMap[day].items += saleItemCount(sale)
    dailyMap[day].revenue += sale.total
    dailyMap[day].profit += saleProfit(sale)
    if (sale.payment.method === 'cash') dailyMap[day].cash += sale.total
    if (sale.payment.method === 'momo') dailyMap[day].momo += sale.total
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day))
  const bestDay = [...daily].sort((a, b) => b.revenue - a.revenue)[0] || null

  const productMap = {}
  for (const sale of sales) {
    for (const item of sale.items || []) {
      if (!productMap[item.productId]) {
        const meta = productMeta(products, item.productId)
        productMap[item.productId] = {
          productId: item.productId,
          ...meta,
          quantity: 0,
          salesCount: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        }
      }
      const row = productMap[item.productId]
      const lineRevenue = item.unitSellingPrice * item.quantity
      const lineCost = (item.unitCostPrice || 0) * item.quantity
      row.quantity += item.quantity
      row.salesCount += 1
      row.revenue += lineRevenue
      row.cost += lineCost
      row.profit += lineRevenue - lineCost
    }
  }
  const productsPerf = Object.values(productMap).sort((a, b) => b.revenue - a.revenue)
  const topProducts = productsPerf.slice(0, 10)
  const slowProducts = [...productsPerf].sort((a, b) => a.quantity - b.quantity).slice(0, 10)

  const staff = (report.bySalesperson || []).map((row) => {
    const staffSales = sales.filter((s) => s.salespersonId === row.salespersonId)
    const items = staffSales.reduce((sum, sale) => sum + saleItemCount(sale), 0)
    const cash = staffSales
      .filter((s) => s.payment.method === 'cash')
      .reduce((sum, s) => sum + s.total, 0)
    const momo = staffSales
      .filter((s) => s.payment.method === 'momo')
      .reduce((sum, s) => sum + s.total, 0)
    return {
      name: sellerName(users, row.salespersonId, row.salespersonName),
      count: row.count,
      items,
      revenue: row.revenue,
      profit: row.profit,
      avgSale: row.count ? row.revenue / row.count : 0,
      marginPct: row.revenue ? (row.profit / row.revenue) * 100 : 0,
      cash,
      momo,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  const lineItems = []
  for (const sale of sales) {
    for (const item of sale.items || []) {
      const meta = productMeta(products, item.productId)
      const lineRevenue = item.unitSellingPrice * item.quantity
      const lineCost = (item.unitCostPrice || 0) * item.quantity
      lineItems.push({
        receipt: sale.receiptNumber,
        date: new Date(sale.createdAt).toLocaleString(),
        salesperson: sellerName(users, sale.salespersonId, sale.salespersonName),
        product: meta.name,
        genericName: meta.genericName,
        category: meta.category,
        unit: meta.unit,
        batchId: item.batchId || '',
        quantity: item.quantity,
        unitSelling: fromPesewas(item.unitSellingPrice),
        unitCost: fromPesewas(item.unitCostPrice || 0),
        lineRevenue: fromPesewas(lineRevenue),
        lineCost: fromPesewas(lineCost),
        lineProfit: fromPesewas(lineRevenue - lineCost),
        prescriptionRef: item.prescriptionRef || '',
        paymentMethod: sale.payment.method,
      })
    }
  }

  const salesRows = sales.map((sale) => {
    const profit = saleProfit(sale)
    return {
      receipt: sale.receiptNumber,
      date: new Date(sale.createdAt).toLocaleString(),
      day: sale.createdAt.slice(0, 10),
      salesperson: sellerName(users, sale.salespersonId, sale.salespersonName),
      device: sale.deviceId || '',
      method: sale.payment.method,
      network: sale.payment.network || '',
      reference: sale.payment.reference || '',
      itemLines: (sale.items || []).length,
      itemQty: saleItemCount(sale),
      tendered: fromPesewas(sale.payment.amountTendered || 0),
      change: fromPesewas(sale.payment.change || 0),
      total: fromPesewas(sale.total),
      profit: fromPesewas(profit),
      marginPct: sale.total ? (profit / sale.total) * 100 : 0,
      syncFlag: sale.syncFlag || '',
      needsReview: sale.needsReview ? 'Yes' : 'No',
    }
  })

  return {
    count,
    revenue,
    profit,
    avgSale,
    marginPct,
    cashPct,
    momoPct,
    bestDay,
    daily,
    productsPerf,
    topProducts,
    slowProducts,
    staff,
    lineItems,
    salesRows,
    totalItems: lineItems.reduce((sum, row) => sum + row.quantity, 0),
  }
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7BA8' },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
    }
  })
  row.height = 22
}

function styleTitle(cell) {
  cell.font = { bold: true, size: 16, color: { argb: 'FF1A1A1A' } }
}

function styleSection(cell) {
  cell.font = { bold: true, size: 12, color: { argb: 'FF2E7BA8' } }
}

function applyFormats(sheet, { moneyCols = [], pctCols = [], skipHeader = true } = {}) {
  sheet.eachRow((row, rowNumber) => {
    if (skipHeader && rowNumber === 1) return
    moneyCols.forEach((col) => {
      const cell = row.getCell(col)
      if (typeof cell.value === 'number') cell.numFmt = '#,##0.00'
    })
    pctCols.forEach((col) => {
      const cell = row.getCell(col)
      if (typeof cell.value === 'number') cell.numFmt = '0.00"%"'
    })
  })
}

function autosize(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
}

function addTableSheet(workbook, name, columns, rows, { moneyCols = [], pctCols = [] } = {}) {
  const sheet = workbook.addWorksheet(name)
  sheet.columns = columns
  styleHeaderRow(sheet.getRow(1))
  sheet.addRows(rows)
  applyFormats(sheet, {
    moneyCols,
    pctCols,
  })
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    }
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  return sheet
}

export function exportReportCsv(report, users, products = [], { from = '', to = '' } = {}) {
  const analytics = buildAnalytics(report, users, products)
  const rows = [
    ['Sheco Pharmacy Full Sales Report'],
    ['Period from', from || 'All', 'Period to', to || 'All'],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Executive summary'],
    ['Sales count', analytics.count],
    ['Units sold', analytics.totalItems],
    ['Revenue (GHS)', fromPesewas(analytics.revenue)],
    ['Cash (GHS)', fromPesewas(report.totals.cash)],
    ['Mobile Money (GHS)', fromPesewas(report.totals.momo)],
    ['Profit (GHS)', fromPesewas(analytics.profit)],
    ['Average sale (GHS)', fromPesewas(analytics.avgSale)],
    ['Profit margin %', Number(analytics.marginPct.toFixed(2))],
    ['Cash share %', Number(analytics.cashPct.toFixed(2))],
    ['MoMo share %', Number(analytics.momoPct.toFixed(2))],
    ['Best day', analytics.bestDay?.day || ''],
    ['Best day revenue (GHS)', analytics.bestDay ? fromPesewas(analytics.bestDay.revenue) : 0],
    [],
    ['Sales'],
    [
      'Receipt',
      'Date',
      'Day',
      'Salesperson',
      'Device',
      'Method',
      'Network',
      'Reference',
      'Item lines',
      'Units',
      'Tendered (GHS)',
      'Change (GHS)',
      'Total (GHS)',
      'Profit (GHS)',
      'Margin %',
      'Needs review',
    ],
    ...analytics.salesRows.map((row) => [
      row.receipt,
      row.date,
      row.day,
      row.salesperson,
      row.device,
      row.method,
      row.network,
      row.reference,
      row.itemLines,
      row.itemQty,
      row.tendered,
      row.change,
      row.total,
      row.profit,
      Number(row.marginPct.toFixed(2)),
      row.needsReview,
    ]),
    [],
    ['Sale line items'],
    [
      'Receipt',
      'Date',
      'Salesperson',
      'Product',
      'Generic name',
      'Category',
      'Unit',
      'Qty',
      'Unit selling (GHS)',
      'Unit cost (GHS)',
      'Line revenue (GHS)',
      'Line cost (GHS)',
      'Line profit (GHS)',
      'Rx ref',
      'Payment',
    ],
    ...analytics.lineItems.map((row) => [
      row.receipt,
      row.date,
      row.salesperson,
      row.product,
      row.genericName,
      row.category,
      row.unit,
      row.quantity,
      row.unitSelling,
      row.unitCost,
      row.lineRevenue,
      row.lineCost,
      row.lineProfit,
      row.prescriptionRef,
      row.paymentMethod,
    ]),
    [],
    ['Product performance'],
    [
      'Product',
      'Generic name',
      'Category',
      'Unit',
      'Qty sold',
      'Times sold',
      'Revenue (GHS)',
      'Cost (GHS)',
      'Profit (GHS)',
      'Margin %',
    ],
    ...analytics.productsPerf.map((row) => [
      row.name,
      row.genericName,
      row.category,
      row.unit,
      row.quantity,
      row.salesCount,
      fromPesewas(row.revenue),
      fromPesewas(row.cost),
      fromPesewas(row.profit),
      row.revenue ? Number(((row.profit / row.revenue) * 100).toFixed(2)) : 0,
    ]),
    [],
    ['Daily trend'],
    ['Day', 'Sales', 'Units', 'Revenue (GHS)', 'Profit (GHS)', 'Cash (GHS)', 'MoMo (GHS)'],
    ...analytics.daily.map((row) => [
      row.day,
      row.sales,
      row.items,
      fromPesewas(row.revenue),
      fromPesewas(row.profit),
      fromPesewas(row.cash),
      fromPesewas(row.momo),
    ]),
    [],
    ['By salesperson'],
    [
      'Name',
      'Sales',
      'Units',
      'Revenue (GHS)',
      'Profit (GHS)',
      'Avg sale (GHS)',
      'Margin %',
      'Cash (GHS)',
      'MoMo (GHS)',
    ],
    ...analytics.staff.map((row) => [
      row.name,
      row.count,
      row.items,
      fromPesewas(row.revenue),
      fromPesewas(row.profit),
      fromPesewas(row.avgSale),
      Number(row.marginPct.toFixed(2)),
      fromPesewas(row.cash),
      fromPesewas(row.momo),
    ]),
    [],
    ['MoMo reconciliation'],
    ['Receipt', 'Network', 'Reference', 'Amount (GHS)', 'Date', 'Salesperson'],
    ...report.momoTxns.map((txn) => [
      txn.receiptNumber,
      txn.network || '',
      txn.reference || '',
      fromPesewas(txn.amount),
      new Date(txn.createdAt).toLocaleString(),
      sellerName(users, txn.salespersonId, txn.salespersonName),
    ]),
  ]

  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `sheco-full-sales-report_${periodLabel(from, to)}.csv`)
}

export async function exportReportExcel(
  report,
  users,
  products = [],
  { from = '', to = '' } = {},
) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sheco Pharmacy'
  workbook.created = new Date()
  const analytics = buildAnalytics(report, users, products)

  const summary = workbook.addWorksheet('Summary', {
    views: [{ showGridLines: false }],
  })
  summary.mergeCells('A1:D1')
  styleTitle(summary.getCell('A1'))
  summary.getCell('A1').value = 'Sheco Pharmacy — Full Sales Report'

  summary.getCell('A3').value = 'Period from'
  summary.getCell('B3').value = from || 'All dates'
  summary.getCell('A4').value = 'Period to'
  summary.getCell('B4').value = to || 'All dates'
  summary.getCell('A5').value = 'Generated'
  summary.getCell('B5').value = new Date().toLocaleString()

  styleSection(summary.getCell('A7'))
  summary.getCell('A7').value = 'Executive summary'

  const summaryPairs = [
    ['Sales count', analytics.count, false],
    ['Units sold', analytics.totalItems, false],
    ['Revenue (GHS)', fromPesewas(analytics.revenue), true],
    ['Cash (GHS)', fromPesewas(report.totals.cash), true],
    ['Mobile Money (GHS)', fromPesewas(report.totals.momo), true],
    ['Profit (GHS)', fromPesewas(analytics.profit), true],
    ['Average sale (GHS)', fromPesewas(analytics.avgSale), true],
    ['Profit margin %', Number(analytics.marginPct.toFixed(2)), false],
    ['Cash share %', Number(analytics.cashPct.toFixed(2)), false],
    ['MoMo share %', Number(analytics.momoPct.toFixed(2)), false],
    ['Best sales day', analytics.bestDay?.day || '—', false],
    [
      'Best day revenue (GHS)',
      analytics.bestDay ? fromPesewas(analytics.bestDay.revenue) : 0,
      true,
    ],
  ]
  summaryPairs.forEach((pair, index) => {
    const row = summary.getRow(8 + index)
    row.getCell(1).value = pair[0]
    row.getCell(2).value = pair[1]
    row.getCell(1).font = { bold: true }
    if (pair[2]) row.getCell(2).numFmt = '#,##0.00'
  })

  styleSection(summary.getCell('A22'))
  summary.getCell('A22').value = 'Top products by revenue'
  summary.getCell('A23').value = 'Product'
  summary.getCell('B23').value = 'Qty'
  summary.getCell('C23').value = 'Revenue (GHS)'
  summary.getCell('D23').value = 'Profit (GHS)'
  styleHeaderRow(summary.getRow(23))
  analytics.topProducts.forEach((row, index) => {
    const excelRow = summary.getRow(24 + index)
    excelRow.getCell(1).value = row.name
    excelRow.getCell(2).value = row.quantity
    excelRow.getCell(3).value = fromPesewas(row.revenue)
    excelRow.getCell(4).value = fromPesewas(row.profit)
    excelRow.getCell(3).numFmt = '#,##0.00'
    excelRow.getCell(4).numFmt = '#,##0.00'
  })

  styleSection(summary.getCell('A36'))
  summary.getCell('A36').value = 'Payment mix'
  summary.getCell('A37').value = 'Cash %'
  summary.getCell('B37').value = Number(analytics.cashPct.toFixed(2))
  summary.getCell('A38').value = 'MoMo %'
  summary.getCell('B38').value = Number(analytics.momoPct.toFixed(2))
  autosize(summary, [28, 18, 16, 14])

  addTableSheet(
    workbook,
    'Sales',
    [
      { header: 'Receipt', key: 'receipt', width: 28 },
      { header: 'Date', key: 'date', width: 22 },
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Salesperson', key: 'salesperson', width: 20 },
      { header: 'Device', key: 'device', width: 14 },
      { header: 'Method', key: 'method', width: 10 },
      { header: 'Network', key: 'network', width: 14 },
      { header: 'Reference', key: 'reference', width: 16 },
      { header: 'Item lines', key: 'itemLines', width: 11 },
      { header: 'Units', key: 'itemQty', width: 10 },
      { header: 'Tendered (GHS)', key: 'tendered', width: 14 },
      { header: 'Change (GHS)', key: 'change', width: 13 },
      { header: 'Total (GHS)', key: 'total', width: 13 },
      { header: 'Profit (GHS)', key: 'profit', width: 13 },
      { header: 'Margin %', key: 'marginPct', width: 11 },
      { header: 'Needs review', key: 'needsReview', width: 13 },
    ],
    analytics.salesRows,
    { moneyCols: [11, 12, 13, 14], pctCols: [15] },
  )

  addTableSheet(
    workbook,
    'Sale Line Items',
    [
      { header: 'Receipt', key: 'receipt', width: 26 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Salesperson', key: 'salesperson', width: 18 },
      { header: 'Product', key: 'product', width: 24 },
      { header: 'Generic name', key: 'genericName', width: 18 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Qty', key: 'quantity', width: 8 },
      { header: 'Unit selling (GHS)', key: 'unitSelling', width: 16 },
      { header: 'Unit cost (GHS)', key: 'unitCost', width: 14 },
      { header: 'Line revenue (GHS)', key: 'lineRevenue', width: 16 },
      { header: 'Line cost (GHS)', key: 'lineCost', width: 14 },
      { header: 'Line profit (GHS)', key: 'lineProfit', width: 15 },
      { header: 'Rx ref', key: 'prescriptionRef', width: 12 },
      { header: 'Payment', key: 'paymentMethod', width: 10 },
    ],
    analytics.lineItems,
    { moneyCols: [9, 10, 11, 12, 13] },
  )

  addTableSheet(
    workbook,
    'Product Performance',
    [
      { header: 'Product', key: 'name', width: 24 },
      { header: 'Generic name', key: 'genericName', width: 18 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Qty sold', key: 'quantity', width: 10 },
      { header: 'Times sold', key: 'salesCount', width: 12 },
      { header: 'Revenue (GHS)', key: 'revenue', width: 14 },
      { header: 'Cost (GHS)', key: 'cost', width: 12 },
      { header: 'Profit (GHS)', key: 'profit', width: 13 },
      { header: 'Margin %', key: 'marginPct', width: 11 },
    ],
    analytics.productsPerf.map((row) => ({
      ...row,
      revenue: fromPesewas(row.revenue),
      cost: fromPesewas(row.cost),
      profit: fromPesewas(row.profit),
      marginPct: row.revenue ? (row.profit / row.revenue) * 100 : 0,
    })),
    { moneyCols: [7, 8, 9], pctCols: [10] },
  )

  addTableSheet(
    workbook,
    'Daily Trend',
    [
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Sales', key: 'sales', width: 10 },
      { header: 'Units', key: 'items', width: 10 },
      { header: 'Revenue (GHS)', key: 'revenue', width: 14 },
      { header: 'Profit (GHS)', key: 'profit', width: 13 },
      { header: 'Cash (GHS)', key: 'cash', width: 12 },
      { header: 'MoMo (GHS)', key: 'momo', width: 12 },
    ],
    analytics.daily.map((row) => ({
      day: row.day,
      sales: row.sales,
      items: row.items,
      revenue: fromPesewas(row.revenue),
      profit: fromPesewas(row.profit),
      cash: fromPesewas(row.cash),
      momo: fromPesewas(row.momo),
    })),
    { moneyCols: [4, 5, 6, 7] },
  )

  addTableSheet(
    workbook,
    'By Salesperson',
    [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Sales', key: 'count', width: 10 },
      { header: 'Units', key: 'items', width: 10 },
      { header: 'Revenue (GHS)', key: 'revenue', width: 14 },
      { header: 'Profit (GHS)', key: 'profit', width: 13 },
      { header: 'Avg sale (GHS)', key: 'avgSale', width: 14 },
      { header: 'Margin %', key: 'marginPct', width: 11 },
      { header: 'Cash (GHS)', key: 'cash', width: 12 },
      { header: 'MoMo (GHS)', key: 'momo', width: 12 },
    ],
    analytics.staff.map((row) => ({
      name: row.name,
      count: row.count,
      items: row.items,
      revenue: fromPesewas(row.revenue),
      profit: fromPesewas(row.profit),
      avgSale: fromPesewas(row.avgSale),
      marginPct: row.marginPct,
      cash: fromPesewas(row.cash),
      momo: fromPesewas(row.momo),
    })),
    { moneyCols: [4, 5, 6, 8, 9], pctCols: [7] },
  )

  addTableSheet(
    workbook,
    'MoMo Reconciliation',
    [
      { header: 'Receipt', key: 'receipt', width: 28 },
      { header: 'Network', key: 'network', width: 16 },
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Amount (GHS)', key: 'amount', width: 14 },
      { header: 'Date', key: 'date', width: 22 },
      { header: 'Salesperson', key: 'salesperson', width: 20 },
    ],
    report.momoTxns.map((txn) => ({
      receipt: txn.receiptNumber,
      network: txn.network || '',
      reference: txn.reference || '',
      amount: fromPesewas(txn.amount),
      date: new Date(txn.createdAt).toLocaleString(),
      salesperson: sellerName(users, txn.salespersonId, txn.salespersonName),
    })),
    { moneyCols: [4] },
  )

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, `sheco-full-sales-report_${periodLabel(from, to)}.xlsx`)
}
