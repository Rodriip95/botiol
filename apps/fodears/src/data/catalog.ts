import type { Sector } from '../lib/types';

/**
 * Metadatos de los CEDEARs más operados: nombre y categoría.
 * Las APIs gratuitas (data912, IOL) devuelven el ticker y el precio, pero no el sector,
 * así que las categorías salen de esta tabla. Los tickers que no estén acá se muestran en "Otros".
 *
 * `seed` = [precio ARS, variación %, volumen, precio en dólares MEP] usado solo por el proveedor mock.
 * Son valores de referencia tomados de data912 (13/11/2026); no usarlos como cotización real.
 */
export interface CatalogItem {
  symbol: string;
  name: string;
  sector: Sector;
  seed: [price: number, changePct: number, volume: number, usd: number | null];
}

export const CATALOG: CatalogItem[] = [
  // Tecnología
  { symbol: 'AAPL', name: 'Apple', sector: 'Tecnología', seed: [29920, 0.87, 22779, 19.01] },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Tecnología', seed: [29180, 0.41, 42710, 18.52] },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Tecnología', seed: [11180, -3.45, 4363278, 7.09] },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Tecnología', seed: [87475, -10.18, 41012, 55.2] },
  { symbol: 'AVGO', name: 'Broadcom', sector: 'Tecnología', seed: [14620, -6.16, 48287, 9.3] },
  { symbol: 'INTC', name: 'Intel', sector: 'Tecnología', seed: [19400, -5.13, 29291, 12.34] },
  { symbol: 'QCOM', name: 'Qualcomm', sector: 'Tecnología', seed: [25720, -4.31, 5129, 16.13] },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', sector: 'Tecnología', seed: [73175, -2.98, 10986, 46.46] },
  { symbol: 'ASML', name: 'ASML Holding', sector: 'Tecnología', seed: [16900, -1.16, 11013, 10.72] },
  { symbol: 'ORCL', name: 'Oracle', sector: 'Tecnología', seed: [68900, -2.4, 23068, 43.19] },
  { symbol: 'CRM', name: 'Salesforce', sector: 'Tecnología', seed: [20220, 0.19, 4717, 12.84] },
  { symbol: 'ADBE', name: 'Adobe', sector: 'Tecnología', seed: [9125, 1.05, 5789, 5.75] },
  { symbol: 'SAP', name: 'SAP', sector: 'Tecnología', seed: [65675, 0.72, 1914, 41.33] },
  { symbol: 'SNOW', name: 'Snowflake', sector: 'Tecnología', seed: [15900, -4.79, 7163, 10.6] },
  { symbol: 'PLTR', name: 'Palantir', sector: 'Tecnología', seed: [93325, -2.14, 1060, 59.5] },
  { symbol: 'SHOP', name: 'Shopify', sector: 'Tecnología', seed: [2270, -0.48, 3418, 1.44] },
  { symbol: 'SONY', name: 'Sony Group', sector: 'Tecnología', seed: [5685, 2.43, 4665, 3.55] },
  // Comunicaciones
  { symbol: 'GOOGL', name: 'Alphabet (Google)', sector: 'Comunicaciones', seed: [8495, -1.56, 357742, null] },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Comunicaciones', seed: [44040, 1.8, 21246, 27.94] },
  { symbol: 'NFLX', name: 'Netflix', sector: 'Comunicaciones', seed: [2165, -0.68, 117541, 1.37] },
  { symbol: 'SPOT', name: 'Spotify', sector: 'Comunicaciones', seed: [36600, 2.52, 3043, 23.07] },
  { symbol: 'T', name: 'AT&T', sector: 'Comunicaciones', seed: [12330, 0.32, 3981, 7.87] },
  { symbol: 'VZ', name: 'Verizon', sector: 'Comunicaciones', seed: [19420, -0.05, 2878, 12.33] },
  // Consumo
  { symbol: 'AMZN', name: 'Amazon', sector: 'Consumo', seed: [3062.5, -1.05, 450965, 1.945] },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Consumo', seed: [43280, -2.3, 63786, 27.5] },
  { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumo', seed: [33080, 1.59, 33702, 21.04] },
  { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumo', seed: [13390, 1.51, 30018, 8.51] },
  { symbol: 'MCD', name: "McDonald's", sector: 'Consumo', seed: [19050, -0.05, 31505, 12.07] },
  { symbol: 'WMT', name: 'Walmart', sector: 'Consumo', seed: [11860, 1.36, 29618, 7.49] },
  { symbol: 'COST', name: 'Costco', sector: 'Consumo', seed: [38460, 1.26, 1435, 24.11] },
  { symbol: 'NKE', name: 'Nike', sector: 'Consumo', seed: [5265, 0.28, 29123, 3.34] },
  { symbol: 'SBUX', name: 'Starbucks', sector: 'Consumo', seed: [14840, -0.21, 1367, 9.44] },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumo', seed: [18930, 1.01, 14449, 11.98] },
  { symbol: 'UBER', name: 'Uber', sector: 'Consumo', seed: [57975, 0.17, 6205, 36.88] },
  { symbol: 'TM', name: 'Toyota', sector: 'Consumo', seed: [23750, 1.71, 1156, 15.1] },
  // Finanzas
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finanzas', seed: [38440, 0.57, 7047, 24.3] },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Finanzas', seed: [116600, -0.57, 465, 74.4] },
  { symbol: 'C', name: 'Citigroup', sector: 'Finanzas', seed: [68750, -0.47, 486, null] },
  { symbol: 'V', name: 'Visa', sector: 'Finanzas', seed: [39580, 1.59, 6088, 25.12] },
  { symbol: 'MA', name: 'Mastercard', sector: 'Finanzas', seed: [33440, 1.02, 3391, 21.17] },
  { symbol: 'PYPL', name: 'PayPal', sector: 'Finanzas', seed: [12370, 1.72, 6890, 7.79] },
  { symbol: 'BRKB', name: 'Berkshire Hathaway B', sector: 'Finanzas', seed: [45140, 0.8, 29808, 28.61] },
  // Salud
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Salud', seed: [31880, 0.94, 6779, 20.18] },
  { symbol: 'PFE', name: 'Pfizer', sector: 'Salud', seed: [11970, -0.58, 8384, 7.62] },
  { symbol: 'MRK', name: 'Merck', sector: 'Salud', seed: [48820, -0.77, 322, 31.12] },
  { symbol: 'ABBV', name: 'AbbVie', sector: 'Salud', seed: [49180, -0.48, 505, 31.04] },
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'Salud', seed: [43040, 0.63, 3727, 27.32] },
  { symbol: 'UNH', name: 'UnitedHealth', sector: 'Salud', seed: [20440, -0.34, 45990, 12.92] },
  // Energía
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energía', seed: [28300, -0.21, 2427, 18.03] },
  { symbol: 'CVX', name: 'Chevron', sector: 'Energía', seed: [22760, 0.97, 3090, 14.47] },
  { symbol: 'VIST', name: 'Vista Energy', sector: 'Energía', seed: [30640, -0.9, 54555, 19.43] },
  { symbol: 'PBR', name: 'Petrobras', sector: 'Energía', seed: [30420, 0.19, 25293, 19.33] },
  // Industria
  { symbol: 'BA', name: 'Boeing', sector: 'Industria', seed: [11810, -1.5, 882, 7.46] },
  { symbol: 'CAT', name: 'Caterpillar', sector: 'Industria', seed: [49540, -2.19, 6099, 31.49] },
  { symbol: 'GE', name: 'GE Aerospace', sector: 'Industria', seed: [69050, 0.07, 5194, 43.95] },
  { symbol: 'MMM', name: '3M', sector: 'Industria', seed: [31040, -0.22, 383, 20.19] },
  // Materiales
  { symbol: 'NEM', name: 'Newmont', sector: 'Materiales', seed: [62900, -0.15, 183, 39.91] },
  { symbol: 'FCX', name: 'Freeport-McMoRan', sector: 'Materiales', seed: [33020, -2.3, 578, 21.09] },
  { symbol: 'VALE', name: 'Vale', sector: 'Materiales', seed: [9330, -0.95, 12703, 5.95] },
  // Latam
  { symbol: 'MELI', name: 'MercadoLibre', sector: 'Latam', seed: [20700, 0.58, 213420, 13.14] },
  { symbol: 'GLOB', name: 'Globant', sector: 'Latam', seed: [4260, 0.59, 26730, 2.7] },
  { symbol: 'NU', name: 'Nu Holdings', sector: 'Latam', seed: [10920, 10.02, 1040324, 6.91] },
  { symbol: 'ITUB', name: 'Itaú Unibanco', sector: 'Latam', seed: [12550, 2.36, 2444, 8.03] },
  // China
  { symbol: 'BABA', name: 'Alibaba', sector: 'China', seed: [17470, -0.62, 70522, 11.05] },
  { symbol: 'JD', name: 'JD.com', sector: 'China', seed: [11560, 1.04, 1694, 7.27] },
  { symbol: 'BIDU', name: 'Baidu', sector: 'China', seed: [11770, -0.25, 2639, 7.55] },
  { symbol: 'PDD', name: 'PDD Holdings', sector: 'China', seed: [5225, 1.85, 16356, 3.23] },
  { symbol: 'NIO', name: 'NIO', sector: 'China', seed: [1201, -6.31, 1582389, 0.761] },
  // ETF
  { symbol: 'SPY', name: 'SPDR S&P 500', sector: 'ETF', seed: [20920, -0.9, 194796, 13.28] },
  { symbol: 'QQQ', name: 'Invesco Nasdaq 100', sector: 'ETF', seed: [56425, -1.78, 32609, 35.82] },
  { symbol: 'DIA', name: 'SPDR Dow Jones', sector: 'ETF', seed: [43600, -0.09, 4655, 27.69] },
  { symbol: 'IWM', name: 'iShares Russell 2000', sector: 'ETF', seed: [46200, -0.6, 1564, 29.25] },
  { symbol: 'EEM', name: 'iShares Emerging Markets', sector: 'ETF', seed: [20200, -1.02, 5392, 12.75] },
  { symbol: 'EWZ', name: 'iShares MSCI Brazil', sector: 'ETF', seed: [26980, 1.42, 35429, 17.14] },
  { symbol: 'XLE', name: 'Energy Select SPDR', sector: 'ETF', seed: [53875, 0.18, 2710, 34.19] },
  { symbol: 'XLF', name: 'Financial Select SPDR', sector: 'ETF', seed: [48880, 0.49, 3603, 31] },
  { symbol: 'ARKK', name: 'ARK Innovation', sector: 'ETF', seed: [12400, -2.13, 4037, 7.9] },
  { symbol: 'GLD', name: 'SPDR Gold Shares', sector: 'ETF', seed: [11910, 0.16, 107631, 7.57] },
  // Cripto
  { symbol: 'IBIT', name: 'iShares Bitcoin Trust', sector: 'Cripto', seed: [6505, -3.98, 453396, 4.13] },
  { symbol: 'ETHA', name: 'iShares Ethereum Trust', sector: 'Cripto', seed: [14550, -4.59, 42649, 9.29] },
  { symbol: 'MSTR', name: 'Strategy (MicroStrategy)', sector: 'Cripto', seed: [9145, -5.03, 199031, 5.8] },
  { symbol: 'COIN', name: 'Coinbase', sector: 'Cripto', seed: [7890, -2.83, 95666, 5.01] },
];

export const CATALOG_BY_SYMBOL = new Map(CATALOG.map((c) => [c.symbol, c]));

export const SECTORS: Sector[] = [
  'Tecnología',
  'Comunicaciones',
  'Consumo',
  'Finanzas',
  'Salud',
  'Energía',
  'Industria',
  'Materiales',
  'Latam',
  'China',
  'ETF',
  'Cripto',
  'Otros',
];

/** Color de acento por categoría (usado en chips, donut y barras). */
export const SECTOR_COLOR: Record<Sector, string> = {
  Tecnología: '#d6f36b',
  Comunicaciones: '#9b8cff',
  Consumo: '#ff9f5a',
  Finanzas: '#5ad1ff',
  Salud: '#ff6b9a',
  Energía: '#ffd25a',
  Industria: '#8fe3b0',
  Materiales: '#c9a27a',
  Latam: '#5affc8',
  China: '#ff7a6b',
  ETF: '#b8c2ff',
  Cripto: '#f7b733',
  Otros: '#8a8f86',
};

/** Benchmark para comparar "vs mercado". */
export const BENCHMARK = 'SPY';
