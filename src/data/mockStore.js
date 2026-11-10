/** In-memory mock store. Money values are integer pesewas. */

const today = new Date()
const daysFromNow = (n) => {
  const d = new Date(today)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysAgo = (n) => {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SALESPERSON: 'salesperson',
}

const store = {
  users: [
    {
      id: 'u1',
      name: 'Ama Mensah',
      username: 'admin',
      password: 'admin123',
      pin: '1234',
      role: ROLES.SUPER_ADMIN,
      active: true,
    },
    {
      id: 'u2',
      name: 'Kwame Boateng',
      username: 'kwame',
      password: 'sale123',
      pin: '2222',
      role: ROLES.SALESPERSON,
      active: true,
    },
    {
      id: 'u3',
      name: 'Efua Asante',
      username: 'efua',
      password: 'sale123',
      pin: '3333',
      role: ROLES.SALESPERSON,
      active: true,
    },
  ],
  products: [
    {
      id: 'p1',
      name: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      category: 'Analgesic',
      unit: 'blister',
      costPrice: 120, // GHS 1.20
      sellingPrice: 250, // GHS 2.50
      reorderLevel: 40,
      prescriptionOnly: false,
      active: true,
    },
    {
      id: 'p2',
      name: 'Amoxicillin 500mg',
      genericName: 'Amoxicillin',
      category: 'Antibiotic',
      unit: 'capsule',
      costPrice: 450,
      sellingPrice: 800,
      reorderLevel: 30,
      prescriptionOnly: true,
      active: true,
    },
    {
      id: 'p3',
      name: 'ORS Sachet',
      genericName: 'Oral Rehydration Salts',
      category: 'Rehydration',
      unit: 'sachet',
      costPrice: 55,
      sellingPrice: 150,
      reorderLevel: 50,
      prescriptionOnly: false,
      active: true,
    },
    {
      id: 'p4',
      name: 'Ibuprofen 400mg',
      genericName: 'Ibuprofen',
      category: 'Analgesic',
      unit: 'blister',
      costPrice: 200,
      sellingPrice: 400,
      reorderLevel: 25,
      prescriptionOnly: false,
      active: true,
    },
    {
      id: 'p5',
      name: 'Metformin 500mg',
      genericName: 'Metformin',
      category: 'Antidiabetic',
      unit: 'tablet',
      costPrice: 280,
      sellingPrice: 600,
      reorderLevel: 20,
      prescriptionOnly: true,
      active: true,
    },
    {
      id: 'p6',
      name: 'Vitamin C 1000mg',
      genericName: 'Ascorbic Acid',
      category: 'Supplement',
      unit: 'bottle',
      costPrice: 1800,
      sellingPrice: 3500,
      reorderLevel: 10,
      prescriptionOnly: false,
      active: true,
    },
  ],
  batches: [
    {
      id: 'b1',
      productId: 'p1',
      batchNumber: 'PCM-2401',
      expiryDate: daysFromNow(200),
      quantityReceived: 200,
      quantityRemaining: 148,
      costPrice: 120,
      supplier: 'Ernest Chemists',
      dateReceived: daysAgo(40).slice(0, 10),
    },
    {
      id: 'b2',
      productId: 'p2',
      batchNumber: 'AMX-2311',
      expiryDate: daysFromNow(45),
      quantityReceived: 100,
      quantityRemaining: 62,
      costPrice: 450,
      supplier: 'Kinapharma',
      dateReceived: daysAgo(60).slice(0, 10),
    },
    {
      id: 'b3',
      productId: 'p2',
      batchNumber: 'AMX-2405',
      expiryDate: daysFromNow(300),
      quantityReceived: 80,
      quantityRemaining: 80,
      costPrice: 430,
      supplier: 'Kinapharma',
      dateReceived: daysAgo(10).slice(0, 10),
    },
    {
      id: 'b4',
      productId: 'p3',
      batchNumber: 'ORS-2390',
      expiryDate: daysFromNow(-5),
      quantityReceived: 120,
      quantityRemaining: 18,
      costPrice: 60,
      supplier: 'Tobinco',
      dateReceived: daysAgo(120).slice(0, 10),
    },
    {
      id: 'b5',
      productId: 'p3',
      batchNumber: 'ORS-2410',
      expiryDate: daysFromNow(180),
      quantityReceived: 150,
      quantityRemaining: 120,
      costPrice: 55,
      supplier: 'Tobinco',
      dateReceived: daysAgo(20).slice(0, 10),
    },
    {
      id: 'b6',
      productId: 'p4',
      batchNumber: 'IBU-2402',
      expiryDate: daysFromNow(70),
      quantityReceived: 90,
      quantityRemaining: 22,
      costPrice: 200,
      supplier: 'Ernest Chemists',
      dateReceived: daysAgo(35).slice(0, 10),
    },
    {
      id: 'b7',
      productId: 'p5',
      batchNumber: 'MET-2403',
      expiryDate: daysFromNow(250),
      quantityReceived: 60,
      quantityRemaining: 41,
      costPrice: 280,
      supplier: 'Dannex',
      dateReceived: daysAgo(25).slice(0, 10),
    },
    {
      id: 'b8',
      productId: 'p6',
      batchNumber: 'VTC-2401',
      expiryDate: daysFromNow(400),
      quantityReceived: 40,
      quantityRemaining: 8,
      costPrice: 1800,
      supplier: 'Dannex',
      dateReceived: daysAgo(15).slice(0, 10),
    },
  ],
  sales: [
    {
      id: 'sale_seed_1',
      receiptNumber: 'DEV-SEED-20261110-0001',
      deviceId: 'DEV-SEED',
      salespersonId: 'u2',
      createdAt: daysAgo(0),
      total: 1050,
      status: 'completed',
      voidReason: null,
      payment: {
        method: 'cash',
        amountTendered: 2000,
        change: 950,
        network: null,
        reference: null,
      },
      items: [
        {
          productId: 'p1',
          batchId: 'b1',
          quantity: 2,
          unitSellingPrice: 250,
          unitCostPrice: 120,
          prescriptionRef: null,
        },
        {
          productId: 'p3',
          batchId: 'b5',
          quantity: 1,
          unitSellingPrice: 150,
          unitCostPrice: 55,
          prescriptionRef: null,
        },
        {
          productId: 'p4',
          batchId: 'b6',
          quantity: 1,
          unitSellingPrice: 400,
          unitCostPrice: 200,
          prescriptionRef: null,
        },
      ],
    },
    {
      id: 'sale_seed_2',
      receiptNumber: 'DEV-SEED-20261110-0002',
      deviceId: 'DEV-SEED',
      salespersonId: 'u3',
      createdAt: daysAgo(0),
      total: 1600,
      status: 'completed',
      voidReason: null,
      payment: {
        method: 'momo',
        amountTendered: 1600,
        change: 0,
        network: 'MTN MoMo',
        reference: 'MTN-884221',
      },
      items: [
        {
          productId: 'p2',
          batchId: 'b2',
          quantity: 2,
          unitSellingPrice: 800,
          unitCostPrice: 450,
          prescriptionRef: 'RX-4412',
        },
      ],
    },
    {
      id: 'sale_seed_3',
      receiptNumber: 'DEV-SEED-20261109-0003',
      deviceId: 'DEV-SEED',
      salespersonId: 'u2',
      createdAt: daysAgo(1),
      total: 3500,
      status: 'completed',
      voidReason: null,
      payment: {
        method: 'cash',
        amountTendered: 4000,
        change: 500,
        network: null,
        reference: null,
      },
      items: [
        {
          productId: 'p6',
          batchId: 'b8',
          quantity: 1,
          unitSellingPrice: 3500,
          unitCostPrice: 1800,
          prescriptionRef: null,
        },
      ],
    },
    {
      id: 'sale_seed_4',
      receiptNumber: 'DEV-SEED-20261108-0004',
      deviceId: 'DEV-SEED',
      salespersonId: 'u3',
      createdAt: daysAgo(2),
      total: 800,
      status: 'voided',
      voidReason: 'Wrong product selected',
      payment: {
        method: 'cash',
        amountTendered: 1000,
        change: 200,
        network: null,
        reference: null,
      },
      items: [
        {
          productId: 'p2',
          batchId: 'b2',
          quantity: 1,
          unitSellingPrice: 800,
          unitCostPrice: 450,
          prescriptionRef: 'RX-1100',
        },
      ],
    },
  ],
  auditLog: [
    {
      id: 'a1',
      userId: 'u1',
      deviceId: 'DEV-SEED',
      action: 'sign_in',
      record: 'User Ama Mensah',
      time: daysAgo(0),
    },
    {
      id: 'a2',
      userId: 'u2',
      deviceId: 'DEV-SEED',
      action: 'sale',
      record: 'Receipt DEV-SEED-20261110-0001',
      time: daysAgo(0),
    },
    {
      id: 'a3',
      userId: 'u1',
      deviceId: 'DEV-SEED',
      action: 'void',
      record: 'Receipt DEV-SEED-20261108-0004 — Wrong product selected',
      time: daysAgo(2),
    },
    {
      id: 'a4',
      userId: 'u1',
      deviceId: 'DEV-SEED',
      action: 'price_change',
      record: 'Paracetamol 500mg selling price updated',
      time: daysAgo(5),
    },
  ],
  settings: {
    discountLimitPercent: 10,
    sessionTimeoutMinutes: 60,
    offlineUnlockDays: 7,
    expiryAlertDays: 90,
  },
  receiptSeq: 10,
}

export function getStore() {
  return store
}

export function nextId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export function addAudit(entry) {
  store.auditLog.unshift({
    id: nextId('a'),
    time: new Date().toISOString(),
    ...entry,
  })
}
